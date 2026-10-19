from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.report import LowStockItem, ValuationReport, ReconcileResponse
from app.services import movement_service


router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/low-stock", response_model=list[LowStockItem])
def low_stock_report(
    db: Session = Depends(get_db),
):
    return movement_service.get_low_stock_products(db)


@router.get("/valuation", response_model=ValuationReport)
def valuation_report(
    db: Session = Depends(get_db),
):
    return movement_service.get_valuation_report(db)


@router.post("/reconcile", response_model=ReconcileResponse)
def reconcile_ledger_post(
    db: Session = Depends(get_db),
):
    return movement_service.reconcile_stock_ledger(db)


@router.get("/reconcile", response_model=ReconcileResponse)
def reconcile_ledger_get(
    db: Session = Depends(get_db),
):
    return movement_service.reconcile_stock_ledger(db)
