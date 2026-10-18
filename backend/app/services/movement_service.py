from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.location import Location
from app.models.movement import Movement
from app.schemas.movement import StockInRequest, StockOutRequest

def get_stock_balance(
    product_id: int,
    location_id: int,
    db: Session,
):
    movements = db.scalars(select(Movement).where(Movement.product_id == product_id)).all()

    balance = 0

    for movement in movements:
        if movement.to_location_id == location_id:
            balance += movement.quantity

        if movement.from_location_id == location_id:
            balance -= movement.quantity

    return balance


def stock_in(
    data: StockInRequest,
    db: Session
) -> Movement:

    # Check that the product exists.
    product = db.get(Product, data.product_id)
    if product is None:
        raise ValueError("Product not found")

    # Check that the destination location exists.
    location = db.get(Location, data.to_location_id)
    if location is None:
        raise ValueError("Destination location not found")

    # Create a permanent stock-in record.
    movement = Movement(
        movement_type="IN",
        product_id=data.product_id,
        from_location_id=None,
        to_location_id=data.to_location_id,
        quantity=data.quantity,
        unit_cost=data.unit_cost,
        reference=data.reference,
        created_by=data.created_by,
    )

    try:
        db.add(movement)
        db.commit()
        db.refresh(movement)
        return movement    
    except Exception:
        db.rollback()
        raise

def stock_out(
    data: StockOutRequest,
    db: Session
) -> Movement:

    product = db.execute(select(Product).where(Product.id == data.product_id).with_for_update()).scalar_one_or_none()

    if product is None:
        raise ValueError("Product not found")

    location = db.get(Location, data.from_location_id)
    if location is None:
        raise ValueError("Source location not found")

    try:
        # The product lock ensures competing operations for this product
        # wait until the current transaction finishes.
        balance = get_stock_balance(data.product_id, data.from_location_id, db)

        if balance < data.quantity:
            raise ValueError(f"Insufficient stock. Available: {balance}")

        # Temporary cost calculation. Weighted-average costing comes next.
        movement = Movement(
            movement_type="OUT",
            product_id=data.product_id,
            from_location_id=data.from_location_id,
            quantity=data.quantity,
            unit_cost=0,
            reference=data.reference,
            created_by=data.created_by,
        )

        db.add(movement)
        db.commit()
        db.refresh(movement)
        return movement

    except Exception:
        db.rollback()
        raise
