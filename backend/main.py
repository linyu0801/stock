from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db import init_db
from api.stock import router as stock_router
from api.watchlist import router as watchlist_router

app = FastAPI(title="Taiwan Stock API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()

app.include_router(stock_router)
app.include_router(watchlist_router)

@app.get("/api/health")
def health():
    return {"status": "ok"}
