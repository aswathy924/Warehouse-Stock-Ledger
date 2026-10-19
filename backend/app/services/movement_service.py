from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.location import Location
from app.models.movement import Movement
from app.schemas.movement import (
    StockInRequest,
    StockOutRequest,
    StockTransferRequest,
    StockAdjustmentRequest,
    VALID_ADJUSTMENT_REASONS,
)


def get_stock_balance(
    product_id: int,
    location_id: int,
    db: Session,
) -> Decimal:

    movements = db.scalars(select(Movement).where(Movement.product_id == product_id)).all()

    balance = Decimal("0")

    for movement in movements:
        if movement.to_location_id == location_id:
            balance += movement.quantity

        if movement.from_location_id == location_id:
            balance -= movement.quantity

    return balance


def get_total_stock_for_product(
    product_id: int,
    db: Session,
) -> Decimal:

    movements = db.scalars(select(Movement).where(Movement.product_id == product_id)).all()

    total = Decimal("0")
    for m in movements:
        if m.to_location_id is not None and m.from_location_id is None:
            total += m.quantity
        elif m.from_location_id is not None and m.to_location_id is None:
            total -= m.quantity

    return max(Decimal("0"), total)


def calculate_product_weighted_average_cost(
    product_id: int,
    db: Session,
) -> Decimal:

    movements = db.scalars(
        select(Movement)
        .where(Movement.product_id == product_id)
        .order_by(Movement.created_at.asc(), Movement.id.asc())
    ).all()

    current_qty = Decimal("0")
    current_avg = Decimal("0.00")

    for m in movements:
        if m.movement_type == "IN":
            in_qty = Decimal(str(m.quantity))
            in_cost = Decimal(str(m.unit_cost))
            if current_qty + in_qty > 0:
                total_val = (current_qty * current_avg) + (in_qty * in_cost)
                current_qty = current_qty + in_qty
                current_avg = (total_val / current_qty).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            else:
                current_qty = Decimal("0")
                current_avg = Decimal("0.00")
        elif m.movement_type == "OUT":
            out_qty = Decimal(str(m.quantity))
            current_qty = max(Decimal("0"), current_qty - out_qty)
        elif m.movement_type == "TRANSFER":
            pass
        elif m.movement_type == "ADJUSTMENT":
            if m.to_location_id is not None:
                current_qty += Decimal(str(m.quantity))
            elif m.from_location_id is not None:
                current_qty = max(Decimal("0"), current_qty - Decimal(str(m.quantity)))

    return current_avg


