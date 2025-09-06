from typing import List, Dict, Any, Optional
import os
from pathlib import Path
import json
from ast import literal_eval

from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

import pandas as pd
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

import httpx
from httpx import ReadTimeout, ConnectTimeout, PoolTimeout, HTTPError
from openai import OpenAI
from langchain_community.vectorstores import FAISS

import logging, traceback, time as _time, random
from functools import lru_cache
from collections import Counter


load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY not set")

for k in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy"):
    os.environ.pop(k, None)

EMBED_MODEL = "text-embedding-3-small"
HTTPX_TIMEOUT = 12.0
EMBED_RETRIES = 3
EMBED_BACKOFF_BASE = 0.25

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent
DEFAULT_RSO_JSON = PROJECT_ROOT / "app" / "assets" / "all_rso_data.json"
RSO_JSON = Path(os.getenv("RSO_JSON_PATH", str(DEFAULT_RSO_JSON)))
FAISS_DIR = (HERE / "faculty_faiss_index").resolve()

FAIL_IF_MISSING_JSON = os.getenv("FAIL_IF_MISSING_JSON", "true").lower() in ("1", "true", "yes")

print(f"[startup] Project root: {PROJECT_ROOT}")
print(f"[startup] RSO_JSON resolved to: {RSO_JSON}")
print(f"[startup] FAISS_DIR: {FAISS_DIR}")

retriever: Optional[Any] = None
df: pd.DataFrame = pd.DataFrame([])

