# parseprof.py
# Scrape Siebel School research areas -> faculty -> profile enrichment.
# Run directly:  python parseprof.py
# Optional HTTP: uncomment app.run() at bottom and GET /scrape_all

from __future__ import annotations
from langchain.docstore.document import Document
from langchain.vectorstores import FAISS
from langchain.embeddings.openai import OpenAIEmbeddings
from flask import Flask, jsonify

from bs4 import BeautifulSoup
from urllib.parse import urljoin
from datetime import datetime
import requests
import json
import os
import time
import re
from typing import List, Dict, Any
import dotenv 
dotenv.load_dotenv()
embeddings = OpenAIEmbeddings()
key = os.getenv("OPENAI_API_KEY")



# ====== Embedded area links (extend if you add more) ======
AREAS: List[Dict[str, str]] = [
    {"area": "Architecture, Compilers, and Parallel Computing", "url": "https://siebelschool.illinois.edu/research/areas/architecture-compilers-and-parallel-computing"},
    {"area": "Artificial Intelligence", "url": "https://siebelschool.illinois.edu/research/areas/artificial-intelligence"},
    {"area": "Bioinformatics and Computational Biology", "url": "https://siebelschool.illinois.edu/research/areas/bioinformatics-and-computational-biology"},
    {"area": "Computers and Education", "url": "https://siebelschool.illinois.edu/research/areas/computers-and-education"},
    {"area": "Data and Information Systems", "url": "https://siebelschool.illinois.edu/research/areas/data-and-information-systems"},
    {"area": "Interactive Computing", "url": "https://siebelschool.illinois.edu/research/areas/interactive-computing"},
    {"area": "Programming Languages, Formal Methods, and Software Engineering", "url": "https://siebelschool.illinois.edu/research/areas/programming-languages-formal-methods-and-software-engineering"},
    {"area": "Scientific Computing", "url": "https://siebelschool.illinois.edu/research/areas/scientific-computing"},
    {"area": "Security and Privacy", "url": "https://siebelschool.illinois.edu/research/areas/security-and-privacy"},
    {"area": "Systems and Networking", "url": "https://siebelschool.illinois.edu/research/areas/systems-and-networking"},
    {"area": "Theory and Algorithms", "url": "https://siebelschool.illinois.edu/research/areas/theory-and-algorithms"},
]

HEADERS = {
    "User-Agent": "UIUC-CS-Research-Scraper/1.0 (student project; contact: you@illinois.edu)",
    "Accept": "text/html,application/xhtml+xml",
}


def fetch_html(url: str, timeout: int = 20) -> str:
    r = requests.get(url, headers=HEADERS, timeout=timeout)
    r.raise_for_status()
    return r.text


def parse_faculty_from_area(html: str, base_url: str) -> List[Dict[str, Any]]:
    """
    Extract faculty cards from an area page.
    Returns list of {name, profileUrl, teaser?, image?}.
    """
    soup = BeautifulSoup(html, "html.parser")
    out: List[Dict[str, Any]] = []
    seen = set()

    cards = []
    cards += soup.select(".views-row")
    cards += soup.select(".card")

    if not cards:
        for h in soup.select("h3, h2"):
            if h.parent not in cards:
                cards.append(h.parent)

    for c in cards:
        a = (c.select_one("h3 a") or
             c.select_one("h2 a") or
             c.select_one("a[href*='/people/']"))
        if not a:
            continue
        name = (a.get_text() or "").strip()
        href = (a.get("href") or "").strip()
        if not name or not href:
            continue

        profile = urljoin(base_url, href)
        if profile in seen:
            continue
        seen.add(profile)

        # teaser/short interests (paragraph near the heading)
        teaser = ""
        h = a.find_parent(["h2", "h3"])
        if h and h.find_next_sibling("p"):
            teaser = h.find_next_sibling("p").get_text(strip=True)
        if not teaser:
            p = c.select_one("p")
            if p:
                teaser = p.get_text(strip=True)

        img = c.select_one("img")
        image = urljoin(base_url, img["src"]) if img and img.get("src") else None

        out.append({
            "name": name,
            "profileUrl": profile,
            "teaser": teaser,
            "image": image
        })

    if not out:
        for a in soup.select("a[href*='/people/']"):
            name = a.get_text(strip=True)
            if not name:
                continue
            profile = urljoin(base_url, a["href"])
            if profile in seen:
                continue
            seen.add(profile)
            out.append({"name": name, "profileUrl": profile})

    return out


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

