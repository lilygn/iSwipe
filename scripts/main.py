from typing import List, Dict, Any
import os, time
from pathlib import Path

from fastapi import FastAPI, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
import pandas as pd
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from openai import OpenAI

load_dotenv()


PROJECT_ROOT = Path(__file__).resolve().parents[1] if (Path(__file__).parent.name == "scripts") else Path(__file__).resolve().parent
DATA_DIR = PROJECT_ROOT / "app" / "assets"
RSO_JSON = DATA_DIR / "all_rso_data.json"
embeddings = OpenAIEmbeddings()
index = FAISS.load_local(
    "faculty_faiss_index",
    embeddings,
    allow_dangerous_deserialization=True
)
retriever = index.as_retriever(search_type="similarity", search_kwargs={"k": 10})
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY not set")
client = OpenAI(api_key=OPENAI_API_KEY)
EMBED_MODEL = "text-embedding-3-small"


if RSO_JSON.exists():
    df = pd.read_json(RSO_JSON)
    if "embedding" not in df.columns:
        df["embedding"] = None
else:
    print(f"[startup] RSO JSON not found at {RSO_JSON}; /generate-cards will return []")
    df = pd.DataFrame([])

app = FastAPI(title="RSO & Faculty API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "ok": True,
        "has_retriever": retriever is not None,
        "rso_rows": int(df.shape[0]) if isinstance(df, pd.DataFrame) else 0
    }

def get_embedding(text: str) -> List[float]:
    t = (text or "").replace("\n", " ").strip()
    if not t:
        return []
    res = client.embeddings.create(input=[t], model=EMBED_MODEL)
    return res.data[0].embedding

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

@app.post("/warmup-rso-embeddings")
def warmup_rso_embeddings():
    if df.empty:
        raise HTTPException(500, "RSO dataset not available")
    working = df.copy()
    changed = False
    for i, row in working.iterrows():
        if isinstance(row.get("embedding"), list):
            continue
        name = row.get("name", "")
        desc = row.get("description", "")
        text = f"{name} | {desc}".strip()
        try:
            emb = get_embedding(text)
            working.at[i, "embedding"] = list(emb)
            changed = True
            time.sleep(0.15)
        except Exception as e:
            print(f"Failed on row {i}: {e}")
    if changed:
        working.to_json(RSO_JSON, orient="records", indent=2)
    return {"ok": True, "updated": bool(changed)}
