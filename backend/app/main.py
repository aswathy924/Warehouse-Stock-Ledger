
from fastapi import FastAPI
from sqlalchemy import text

from app.database import engine
from app.api.products import router as products_router
from app.api.locations import router as locations_router
from app.api.movements import router as movements_router


app = FastAPI(title="Warehouse Stock Ledger API")

app.include_router(products_router)
app.include_router(locations_router)
app.include_router(movements_router)


@app.get("/")
def root():
    return {"message": "Warehouse Stock Ledger API"}


@app.get("/health/db")
def database_health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    return {"database": "connected"}