def enrich_from_profile(profile_html: str) -> Dict[str, Any]:
    """
    Extract title, email, office/location, lab website(s), interests/tags, and image.
    Matches the 'For More Information' section seen on many profiles.
    """
    soup = BeautifulSoup(profile_html, "html.parser")
    out: Dict[str, Any] = {}

    h1 = soup.select_one("h1")
    if h1:
        out["nameOnProfile"] = h1.get_text(strip=True)

    title = None
    if h1:
        p = h1.find_next("p")
        if p and p.get_text(strip=True):
            title = p.get_text(strip=True)
    if not title:
        for sel in (".profile-title", ".field--name-field-title"):
            node = soup.select_one(sel)
            if node and node.get_text(strip=True):
                title = node.get_text(strip=True)
                break
    if title:
        out["title"] = title

    mail = soup.select_one('a[href^="mailto:"]')
    if mail:
        email = mail.get("href", "").replace("mailto:", "").strip()
        if EMAIL_RE.match(email):
            out["email"] = email

    office = None
    if mail:
        t = mail.find_next(string=True)
        if t and isinstance(t, str):
            txt = t.strip()
            if txt and len(txt) <= 80:
                office = txt
    if not office:
        for sel in (".field--name-field-office", ".profile-office"):
            node = soup.select_one(sel)
            if node:
                office = node.get_text(strip=True)
                break
    if office:
        out["office"] = office

    lab_links = []
    for hdr in soup.select("h2, h3"):
        if "for more information" in (hdr.get_text() or "").lower():
            node = hdr
            while True:
                node = node.find_next_sibling()
                if node is None or (getattr(node, "name", None) in ("h2", "h3")):
                    break
                for a in node.select("a[href]"):
                    href = a.get("href", "").strip()
                    label = a.get_text(strip=True)
                    if href:
                        lab_links.append({"label": label, "url": href})
            break

    if lab_links:
        external = [l for l in lab_links if l["url"].startswith("http") and "illinois.edu" not in l["url"]]
        primary = external[0]["url"] if external else lab_links[0]["url"]
        out["website"] = primary
        out["moreLinks"] = lab_links
        out["isLabSite"] = bool(external) or ("lab" in primary.lower())

    tags = set()
    for sel in (
        ".tags a",
        ".field--name-field-research-areas a",
        ".research-areas a",
        ".field--name-field-keywords a",
    ):
        for a in soup.select(sel):
            t = a.get_text(strip=True)
            if t:
                tags.add(t)

    if not tags:
        for hdr in soup.select("h2, h3"):
            if "interest" in (hdr.get_text() or "").lower():
                for ul in hdr.find_all_next("ul", limit=2):
                    for li in ul.select("li"):
                        t = li.get_text(strip=True)
                        if t:
                            tags.add(t)
                break
    if tags:
        out["interests"] = sorted(tags)

    img = soup.select_one("figure img") or soup.select_one("img")
    if img and img.get("src"):
        out["image"] = img["src"]

    return out


def run_full_scrape(enrich: bool = True) -> Dict[str, Any]:
    """
    Scrape all embedded AREAS -> list pages -> profile enrichment (optional).
    Returns combined payload with per-area results and a deduped faculty list.
    """
    areas_out: List[Dict[str, Any]] = []
    faculty_index: Dict[str, Dict[str, Any]] = {}

    for link in AREAS:
        url = link["url"]; area = link["area"]
        try:
            area_html = fetch_html(url)
            faculty = parse_faculty_from_area(area_html, url)

            if enrich and faculty:
                enriched = []
                for f in faculty:
                    time.sleep(0.12)  
                    try:
                        prof_html = fetch_html(f["profileUrl"])
                        extra = enrich_from_profile(prof_html)
                        enriched.append({**f, **extra})
                    except Exception as e:
                        enriched.append({**f, "enrichError": str(e)})
                faculty = enriched

            areas_out.append({
                "area": area,
                "url": url,
                "count": len(faculty),
                "faculty": faculty
            })

            for f in faculty:
                print(f)
                key = (f.get("profileUrl") or f.get("name", "")).lower()
                if not key:
                    continue
                entry = faculty_index.get(key, {**f, "areas": []})
                if area not in entry["areas"]:
                    entry["areas"].append(area)
                for k, v in f.items():
                    if v and not entry.get(k):
                        entry[k] = v
                faculty_index[key] = entry

        except Exception as e:
            areas_out.append({"area": area, "url": url, "error": str(e)})

    faculty_list = []
    docs = []
    for f in faculty_index.values():
        parts = [
            f.get("name") or "",
            f.get("title") or "",
            ", ".join(f.get("areas", [])),
            ", ".join(f.get("interests", []) if isinstance(f.get("interests"), list) else []),
            f.get("teaser") or "",
            f.get("office") or "",
            f.get("email") or "",
            f.get("website") or "",
        ]
        content = " | ".join([p for p in parts if p])
        f["content"] = content
        faculty_list.append(f)
        docs.append(Document(
            page_content=content,
            metadata= {
                "name": f.get("name"),
                "profileUrl": f.get("profileUrl"),
                "title": f.get("title"),
                "email": f.get("email"),
                "office": f.get("office"),
                "website": f.get("website"),
                "areas": f.get("areas", []),
                "teaser": f.get("teaser"),
                "image": f.get("image"),
                "isLabSite": f.get("isLabSite", False),
                "moreLinks": f.get("moreLinks", []),
                "interests": f.get("interests", []),
            }
        )

        )
    vectorstore = FAISS.from_documents(docs, embeddings)
    vectorstore.save_local("faculty_faiss_index")


    payload = {
        "scrapedAt": datetime.utcnow().isoformat() + "Z",
        "areas": areas_out,
        "faculty": faculty_list,
    }
    return payload

def save_json(payload: Dict[str, Any], filename: str = "professors.json") -> str:
    out_path = os.path.join(os.path.dirname(__file__), filename)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return out_path


def scrape_all_route():
    data = run_full_scrape(enrich=True)
    path = save_json(data, "professors.json")
    return jsonify({"saved": path, **data})


if __name__ == "__main__":
    data = run_full_scrape(enrich=True)
    path = save_json(data, "professors_updated.json")
    print(f"Saved → {path}  (faculty: {len(data['faculty'])})")
    # To also serve an API, uncomment:
    # app.run(port=5000, debug=True)
