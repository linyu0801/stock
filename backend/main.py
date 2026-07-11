import threading
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db import init_db
from api.stock import router as stock_router
from api.watchlist import router as watchlist_router
from api.backtest import router as backtest_router
from api.market import router as market_router
from api.fundamentals import router as fundamentals_router
from api.disposition import router as disposition_router
from api.etf import router as etf_router
from services.stock_meta import sync_stock_list

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
    threading.Thread(target=sync_stock_list, daemon=True).start()

app.include_router(stock_router)
app.include_router(watchlist_router)
app.include_router(backtest_router)
app.include_router(market_router)
app.include_router(fundamentals_router)
app.include_router(disposition_router)
app.include_router(etf_router)

@app.get("/api/health")
def health():
    return {"status": "ok"}
