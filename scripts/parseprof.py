from __future__ import annotations

import os
import re
import json
import time
from typing import List, Dict, Any
from urllib.parse import urljoin
from datetime import datetime, timezone
from pathlib import Path

import dotenv
import requests
from bs4 import BeautifulSoup

import httpx
from openai import OpenAI

from langchain_core.embeddings import Embeddings
from langchain_community.vectorstores import FAISS

dotenv.load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY not set")

for k in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy"):
    os.environ.pop(k, None)

EMBED_MODEL = "text-embedding-3-small"
BATCH = int(os.getenv("EMBED_BATCH", "100"))
MAX_DOCS = int(os.getenv("MAX_DOCS", "0"))  # 0 = no cap

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0_0) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/117.0 Safari/537.36 "
        "UIUC-CS-Research-Scraper/1.0 (student project)"
    ),
    "Accept": "text/html,application/xhtml+xml",
}

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

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

SESSION = requests.Session()
SESSION.headers.update(HEADERS)

def fetch_html(url: str, timeout: int = 20) -> str:
    last = None
    for attempt in range(3):
        try:
            r = SESSION.get(url, timeout=timeout)
            if r.status_code == 200:
                return r.text
            last = f"HTTP {r.status_code}"
        except Exception as e:
            last = str(e)
        time.sleep(0.5)
    raise RuntimeError(f"fetch_html failed for {url}: {last}")

def parse_faculty_from_area(html: str, base_url: str) -> List[Dict[str, Any]]:
    """Extract faculty cards from an area page. Returns list of dicts."""
    soup = BeautifulSoup(html, "html.parser")
    out: List[Dict[str, Any]] = []
    seen = set()

    cards = soup.select(".views-row") or soup.select(".card")

    if not cards:
        people = []
        for a in soup.select("a[href*='/people/']"):
            name = a.get_text(strip=True)
            href = (a.get("href") or "").strip()
            if not name or not href:
                continue
            profile = urljoin(base_url, href)
            if profile in seen:
                continue
            seen.add(profile)
            people.append({"name": name, "profileUrl": profile})
        if people:
            return people  

        for h in soup.select("h3, h2"):
            if h.parent not in cards:
                cards.append(h.parent)

    for c in cards:
        a = (c.select_one("h3 a") or c.select_one("h2 a") or c.select_one("a[href*='/people/']"))
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

        out.append({"name": name, "profileUrl": profile, "teaser": teaser, "image": image})

    if not out:
        for a in soup.select("a[href*='/people/']"):
            name = a.get_text(strip=True)
            if not name:
                continue
            profile = urljoin(base_url, a.get("href") or "")
            if profile in seen:
                continue
            seen.add(profile)
            out.append({"name": name, "profileUrl": profile})

    return out

def enrich_from_profile(profile_html: str) -> Dict[str, Any]:
    """Extract title, email, office, interests, image, website(s)."""
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
    for sel in (".tags a", ".field--name-field-research-areas a", ".research-areas a", ".field--name-field-keywords a"):
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

class DirectEmbeddings(Embeddings):
    """LangChain-compatible embeddings (batched, no global client)."""
    def _embed_batch(self, texts: List[str]) -> List[List[float]]:
        clean = [(i, (t or "").replace("\n", " ").strip()) for i, t in enumerate(texts)]
        idxs_payload = [(i, t) for i, t in clean if t]
        if not idxs_payload:
            return [[] for _ in texts]

        idxs, payload = zip(*idxs_payload)
        out: List[List[float]] = [[] for _ in texts]

        for s in range(0, len(payload), BATCH):
            chunk = payload[s : s + BATCH]
            with httpx.Client(timeout=60) as hc:
                resp = OpenAI(api_key=OPENAI_API_KEY, http_client=hc).embeddings.create(
                    model=EMBED_MODEL, input=list(chunk)
                )
            for j, item in enumerate(resp.data):
                out[idxs[s + j]] = item.embedding
        return out

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return self._embed_batch(texts)

    def embed_query(self, text: str) -> List[float]:
        return self._embed_batch([text])[0]

def run_full_scrape(enrich: bool = True) -> Dict[str, Any]:
    """Scrape all AREAS, optionally enrich profiles, and return combined payload."""
    areas_out: List[Dict[str, Any]] = []
    faculty_index: Dict[str, Dict[str, Any]] = {}

    total_cards = 0

    for link in AREAS:
        url = link["url"]; area = link["area"]
        print(f"[scrape] area: {area}  url: {url}")
        try:
            area_html = fetch_html(url)
            faculty = parse_faculty_from_area(area_html, url)
            print(f"[scrape] parsed cards: {len(faculty)}")
            total_cards += len(faculty)

            if enrich and faculty:
                enriched = []
                for f in faculty:
                    time.sleep(0.12)  # be nice to the site
                    try:
                        prof_html = fetch_html(f["profileUrl"])
                        extra = enrich_from_profile(prof_html)
                        enriched.append({**f, **extra})
                    except Exception as e:
                        enriched.append({**f, "enrichError": str(e)})
                faculty = enriched

            areas_out.append({"area": area, "url": url, "count": len(faculty), "faculty": faculty})

            for f in faculty:
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
            print(f"[scrape] ERROR in {area}: {e}")
            areas_out.append({"area": area, "url": url, "error": str(e)})

    faculty_list = []
    docs_texts: List[str] = []
    docs_meta: List[Dict[str, Any]] = []

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
        docs_texts.append(content)
        docs_meta.append({
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
        })

    print(f"[embed] docs_texts before cap: {len(docs_texts)} (cards scraped: {total_cards})")
    if MAX_DOCS and len(docs_texts) > MAX_DOCS:
        docs_texts = docs_texts[:MAX_DOCS]
        docs_meta = docs_meta[:MAX_DOCS]
        print(f"[embed] capped to MAX_DOCS={MAX_DOCS}")

    if not docs_texts:
        raise RuntimeError("No docs_texts produced. Selectors likely failed or site layout changed.")

    # build + save FAISS with our direct adapter
    embeddings = DirectEmbeddings()
    vectorstore = FAISS.from_texts(docs_texts, embeddings, metadatas=docs_meta)
    out_dir = (Path(__file__).resolve().parent / "faculty_faiss_index")
    vectorstore.save_local(str(out_dir))
    print(f"[embed] FAISS saved at: {out_dir}")

    payload = {
        "scrapedAt": datetime.now(timezone.utc).isoformat(),
        "areas": areas_out,
        "faculty": faculty_list,
    }
    return payload

def save_json(payload: Dict[str, Any], filename: str = "professors.json") -> str:
    out_path = Path(__file__).parent / filename
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return str(out_path)

if __name__ == "__main__":
    data = run_full_scrape(enrich=True)
    path = save_json(data, "professors_updated.json")
    print(f"Saved → {path}  (faculty: {len(data['faculty'])})  |  FAISS: ./faculty_faiss_index")
