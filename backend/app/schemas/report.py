from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class LowStockItem(BaseModel):
    product_id: int
    sku: str
    name: str
    unit: str
    reorder_level: int
    current_stock: Decimal

    model_config = ConfigDict(from_attributes=True)


class ValuationItem(BaseModel):
    product_id: int
    sku: str
    name: str
    unit: str
    total_quantity: Decimal
    average_cost: Decimal
    total_value: Decimal

    model_config = ConfigDict(from_attributes=True)


class ValuationReport(BaseModel):
    items: list[ValuationItem]
    total_warehouse_value: Decimal


class LocationBalanceItem(BaseModel):
    location_id: int
    bin_code: str
    description: str
    balance: Decimal


class ProductBalanceSummary(BaseModel):
    product_id: int
    sku: str
    name: str
    unit: str
    total_balance: Decimal
    locations: list[LocationBalanceItem]


class ReconcileDriftItem(BaseModel):
    product_id: int
    sku: str
    location_id: int
    bin_code: str
    expected_balance: Decimal
    actual_balance: Decimal
    drift: Decimal


class ReconcileResponse(BaseModel):
    status: str
    drift_detected: bool
    total_records_checked: int
    drifts: list[ReconcileDriftItem]


class StockOverviewGridItem(BaseModel):
    product_id: int
    sku: str
    product_name: str
    unit: str
    location_id: int
    bin_code: str
    location_description: str
    quantity: Decimal
    unit_cost: Decimal
    total_value: Decimal

    model_config = ConfigDict(from_attributes=True)

