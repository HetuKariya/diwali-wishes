import os
import random
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Diwali Wishes API")

# Comma-separated list of allowed frontends, e.g. "https://my-diwali.onrender.com"
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins],
    allow_methods=["*"],
    allow_headers=["*"],
)

WISHES: dict[str, dict] = {}  # in-memory store (resets on restart)

QUOTES = [
    "May the light of the diya brighten every corner of your life.",
    "Let the festival of lights fill your home with joy and prosperity.",
    "May Goddess Lakshmi bless you with happiness, health and wealth.",
    "Light a lamp of love, and let the darkness fade away.",
    "May this Diwali be the brightest and sweetest of your life.",
]


class WishIn(BaseModel):
    to_name: str = Field(min_length=1, max_length=40)
    from_name: str = Field(min_length=1, max_length=40)
    message: str = Field(default="", max_length=300)


@app.get("/")
def health():
    return {"status": "ok"}


@app.get("/api/quote")
def quote():
    return {"quote": random.choice(QUOTES)}


@app.post("/api/wishes")
def create_wish(wish: WishIn):
    wish_id = uuid.uuid4().hex[:8]
    WISHES[wish_id] = {**wish.model_dump(), "id": wish_id}
    return WISHES[wish_id]


@app.get("/api/wishes/{wish_id}")
def get_wish(wish_id: str):
    if wish_id not in WISHES:
        raise HTTPException(status_code=404, detail="Wish not found")
    return WISHES[wish_id]