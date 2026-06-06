from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from ga_engine import run_ga

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RouteRequest(BaseModel):
    budget_maks: int = 150000
    jam_mulai: float = 8.0
    banned_locations: List[str] = []
    liked_locations: List[str] = []

@app.post("/api/generate_route")
def generate_route(req: RouteRequest):
    try:
        result = run_ga(
            budget_maks=req.budget_maks,
            jam_mulai=req.jam_mulai,
            banned_locations=req.banned_locations,
            liked_locations=req.liked_locations,
            n_gen=300
        )
        return result
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}

@app.get("/")
def health_check():
    return {"status": "ok"}
