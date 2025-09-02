from typing import List, Dict, Any, Optional
import os
from pathlib import Path

from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

import pandas as pd
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from openai import OpenAI

# ---- env ----
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY not set")
client = OpenAI(api_key=OPENAI_API_KEY)
EMBED_MODEL = "text-embedding-3-small"

# If running on Render with Root Directory = scripts, this still works:
HERE = Path(__file__).resolve().parent
PROJECT_ROOT = Path(__file__).resolve().parents[1] if HERE.name == "scripts" else HERE
DATA_DIR = PROJECT_ROOT / "app" / "assets"
RSO_JSON = DATA_DIR / "all_rso_data.json"

# Globals initialized on startup
retriever = None        # type: Optional[object]
df = pd.DataFrame([])

app = FastAPI(title="RSO & Faculty API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in prod
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_embedding(text: str) -> List[float]:
    t = (text or "").replace("\n", " ").strip()
    if not t:
        return []
    res = client.embeddings.create(input=[t], model=EMBED_MODEL)
    return res.data[0].embedding

@app.on_event("startup")
def init_resources():
    """Lazy init so import-time failures don't crash the container."""
    global retriever, df
    # Load dataframe
    if RSO_JSON.exists():
        df = pd.read_json(RSO_JSON)
        if "embedding" not in df.columns:
            df["embedding"] = None
    else:
        print(f"[startup] RSO JSON not found at {RSO_JSON}; /generate-cards will return []")
        df = pd.DataFrame([])

    # Build retriever from FAISS (optional)
    try:
        from langchain_openai import OpenAIEmbeddings
        from langchain_community.vectorstores import FAISS

        embeddings = OpenAIEmbeddings()  # uses OPENAI_API_KEY from env
        # Path may be relative to working dir (/app when container runs)
        index = FAISS.load_local(
            "faculty_faiss_index",
            embeddings,
            allow_dangerous_deserialization=True
        )
        retriever = index.as_retriever(search_type="similarity", search_kwargs={"k": 10})
        print("[startup] FAISS index loaded and retriever created.")
    except Exception as e:
        retriever = None
        print(f"[startup] Could not load FAISS index: {e}")

@app.get("/healthz")
def healthz():
    return {
        "ok": True,
        "has_retriever": retriever is not None,
        "rso_rows": int(df.shape[0]) if isinstance(df, pd.DataFrame) else 0
    }

@app.get("/")
def root():
    return healthz()

@app.post("/retrieve")
def retrieve(payload: Dict[str, Any] = Body(...)) -> List[Dict[str, Any]]:
    q = (payload.get("input") or "").strip()
    if not q or retriever is None:
        return []
    results = retriever.get_relevant_documents(q)
    out: List[Dict[str, Any]] = []
    for d in results:
        meta = d.metadata or {}
        out.append({
            "name": meta.get("name") or meta.get("title"),
            "description": d.page_content or "",
            "image": meta.get("image"),
            "link": meta.get("link") or meta.get("source") or meta.get("url"),
            "profileUrl": meta.get("profileUrl") or meta.get("profile_url"),
            "website": meta.get("website") or meta.get("personal_website"),
            "email": meta.get("email") or meta.get("contact_email") or meta.get("contact"),
            "interests": meta.get("interests") or meta.get("research_interests") or meta.get("areas_of_interest") or [],
        })
    return out

@app.post("/generate-cards")
def generate_cards(tags: Dict[str, Any] = Body(...)):
    interests: List[str] = tags.get("interests") or []
    if not interests or df.empty or "embedding" not in df.columns:
        return []
    working = df.copy()
    working["score"] = 0.0
    for interest in interests:
        query = np.array(get_embedding(interest), dtype=np.float32).reshape(1, -1)
        working["score"] += working["embedding"].apply(
            lambda vec: cosine_similarity([vec], query)[0][0] if isinstance(vec, list) else 0.0
        )
    working["score"] /= max(len(interests), 1)
    top = working.nlargest(5, "score")
    return top.to_dict(orient="records")