def stock_in(
    data: StockInRequest,
    db: Session,
) -> Movement:

    product = db.execute(select(Product).where(Product.id == data.product_id).with_for_update()).scalar_one_or_none()
    if product is None:
        raise ValueError("Product not found")

    location = db.get(Location, data.to_location_id)
    if location is None:
        raise ValueError("Destination location not found")

    if data.quantity <= Decimal("0"):
        raise ValueError("Quantity must be greater than zero")
    if data.unit_cost < Decimal("0"):
        raise ValueError("Unit cost cannot be negative")

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
    db: Session,
) -> Movement:
    product = db.execute(select(Product).where(Product.id == data.product_id).with_for_update()).scalar_one_or_none()
    if product is None:
        raise ValueError("Product not found")

    location = db.get(Location, data.from_location_id)
    if location is None:
        raise ValueError("Source location not found")

    if data.quantity <= Decimal("0"):
        raise ValueError("Quantity must be greater than zero")

    try:
        balance = get_stock_balance(data.product_id, data.from_location_id, db)
        if balance < data.quantity:
            raise ValueError(f"Insufficient stock. Available: {balance}")

        current_avg_cost = calculate_product_weighted_average_cost(data.product_id, db)

        movement = Movement(
            movement_type="OUT",
            product_id=data.product_id,
            from_location_id=data.from_location_id,
            to_location_id=None,
            quantity=data.quantity,
            unit_cost=current_avg_cost,
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


def stock_transfer(
    data: StockTransferRequest,
    db: Session,
) -> Movement:

    if data.from_location_id == data.to_location_id:
        raise ValueError("Source and destination locations cannot be the same")

    product = db.execute(select(Product).where(Product.id == data.product_id).with_for_update()).scalar_one_or_none()
    if product is None:
        raise ValueError("Product not found")

    source_loc = db.get(Location, data.from_location_id)
    if source_loc is None:
        raise ValueError("Source location not found")

    dest_loc = db.get(Location, data.to_location_id)
    if dest_loc is None:
        raise ValueError("Destination location not found")

    if data.quantity <= Decimal("0"):
        raise ValueError("Quantity must be greater than zero")

    try:
        balance = get_stock_balance(data.product_id, data.from_location_id, db)
        if balance < data.quantity:
            raise ValueError(f"Insufficient stock at source location. Available: {balance}")

        current_avg_cost = calculate_product_weighted_average_cost(data.product_id, db)

        movement = Movement(
            movement_type="TRANSFER",
            product_id=data.product_id,
            from_location_id=data.from_location_id,
            to_location_id=data.to_location_id,
            quantity=data.quantity,
            unit_cost=current_avg_cost,
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


def stock_adjustment(
    data: StockAdjustmentRequest,
    db: Session,
) -> Movement:

    if data.reason not in VALID_ADJUSTMENT_REASONS:
        raise ValueError(f"Invalid adjustment reason. Must be one of: {', '.join(sorted(VALID_ADJUSTMENT_REASONS))}")

    if data.reason == "other-with-note" and (not data.reference or not data.reference.strip()):
        raise ValueError("A reference note is required when reason is 'other-with-note'")

    if data.quantity == Decimal("0"):
        raise ValueError("Adjustment quantity cannot be zero")

    product = db.execute(select(Product).where(Product.id == data.product_id).with_for_update()).scalar_one_or_none()
    if product is None:
        raise ValueError("Product not found")

    location = db.get(Location, data.location_id)
    if location is None:
        raise ValueError("Location not found")

    try:
        current_avg_cost = calculate_product_weighted_average_cost(data.product_id, db)

        if data.quantity > Decimal("0"):
            from_loc = None
            to_loc = data.location_id
            adj_qty = data.quantity
        else:
            adj_qty = abs(data.quantity)
            balance = get_stock_balance(data.product_id, data.location_id, db)
            if balance < adj_qty:
                raise ValueError(f"Insufficient stock for negative adjustment. Available: {balance}")
            from_loc = data.location_id
            to_loc = None

        movement = Movement(
            movement_type="ADJUSTMENT",
            product_id=data.product_id,
            from_location_id=from_loc,
            to_location_id=to_loc,
            quantity=adj_qty,
            unit_cost=current_avg_cost,
            reason=data.reason,
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


def reverse_movement(
    movement_id: int,
    created_by: str,
    db: Session,
    reason: str | None = None,
) -> Movement:

    original = db.get(Movement, movement_id)
    if original is None:
        raise ValueError("Movement not found")

    if original.reverses_movement_id is not None:
        raise ValueError(f"Movement #{original.id} is already a reversal movement and cannot be reversed")

    existing_reversal = db.scalar(
        select(Movement).where(Movement.reverses_movement_id == original.id)
    )
    if existing_reversal is not None:
        raise ValueError(f"Movement #{original.id} has already been reversed by Movement #{existing_reversal.id}")

    product = db.execute(select(Product).where(Product.id == original.product_id).with_for_update()).scalar_one_or_none()
    if product is None:
        raise ValueError("Product not found")

    try:
        rev_reason = reason or f"Reversal of Movement #{original.id}"

        if original.movement_type == "IN":
            balance = get_stock_balance(original.product_id, original.to_location_id, db)
            if balance < original.quantity:
                raise ValueError(
                    f"Cannot reverse IN: insufficient stock at location (available: {balance}, required: {original.quantity})"
                )
            rev_from = original.to_location_id
            rev_to = None
            rev_type = "OUT"

        elif original.movement_type == "OUT":
            rev_from = None
            rev_to = original.from_location_id
            rev_type = "IN"

        elif original.movement_type == "TRANSFER":
            balance = get_stock_balance(original.product_id, original.to_location_id, db)
            if balance < original.quantity:
                raise ValueError(
                    f"Cannot reverse TRANSFER: destination location has insufficient stock (available: {balance}, required: {original.quantity})"
                )
            rev_from = original.to_location_id
            rev_to = original.from_location_id
            rev_type = "TRANSFER"

        elif original.movement_type == "ADJUSTMENT":
            if original.to_location_id is not None:
                balance = get_stock_balance(original.product_id, original.to_location_id, db)
                if balance < original.quantity:
                    raise ValueError(
                        f"Cannot reverse adjustment: insufficient stock at location (available: {balance}, required: {original.quantity})"
                    )
                rev_from = original.to_location_id
                rev_to = None
            else:
                rev_from = None
                rev_to = original.from_location_id
            rev_type = "ADJUSTMENT"
        else:
            raise ValueError(f"Unsupported movement type for reversal: {original.movement_type}")

        reversal = Movement(
            movement_type=rev_type,
            product_id=original.product_id,
            from_location_id=rev_from,
            to_location_id=rev_to,
            quantity=original.quantity,
            unit_cost=original.unit_cost,
            reason=rev_reason,
            reference=f"REV-{original.id}",
            created_by=created_by,
            reverses_movement_id=original.id,
        )

        db.add(reversal)
        db.commit()
        db.refresh(reversal)
        return reversal
    except Exception:
        db.rollback()
        raise


def is_movement_reversed(movement_id: int, db: Session) -> bool:
    return db.scalar(select(Movement.id).where(Movement.reverses_movement_id == movement_id)) is not None


def get_low_stock_products(db: Session) -> list[dict]:
    products = db.scalars(select(Product).order_by(Product.id)).all()
    results = []
    for p in products:
        current_stock = get_total_stock_for_product(p.id, db)
        if current_stock <= Decimal(str(p.reorder_level)):
            results.append({
                "product_id": p.id,
                "sku": p.sku,
                "name": p.name,
                "unit": p.unit,
                "reorder_level": p.reorder_level,
                "current_stock": current_stock,
            })
    return results


def get_valuation_report(db: Session) -> dict:
    products = db.scalars(select(Product).order_by(Product.id)).all()
    items = []
    total_val = Decimal("0.00")
    for p in products:
        current_stock = get_total_stock_for_product(p.id, db)
        avg_cost = calculate_product_weighted_average_cost(p.id, db)
        item_val = (current_stock * avg_cost).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total_val += item_val
        items.append({
            "product_id": p.id,
            "sku": p.sku,
            "name": p.name,
            "unit": p.unit,
            "total_quantity": current_stock,
            "average_cost": avg_cost,
            "total_value": item_val,
        })
    return {
        "items": items,
        "total_warehouse_value": total_val,
    }


def reconcile_stock_ledger(db: Session) -> dict:

    products = db.scalars(select(Product).order_by(Product.id)).all()
    locations = db.scalars(select(Location).order_by(Location.id)).all()

    total_records = 0
    drifts = []

    for p in products:
        for loc in locations:
            total_records += 1
            calculated_balance = get_stock_balance(p.id, loc.id, db)
            if calculated_balance < Decimal("0"):
                drifts.append({
                    "product_id": p.id,
                    "sku": p.sku,
                    "location_id": loc.id,
                    "bin_code": loc.bin_code,
                    "expected_balance": Decimal("0"),
                    "actual_balance": calculated_balance,
                    "drift": calculated_balance,
                })

    return {
        "status": "consistent" if not drifts else "drift_detected",
        "drift_detected": len(drifts) > 0,
        "total_records_checked": total_records,
        "drifts": drifts,
    }