app = FastAPI(title="RSO & Faculty API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger("uvicorn.error")


@lru_cache(maxsize=4096)
def get_embedding(text: str) -> List[float]:
    t = (text or "").replace("\n", " ").strip()
    if not t:
        return []
    last_err = None
    for attempt in range(EMBED_RETRIES):
        try:
            with httpx.Client(timeout=HTTPX_TIMEOUT) as hc:
                resp = OpenAI(api_key=OPENAI_API_KEY, http_client=hc).embeddings.create(
                    model=EMBED_MODEL, input=[t]
                )
            return resp.data[0].embedding
        except (ReadTimeout, ConnectTimeout, PoolTimeout, HTTPError, Exception) as e:
            last_err = e
        sleep_s = min(EMBED_BACKOFF_BASE * (2 ** attempt) + random.random() * 0.15, 2.5)
        _time.sleep(sleep_s)
    logger.warning(f"[embedding] Failed for text='{t[:40]}...' after retries: {last_err}")
    return []


class _DirectOpenAIEmbeddings:
    def embed_query(self, text: str):
        return get_embedding(text)
    def embed_documents(self, texts):
        return [get_embedding(t) for t in texts]


PREFERRED_FIELDS = (
    "name", "title", "description", "about", "summary",
    "interests", "research_interests", "areas_of_interest",
    "department", "keywords", "tags"
)

def _strify(value):
    if isinstance(value, list):
        return ", ".join(map(str, value))
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return ""
    return str(value)

def _build_text_for_row(row: pd.Series) -> str:
    parts = []
    for key in PREFERRED_FIELDS:
        if key in row:
            val = _strify(row[key])
            if val.strip():
                parts.append(f"{key}: {val.strip()}")
    if not parts:
        for key, val in row.items():
            if key == "embedding":
                continue
            s = _strify(val).strip()
            if s:
                parts.append(f"{key}: {s}")
    return "\n".join(parts).strip()

def _load_docs_from_json() -> list:
    from langchain.docstore.document import Document
    docs = []
    if df.empty:
        return docs
    for _, row in df.fillna("").iterrows():
        text = _build_text_for_row(row)
        if not text:
            continue
        meta = {
            "name": row.get("name") or row.get("title"),
            "image": row.get("image"),
            "link": row.get("link") or row.get("source") or row.get("url"),
            "profileUrl": row.get("profileUrl") or row.get("profile_url"),
            "website": row.get("website") or row.get("personal_website"),
            "email": row.get("email") or row.get("contact_email") or row.get("contact"),
            "interests": row.get("interests") or row.get("research_interests") or row.get("areas_of_interest") or [],
        }
        docs.append(Document(page_content=text, metadata=meta))
    print(f"[rebuild] Prepared {len(docs)} docs from JSON.")
    return docs

def _coerce_emb(x):
    if isinstance(x, list):
        return x
    if isinstance(x, str):
        try:
            v = json.loads(x)
            return v if isinstance(v, list) else []
        except Exception:
            try:
                v = literal_eval(x)
                return v if isinstance(v, list) else []
            except Exception:
                return []
    return []


@app.on_event("startup")
def init_resources():
    global retriever, df

    possible_paths = [
        RSO_JSON,
        PROJECT_ROOT / "app" / "assets" / "all_rso_data.json",
        HERE / ".." / "app" / "assets" / "all_rso_data.json",
        Path("./app/assets/all_rso_data.json"),
        Path("../app/assets/all_rso_data.json")
    ]
    
    json_path = None
    for path in possible_paths:
        path = path.resolve()
        if path.exists():
            json_path = path
            print(f"[startup] Found RSO JSON at: {json_path}")
            break
    
    if not json_path:
        msg = f"[startup] RSO JSON not found at any location. Checked: {[str(p) for p in possible_paths]}"
        print(msg)
        if FAIL_IF_MISSING_JSON:
            raise RuntimeError(msg)
        df = pd.DataFrame([])
        print("[startup] Continuing without RSO data")
        return

    try:
        df_local = pd.read_json(json_path)
        if "embedding" not in df_local.columns:
            df_local["embedding"] = [[] for _ in range(len(df_local))]
        else:
            df_local["embedding"] = df_local["embedding"].apply(_coerce_emb)
        df = df_local
        print(f"[startup] Loaded {len(df)} rows from {json_path}")
    except Exception as e:
        print(f"[startup] Failed to read {json_path}: {e}")
        df = pd.DataFrame([])

    try:
        if FAISS_DIR.exists():
            emb = _DirectOpenAIEmbeddings()
            index = FAISS.load_local(str(FAISS_DIR), emb, allow_dangerous_deserialization=True)
            if not callable(getattr(index, "embedding_function", None)):
                index.embedding_function = emb.embed_query
            retriever = index.as_retriever(search_type="similarity", search_kwargs={"k": 10})
            print("[startup] FAISS index loaded from disk.")
            return
        else:
            print(f"[startup] FAISS dir not found at {FAISS_DIR}, rebuilding.")
    except Exception as e:
        print(f"[startup] Load failed with '{e}', rebuilding.")

    try:
        docs = _load_docs_from_json()
        if not docs:
            print("[startup] No docs to index; retriever disabled.")
            retriever = None
            return

        emb = _DirectOpenAIEmbeddings()
        index = FAISS.from_documents(docs, emb)
        if not callable(getattr(index, "embedding_function", None)):
            index.embedding_function = emb.embed_query
        index.save_local(str(FAISS_DIR))
        retriever = index.as_retriever(search_type="similarity", search_kwargs={"k": 10})
        print("[startup] FAISS index built from JSON and saved.")
    except Exception as e:
        retriever = None
        print(f"[startup] Failed to build FAISS index: {e}")


@app.get("/healthz")
def healthz():
    return {
        "ok": True,
        "has_retriever": retriever is not None,
        "faiss_index_dir": str(FAISS_DIR),
        "rso_json_path": str(RSO_JSON),
        "rso_rows": int(df.shape[0]) if isinstance(df, pd.DataFrame) else 0,
    }

@app.get("/")
def root():
    return healthz()

def _to_jsonable(x):
    if x is None or isinstance(x, (str, int, float, bool)):
        return x
    if isinstance(x, (list, tuple)):
        return [_to_jsonable(v) for v in x]
    if isinstance(x, dict):
        return {str(k): _to_jsonable(v) for k, v in x.items()}
    try:
        import numpy as _np
        if isinstance(x, (_np.generic,)):
            return x.item()
    except Exception:
        pass
    if isinstance(x, (set,)):
        return [_to_jsonable(v) for v in sorted(list(x), key=lambda s: str(s))]
    return str(x)

@app.post("/retrieve")
def retrieve(payload: Dict[str, Any] = Body(...)) -> List[Dict[str, Any]]:
    try:
        q = (payload.get("input") or "").strip()
    except Exception:
        q = ""
    if not q:
        return []

    results = []
    try:
        if retriever is not None:
            docs = retriever.invoke(q)
            for d in docs:
                m = d.metadata or {}
                results.append({
                    "name": m.get("name") or m.get("title"),
                    "description": (d.page_content or "")[:2000],
                    "image": m.get("image"),
                    "link": m.get("link") or m.get("source") or m.get("url"),
                    "profileUrl": m.get("profileUrl") or m.get("profile_url"),
                    "website": m.get("website") or m.get("personal_website"),
                    "email": m.get("email") or m.get("contact_email") or m.get("contact"),
                    "interests": m.get("interests") or [],
                })
    except Exception as e:
        logger.error("retrieve crashed: %s\n%s", e, traceback.format_exc())
        if not df.empty:
            hits = df[df.apply(lambda row: q.lower() in str(row).lower(), axis=1)]
            for _, row in hits.head(5).iterrows():
                results.append({
                    "name": row.get("name") or row.get("title"),
                    "description": str(row.to_dict())[:2000],
                    "image": row.get("image"),
                    "link": row.get("link"),
                    "profileUrl": row.get("profileUrl"),
                    "website": row.get("website"),
                    "email": row.get("email"),
                    "interests": row.get("interests") or [],
                })
    return _to_jsonable(results)

@app.post("/generate-cards")
def generate_cards(tags: Dict[str, Any] = Body(...)):
    interests: List[str] = tags.get("interests") or []
    if not isinstance(interests, list) or not interests:
        return []
    
    if df.empty:
        return []

    working = df.copy()
    
    has_embeddings = "embedding" in working.columns and not working["embedding"].empty
    
    if has_embeddings:
        working["score"] = 0.0
        used = 0
        
        for interest in interests:
            emb = get_embedding(str(interest))
            if not emb:
                continue
            used += 1
            q = np.asarray(emb, dtype=np.float32).reshape(1, -1)

            def _sim(vec):
                if isinstance(vec, (list, np.ndarray)) and len(vec) > 0:
                    try:
                        v = np.asarray(vec, dtype=np.float32).reshape(1, -1)
                        if v.shape[1] == q.shape[1]:
                            return float(cosine_similarity(v, q)[0][0])
                    except Exception:
                        pass
                return 0.0

            working["score"] += working["embedding"].apply(_sim)

        if used > 0:
            working["score"] /= used
        else:
            has_embeddings = False

    if not has_embeddings:
        working["score"] = 0.0
        
        def row_text(row):
            try:
                return _build_text_for_row(row).lower()
            except Exception:
                return str(row).lower()
        
        base_text = working.apply(row_text, axis=1)
        
        for interest in interests:
            s = interest.lower()
            working["score"] += base_text.str.contains(s, regex=False, na=False).astype(float)
            
            interest_fields = ['interests', 'research_interests', 'areas_of_interest', 'keywords', 'tags']
            for field in interest_fields:
                if field in working.columns:
                    def _count_in_field(value, interest_term):
                        if isinstance(value, list):
                            return sum(1 for item in value if interest_term in str(item).lower())
                        elif isinstance(value, str):
                            return 1 if interest_term in value.lower() else 0
                        return 0
                    
                    working["score"] += working[field].apply(lambda x: _count_in_field(x, s))

    filtered = working[working["score"] > 0]
    
    if filtered.empty:
        return []
    
    top = filtered.nlargest(10, "score")

    out = []
    for _, row in top.iterrows():
        card = {
            "name": str(row.get("name") or row.get("title") or "Unknown RSO"),
            "description": str(row.get("description") or row.get("about") or row.get("summary") or ""),
            "website": str(row.get("website") or row.get("link") or row.get("profileUrl") or row.get("url") or ""),
            "instagram": str(row.get("instagram") or ""),
            "facebook": str(row.get("facebook") or ""),
            "link": str(row.get("link") or ""),
        }
        out.append(card)

    return out