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
from openai import OpenAI
from langchain_community.vectorstores import FAISS


load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY not set")

for k in ("HTTP_PROXY","HTTPS_PROXY","http_proxy","https_proxy","ALL_PROXY","all_proxy"):
    os.environ.pop(k, None)

EMBED_MODEL = "text-embedding-3-small"

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = Path(__file__).resolve().parents[1] if HERE.name == "scripts" else HERE
DATA_DIR = PROJECT_ROOT / "app" / "assets"
RSO_JSON = DATA_DIR / "all_rso_data.json"
FAISS_DIR = (HERE / "faculty_faiss_index").resolve()

retriever: Optional[Any] = None
df: pd.DataFrame = pd.DataFrame([])

app = FastAPI(title="RSO & Faculty API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],     
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_embedding(text: str) -> List[float]:
    t = (text or "").replace("\n", " ").strip()
    if not t:
        return []
    with httpx.Client(timeout=30) as hc:
        resp = OpenAI(api_key=OPENAI_API_KEY, http_client=hc).embeddings.create(
            model=EMBED_MODEL, input=[t]
        )
    return resp.data[0].embedding

class _DirectOpenAIEmbeddings:
    """Adapter so LangChain FAISS can call our embedding function."""
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

    if RSO_JSON.exists():
        try:
            df_local = pd.read_json(RSO_JSON)
            if "embedding" not in df_local.columns:
                df_local["embedding"] = [[] for _ in range(len(df_local))]
            else:
                df_local["embedding"] = df_local["embedding"].apply(_coerce_emb)
            df = df_local
        except Exception as e:
            print(f"[startup] Failed to read {RSO_JSON}: {e}")
            df = pd.DataFrame([])
    else:
        print(f"[startup] RSO JSON not found at {RSO_JSON}")
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
        "rso_rows": int(df.shape[0]) if isinstance(df, pd.DataFrame) else 0,
    }

@app.get("/")
def root():
    return healthz()

import logging, traceback, time as _time
logger = logging.getLogger("uvicorn.error")

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
    t0 = _time.time()
    try:
        q = (payload.get("input") or "").strip()
    except Exception:
        q = ""
    if not q:
        return []

    try:
        results = []
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
        return _to_jsonable(results)
    except Exception as e:
        logger.error("retrieve crashed: %s\n%s", e, traceback.format_exc())
        return []

@app.post("/generate-cards")
def generate_cards(tags: Dict[str, Any] = Body(...)):
    interests: List[str] = tags.get("interests") or []
    if not interests or df.empty or "embedding" not in df.columns:
        return []

    working = df.copy()
    working["score"] = 0.0
    used = 0

    # Precompute a simple lowercase text blob per row for keyword boosting
    preferred = ("name","title","description","about","summary",
                 "interests","research_interests","areas_of_interest",
                 "department","keywords","tags","link")
    def row_text(r):
        parts = []
        for k in preferred:
            v = r.get(k)
            if isinstance(v, list):
                v = ", ".join(map(str, v))
            if isinstance(v, str) and v.strip():
                parts.append(v)
        return (" ".join(parts)).lower()
    working["_text"] = working.apply(row_text, axis=1)

    for interest in interests:
        emb = get_embedding(interest)
        if not emb:
            continue
        used += 1
        q = np.array(emb, dtype=np.float32).reshape(1, -1)
        qdim = q.shape[1]

        def sim(vec):
            if isinstance(vec, list) and len(vec) == qdim:
                try:
                    return float(cosine_similarity([vec], q)[0][0])
                except Exception:
                    return 0.0
            return 0.0

        # vector similarity
        working["score"] += working["embedding"].apply(sim)

        # lightweight keyword boost
        needle = str(interest).lower().strip()
        if needle:
            working["score"] += working["_text"].apply(lambda s: 0.10 if needle in s else 0.0)

    if used == 0:
        return []

    working["score"] /= used

    # keep only positive-scoring rows if any; else just take top few
    positive = working[working["score"] > 0]
    top = (positive if not positive.empty else working).nlargest(5, "score")

    # cleanup helper column
    top = top.drop(columns=["_text"], errors="ignore")

    return top.to_dict(orient="records")
