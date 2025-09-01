from typing import List
from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from langchain.vectorstores import FAISS
from langchain.embeddings import OpenAIEmbeddings

load_dotenv()

embeddings = OpenAIEmbeddings()
index = FAISS.load_local(
    "faculty_faiss_index",
    embeddings,
    allow_dangerous_deserialization=True
)

retriever = index.as_retriever(search_type="similarity", search_kwargs={"k": 10})

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/retrieve")
def retrieve(payload: dict = Body(...)):
    q = (payload.get("input") or "").strip()
    if not q:
        return []

    results = retriever.get_relevant_documents(q)
    print(f"Retrieved {len(results)} docs for '{q}'")

    out: List[dict] = []
    for d in results:
        meta = d.metadata or {}
        out.append({
            "name": meta.get("name") or meta.get("title"),
            "description": d.page_content or "",
            "image": meta.get("image") or meta.get("image"),
            "link": meta.get("link") or meta.get("source") or meta.get("url"),
            "profileUrl": meta.get("profileUrl") or meta.get("profile_url"),
            "website": meta.get("website") or meta.get("personal_website"),
            "email": meta.get("email") or meta.get("contact_email") or meta.get("contact"),
            "interests": meta.get("interests") or meta.get("research_interests") or meta.get("areas_of_interest") or [],
        })
    return out
