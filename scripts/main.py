from typing import List, Dict, Any, Optional
import os
import json
from pathlib import Path
from ast import literal_eval
import logging, traceback, time as _time

import numpy as np
import pandas as pd
from fastapi import FastAPI, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from openai import OpenAI
from sklearn.metrics.pairwise import cosine_similarity
from langchain_community.vectorstores import FAISS

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY not set")

EMBED_MODEL = "text-embedding-3-small"
client = OpenAI(api_key=OPENAI_API_KEY)

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent
SRC = PROJECT_ROOT / "app" / "assets" / "all_rso_data.json"
FAISS_DIR = (HERE / "faculty_faiss_index").resolve()

if not SRC.exists():
    raise FileNotFoundError(f"JSON file not found at {SRC}")

retriever: Optional[Any] = None

def _coerce_embedding(x):
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

def _load_df() -> pd.DataFrame:
    df = pd.read_json(SRC)
    if "embedding" in df.columns:
        df["embedding"] = df["embedding"].apply(_coerce_embedding)
    else:
        df["embedding"] = [[] for _ in range(len(df))]
    return df

df = _load_df()

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
    res = client.embeddings.create(input=[t], model=EMBED_MODEL)
    return res.data[0].embedding

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

def _load_docs_from_df(frame: pd.DataFrame) -> list:
    from langchain.docstore.document import Document
    docs = []
    if frame.empty:
        return docs
    for _, row in frame.fillna("").iterrows():
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
    return docs

class _DirectOpenAIEmbeddings:
    def embed_query(self, text: str):
        return get_embedding(text)
    def embed_documents(self, texts):
        return [get_embedding(t) for t in texts]

@app.on_event("startup")
def init_resources():
    global retriever
    try:
        if FAISS_DIR.exists():
            emb = _DirectOpenAIEmbeddings()
            index = FAISS.load_local(str(FAISS_DIR), emb, allow_dangerous_deserialization=True)
            if not callable(getattr(index, "embedding_function", None)):
                index.embedding_function = emb.embed_query
            retriever = index.as_retriever(search_type="similarity", search_kwargs={"k": 10})
            return
    except Exception:
        pass
    try:
        docs = _load_docs_from_df(df)
        if not docs:
            retriever = None
            return
        emb = _DirectOpenAIEmbeddings()
        index = FAISS.from_documents(docs, emb)
        if not callable(getattr(index, "embedding_function", None)):
            index.embedding_function = emb.embed_query
        FAISS_DIR.mkdir(parents=True, exist_ok=True)
        index.save_local(str(FAISS_DIR))
        retriever = index.as_retriever(search_type="similarity", search_kwargs={"k": 10})
    except Exception:
        retriever = None

@app.get("/healthz")
def healthz():
    return {
        "ok": True,
        "rows": int(df.shape[0]),
        "faiss_loaded": retriever is not None,
        "src": str(SRC),
        "faiss_dir": str(FAISS_DIR),
    }

@app.get("/")
def root():
    return healthz()

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
    interests = tags.get("interests") or []
    if not isinstance(interests, list) or not interests:
        raise HTTPException(status_code=400, detail="Provide 'interests' as a non-empty list.")
    if df.empty or "embedding" not in df.columns:
        return []
    working = df.copy()
    working["score"] = 0.0
    used = 0
    for interest in interests:
        emb = get_embedding(str(interest))
        if not emb:
            continue
        used += 1
        q = np.array(emb, dtype=np.float32).reshape(1, -1)
        def _sim(vec):
            if isinstance(vec, list) and len(vec) == len(emb):
                return float(cosine_similarity([vec], q)[0][0])
            return 0.0
        working["score"] += working["embedding"].apply(_sim)
    if used == 0:
        return []
    working["score"] /= used
    top = working.nlargest(5, "score")
    return top.to_dict(orient="records")
