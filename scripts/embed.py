import openai
import pandas as pd
import numpy as np
import os
import time
from fastapi import FastAPI, HTTPException, Request
from sklearn.metrics.pairwise import cosine_similarity
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from openai import OpenAI
from pathlib import Path

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
SRC = BASE_DIR.parent / "app" / "assets" / "all_rso_data.json"

MODEL = "text-embedding-3-small"
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

df = pd.read_json(SRC)

@app.post("/generate-cards")
async def generate_cards(tags: dict):
    interests = tags["interests"]
    df["score"] = 0.0
    for interest in interests:
        query = get_embedding(interest)
        query_vec = np.array(query, dtype=np.float32).reshape(1, -1)
        df["score"] += df["embedding"].apply(
            lambda vec: cosine_similarity([vec], query_vec)[0][0]
        )
    df["score"] /= len(interests)
    top = df.nlargest(5, "score")
    return top.to_dict(orient="records")

def get_embedding(text, model=MODEL):
    text = text.replace("\n", " ").strip()
    res = client.embeddings.create(input=[text], model=model)
    return res.data[0].embedding

def main():
    df = pd.read_json(SRC)
    if "embedding" not in df.columns:
        df["embedding"] = None
    for i, row in df.iterrows():
        if isinstance(row.get("embedding"), list):
            continue
        name = row.get("name", "")
        desc = row.get("description", "")
        text = f"{name} | {desc}".strip()
        try:
            embedding = get_embedding(text)
            df.at[i, "embedding"] = list(embedding)
            print(f"Embedded: {name}")
            time.sleep(0.2)
        except Exception as e:
            print(f"Failed on row {i}: {e}")
            continue
    df.to_json(SRC, orient="records", indent=2)
    print(f"Embeddings saved to: {SRC}")

if __name__ == "__main__":
    main()
