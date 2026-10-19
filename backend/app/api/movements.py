from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.movement import (
    StockInRequest,
    StockOutRequest,
    StockTransferRequest,
    StockAdjustmentRequest,
    MovementReversalRequest,
    MovementResponse,
)
from app.schemas.report import StockOverviewGridItem
from app.services import movement_service
from app.models.product import Product
from app.models.location import Location


router = APIRouter(prefix="/movements", tags=["Movements"])


@router.post("/in", response_model=MovementResponse, status_code=status.HTTP_201_CREATED)
def receive_stock(
    data: StockInRequest,
    db: Session = Depends(get_db),
):
    try:
        return movement_service.stock_in(data, db)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.post("/out", response_model=MovementResponse, status_code=status.HTTP_201_CREATED)
def dispatch_stock(
    data: StockOutRequest,
    db: Session = Depends(get_db),
):
    try:
        return movement_service.stock_out(data, db)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.post("/transfer", response_model=MovementResponse, status_code=status.HTTP_201_CREATED)
def transfer_stock(
    data: StockTransferRequest,
    db: Session = Depends(get_db),
):
    try:
        return movement_service.stock_transfer(data, db)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.post("/adjust", response_model=MovementResponse, status_code=status.HTTP_201_CREATED)
def adjust_stock(
    data: StockAdjustmentRequest,
    db: Session = Depends(get_db),
):
    try:
        return movement_service.stock_adjustment(data, db)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.post("/{movement_id}/reverse", response_model=MovementResponse, status_code=status.HTTP_201_CREATED)
def reverse_existing_movement(
    movement_id: int,
    data: MovementReversalRequest,
    db: Session = Depends(get_db),
):
    try:
        return movement_service.reverse_movement(
            movement_id=movement_id,
            created_by=data.created_by,
            db=db,
            reason=data.reason,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.get("", response_model=list[MovementResponse])
def get_movements_history(
    product_id: int | None = Query(default=None, gt=0),
    location_id: int | None = Query(default=None, gt=0),
    movement_type: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return movement_service.list_movements(
        db=db,
        product_id=product_id,
        location_id=location_id,
        movement_type=movement_type,
        limit=limit,
        offset=offset,
    )


@router.get("/balance")
def get_balance(
    product_id: int = Query(gt=0),
    location_id: int = Query(gt=0),
    db: Session = Depends(get_db),
):
    if db.get(Product, product_id) is None:
        raise HTTPException(status_code=404, detail="Product not found")

    if db.get(Location, location_id) is None:
        raise HTTPException(status_code=404, detail="Location not found")

    balance = movement_service.get_stock_balance(product_id, location_id, db)
    return {
        "product_id": product_id,
        "location_id": location_id,
        "quantity": balance,
    }


@router.get("/grid", response_model=list[StockOverviewGridItem])
def get_stock_overview_matrix(
    product_id: int | None = Query(default=None, gt=0),
    location_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
):
    return movement_service.get_stock_overview_grid(
        db=db,
        product_id=product_id,
        location_id=location_id,
    )


@router.get("/{movement_id}", response_model=MovementResponse)
def get_single_movement(
    movement_id: int,
    db: Session = Depends(get_db),
):
    movement = movement_service.get_movement_by_id(movement_id, db)
    if movement is None:
        raise HTTPException(status_code=404, detail="Movement not found")
    return movement
