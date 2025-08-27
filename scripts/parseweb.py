
import json
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

import requests
from bs4 import BeautifulSoup
from trafilatura import extract as t_extract

# ----------------------------
# Config & Paths
# ----------------------------
BASE = Path(__file__).resolve().parent.parent  # project root (one level up from /scripts)
RAW_DIR   = BASE / "data" / "raw"
CLEAN_DIR = BASE / "data" / "clean"
META_DIR  = BASE / "data" / "meta"
for d in (RAW_DIR, CLEAN_DIR, META_DIR):
    d.mkdir(parents=True, exist_ok=True)

ERROR_LOG = META_DIR / "fetch_errors.log"
STATUS_LOG = META_DIR / "status.log"

HEADERS = {
    "User-Agent": "ProfIndexer/0.1 (+your-email@example.com)"
}

NAMESPACE = uuid.UUID("5c2e8f4b-5d6b-4f2e-9a0a-1d8e9c2a1234")

MIN_CLEAN_LEN = 350

# ----------------------------
# Helpers
# ----------------------------
def log(line: str, path: Path):
    with path.open("a", encoding="utf-8") as f:
        f.write(line.rstrip() + "\n")


def canonicalize_url(u: str) -> str:
    """Lowercase scheme/host, strip tracking params, drop trailing slash (except root)."""
    p = urlparse((u or "").strip())
    scheme = (p.scheme or "https").lower()
    netloc = p.netloc.lower()
    path = p.path
    if path.endswith("/") and len(path) > 1:
        path = path.rstrip("/")
    allowed = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True)
               if k.lower() not in {"utm_source","utm_medium","utm_campaign","utm_term","utm_content","gclid","fbclid"}]
    query = urlencode(allowed, doseq=True)
    return urlunparse((scheme, netloc, path, "", query, ""))


def prof_id_from_url(canon_url: str) -> str:
    return str(uuid.uuid5(NAMESPACE, canon_url))


def prefer_https(url: str) -> str:
    """If URL is http, try https flavour first."""
    p = urlparse(url)
    if p.scheme.lower() == "http":
        return url.replace("http://", "https://", 1)
    return url


# ----------------------------
# Fetch → Save raw HTML
# ----------------------------
def fetch_html(prof_id: str, url: str, timeout: int = 20) -> str | None:
    """Return HTML text or None; never raise. Saves raw HTML if successful."""
    primary = prefer_https(url)

    for attempt, u in enumerate((primary, url), start=1):
        try:
            r = requests.get(u, headers=HEADERS, timeout=timeout, allow_redirects=True)
            r.raise_for_status()
            html = r.text
            (RAW_DIR / f"{prof_id}.html").write_text(html, encoding="utf-8")
            return html
        except requests.RequestException as e:
            log(f"[FETCH_ERR attempt {attempt}] {u} | {prof_id} | {e}", ERROR_LOG)
        except Exception as e:
            log(f"[FETCH_UNEXPECTED attempt {attempt}] {u} | {prof_id} | {e}", ERROR_LOG)

    return None


# ----------------------------
# Clean raw HTML → readable text
# ----------------------------
def clean_data(html: str) -> str:
    """
    Use trafilatura first (no links/images). If short/empty, fallback with BS4:
    collect headings, paragraphs, and list items. Preserve paragraph structure.
    """
    if not html:
        return ""

    text = t_extract(html, include_links=False, include_images=False) or ""

    if len(text) < 300:
        soup = BeautifulSoup(html, "html.parser")
        for t in soup(["script", "style", "nav", "header", "footer", "form", "aside"]):
            t.decompose()

        parts = []
        for h in soup.find_all(["h1", "h2", "h3"]):
            s = h.get_text(" ", strip=True)
            if s:
                parts.append(s)
        for p in soup.find_all("p"):
            s = p.get_text(" ", strip=True)
            if s:
                parts.append(s)
        for li in soup.find_all("li"):
            s = li.get_text(" ", strip=True)
            if s:
                parts.append("• " + s)

        text = "\n\n".join(parts).strip()

    text = text.replace("\r", "")
    while "\n\n\n" in text:
        text = text.replace("\n\n\n", "\n\n")
    while "  " in text:
        text = text.replace("  ", " ")

    return text.strip()


def fetch_and_save_html():
    meta_path = BASE / "professors.json"
    data = json.loads(meta_path.read_text(encoding="utf-8"))

    faculty = data.get("faculty", [])
    total = len(faculty)
    done = 0

    for fac in faculty:
        name = fac.get("name") or fac.get("nameOnProfile") or "Unknown"
        website = fac.get("website") or ""
        profile = fac.get("profileUrl") or ""

        if not website and not profile:
            log(f"[SKIP no URLs] {name}", STATUS_LOG)
            continue

        target = website or profile
        canon = canonicalize_url(target)
        prof_id = prof_id_from_url(canon)

        html = fetch_html(prof_id, canon)
        if html is None and profile and profile != target:
            alt_canon = canonicalize_url(profile)
            html = fetch_html(prof_id, alt_canon)

        if html is None:
            log(f"[UNREACHABLE] {name} | {canon}", STATUS_LOG)
            time.sleep(0.35)
            continue

        cleaned = clean_data(html)
        if len(cleaned) < MIN_CLEAN_LEN:
            log(f"[TOO_SHORT {len(cleaned)}] {name} | {canon}", STATUS_LOG)
            time.sleep(0.35)
            continue

        (CLEAN_DIR / f"{prof_id}.txt").write_text(cleaned, encoding="utf-8")
        log(f"[CLEANED] {name} | {canon} | chars={len(cleaned)}", STATUS_LOG)
        done += 1
        time.sleep(0.35)

    print(f"Processed clean texts for {done}/{total} faculty.")


if __name__ == "__main__":
    fetch_and_save_html()