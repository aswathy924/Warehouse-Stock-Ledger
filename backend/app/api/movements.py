from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.movement import (
    StockInRequest,
    StockOutRequest,
    MovementResponse,
)
from app.services.movement_service import stock_in, stock_out
from app.models.product import Product
from app.models.location import Location
from app.models.movement import Movement


router = APIRouter(prefix="/movements", tags=["Movements"])


@router.post("/in", response_model=MovementResponse, status_code=201)
def receive_stock(
    data: StockInRequest,
    db: Session = Depends(get_db),
):
    try:
        return stock_in(data, db)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.post("/out", response_model=MovementResponse, status_code=201)
def dispatch_stock(
    data: StockOutRequest,
    db: Session = Depends(get_db),
):
    try:
        return stock_out(data, db)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.get("/balance")
def get_balance(
    product_id: int = Query(gt=0),
    location_id: int = Query(gt=0),
    db: Session = Depends(get_db),
):
    # Confirm the product exists.
    if db.get(Product, product_id) is None:
        raise HTTPException(status_code=404, detail="Product not found")

    # Confirm the location exists.
    if db.get(Location, location_id) is None:
        raise HTTPException(status_code=404, detail="Location not found")

    # Read the movement history for this product.
    movements = db.scalars(select(Movement).where(Movement.product_id == product_id)).all()

    balance = Decimal("0")

    for movement in movements:
        if movement.to_location_id == location_id:
            balance += movement.quantity

        if movement.from_location_id == location_id:
            balance -= movement.quantity

    return {
        "product_id": product_id,
        "location_id": location_id,
        "quantity": balance,
    }
