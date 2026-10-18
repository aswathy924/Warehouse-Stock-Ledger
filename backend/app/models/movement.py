
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Movement(Base):
    __tablename__ = "movements"

    __table_args__ = (
        CheckConstraint("quantity > 0",name="ck_movements_quantity_positive",),
        CheckConstraint("unit_cost >= 0",name="ck_movements_unit_cost_nonnegative",),
        CheckConstraint("movement_type IN ('IN', 'OUT', 'TRANSFER', 'ADJUSTMENT')",name="ck_movements_type_valid",),
    )

    id: Mapped[int] = mapped_column(Integer,primary_key=True,index=True,)
    movement_type: Mapped[str] = mapped_column(String(20),nullable=False,)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"),nullable=False,index=True,)
    from_location_id: Mapped[Optional[int]] = mapped_column(ForeignKey("locations.id"),nullable=True,)
    to_location_id: Mapped[Optional[int]] = mapped_column(ForeignKey("locations.id"),nullable=True,)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3),nullable=False,)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2),nullable=False,default=Decimal("0.00"),)
    reason: Mapped[Optional[str]] = mapped_column(String(100),nullable=True,)
    reference: Mapped[Optional[str]] = mapped_column(String(100),nullable=True,)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),nullable=False,default=lambda: datetime.now(timezone.utc),)

    created_by: Mapped[str] = mapped_column(String(100),nullable=False,)

    reverses_movement_id: Mapped[Optional[int]] = mapped_column(ForeignKey("movements.id"),nullable=True,unique=True,)
