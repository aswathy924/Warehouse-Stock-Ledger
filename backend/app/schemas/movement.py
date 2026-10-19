
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


VALID_ADJUSTMENT_REASONS = (
    "damaged",
    "expired",
    "count correction",
    "theft",
    "other-with-note",
)


class StockInRequest(BaseModel):
    product_id: int = Field(gt=0)
    to_location_id: int = Field(gt=0)
    quantity: Decimal = Field(gt=0, max_digits=12, decimal_places=3)
    unit_cost: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    reference: str | None = Field(default=None, max_length=100)
    created_by: str = Field(min_length=1, max_length=100)


class StockOutRequest(BaseModel):
    product_id: int = Field(gt=0)
    from_location_id: int = Field(gt=0)
    quantity: Decimal = Field(gt=0, max_digits=12, decimal_places=3)
    reference: str | None = Field(default=None, max_length=100)
    created_by: str = Field(min_length=1, max_length=100)


class StockTransferRequest(BaseModel):
    product_id: int = Field(gt=0)
    from_location_id: int = Field(gt=0)
    to_location_id: int = Field(gt=0)
    quantity: Decimal = Field(gt=0, max_digits=12, decimal_places=3)
    reference: str | None = Field(default=None, max_length=100)
    created_by: str = Field(min_length=1, max_length=100)


class StockAdjustmentRequest(BaseModel):
    product_id: int = Field(gt=0)
    location_id: int = Field(gt=0)
    quantity: Decimal = Field(max_digits=12, decimal_places=3)
    reason: Literal["damaged", "expired", "count correction", "theft", "other-with-note"]
    reference: str | None = Field(default=None, max_length=100)
    created_by: str = Field(min_length=1, max_length=100)


class MovementReversalRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=100)
    created_by: str = Field(min_length=1, max_length=100)


class MovementResponse(BaseModel):
    id: int
    movement_type: str
    product_id: int
    from_location_id: int | None
    to_location_id: int | None
    quantity: Decimal
    unit_cost: Decimal
    reason: str | None
    reference: str | None
    created_at: datetime | None = None
    created_by: str
    reverses_movement_id: int | None
    is_reversed: bool = False

    model_config = ConfigDict(from_attributes=True)

