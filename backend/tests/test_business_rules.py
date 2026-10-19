from decimal import Decimal
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models.product import Product
from app.models.location import Location
from app.models.movement import Movement
from app.schemas.movement import (
    StockInRequest,
    StockOutRequest,
    StockTransferRequest,
    StockAdjustmentRequest,
)
from app.services import movement_service


@pytest.fixture()
def db_session():
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=test_engine, autoflush=False, expire_on_commit=False)
    Base.metadata.create_all(bind=test_engine)

    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)
        test_engine.dispose()


def setup_sample_data(db):
    p = Product(sku="SKU-RICE-01", name="Basmati Rice", unit="kg", reorder_level=10)
    l1 = Location(bin_code="BIN-A1", description="Main Storage Bin A1")
    l2 = Location(bin_code="BIN-B1", description="Discharge Bin B1")
    db.add_all([p, l1, l2])
    db.commit()
    db.refresh(p)
    db.refresh(l1)
    db.refresh(l2)
    return p, l1, l2


def test_atomic_transfer_moves_stock_between_locations(db_session):
    p, l1, l2 = setup_sample_data(db_session)

    movement_service.stock_in(
        StockInRequest(
            product_id=p.id,
            to_location_id=l1.id,
            quantity=Decimal("20.000"),
            unit_cost=Decimal("50.00"),
            reference="PO-100",
            created_by="alice",
        ),
        db_session,
    )

    transfer = movement_service.stock_transfer(
        StockTransferRequest(
            product_id=p.id,
            from_location_id=l1.id,
            to_location_id=l2.id,
            quantity=Decimal("8.000"),
            reference="TRF-001",
            created_by="alice",
        ),
        db_session,
    )

    assert transfer.movement_type == "TRANSFER"
    assert transfer.from_location_id == l1.id
    assert transfer.to_location_id == l2.id
    assert transfer.quantity == Decimal("8.000")

    # Balances
    assert movement_service.get_stock_balance(p.id, l1.id, db_session) == Decimal("12.000")
    assert movement_service.get_stock_balance(p.id, l2.id, db_session) == Decimal("8.000")
    assert movement_service.get_total_stock_for_product(p.id, db_session) == Decimal("20.000")


def test_transfer_fails_when_insufficient_stock(db_session):
    p, l1, l2 = setup_sample_data(db_session)

    movement_service.stock_in(
        StockInRequest(
            product_id=p.id,
            to_location_id=l1.id,
            quantity=Decimal("5.000"),
            unit_cost=Decimal("10.00"),
            created_by="alice",
        ),
        db_session,
    )

    with pytest.raises(ValueError, match="Insufficient stock"):
        movement_service.stock_transfer(
            StockTransferRequest(
                product_id=p.id,
                from_location_id=l1.id,
                to_location_id=l2.id,
                quantity=Decimal("10.000"),
                created_by="alice",
            ),
            db_session,
        )


def test_transfer_rejects_same_source_and_destination(db_session):
    p, l1, _ = setup_sample_data(db_session)

    with pytest.raises(ValueError, match="cannot be the same"):
        movement_service.stock_transfer(
            StockTransferRequest(
                product_id=p.id,
                from_location_id=l1.id,
                to_location_id=l1.id,
                quantity=Decimal("5.000"),
                created_by="alice",
            ),
            db_session,
        )


def test_weighted_average_cost_calculated_and_stored_on_out(db_session):
    p, l1, _ = setup_sample_data(db_session)

    movement_service.stock_in(
        StockInRequest(
            product_id=p.id,
            to_location_id=l1.id,
            quantity=Decimal("10.000"),
            unit_cost=Decimal("20.00"),
            created_by="alice",
        ),
        db_session,
    )
    assert movement_service.calculate_product_weighted_average_cost(p.id, db_session) == Decimal("20.00")

    movement_service.stock_in(
        StockInRequest(
            product_id=p.id,
            to_location_id=l1.id,
            quantity=Decimal("10.000"),
            unit_cost=Decimal("30.00"),
            created_by="alice",
        ),
        db_session,
    )
    assert movement_service.calculate_product_weighted_average_cost(p.id, db_session) == Decimal("25.00")

    out_m = movement_service.stock_out(
        StockOutRequest(
            product_id=p.id,
            from_location_id=l1.id,
            quantity=Decimal("5.000"),
            created_by="alice",
        ),
        db_session,
    )
    assert out_m.unit_cost == Decimal("25.00")

    movement_service.stock_in(
        StockInRequest(
            product_id=p.id,
            to_location_id=l1.id,
            quantity=Decimal("10.000"),
            unit_cost=Decimal("40.00"),
            created_by="alice",
        ),
        db_session,
    )
    assert movement_service.calculate_product_weighted_average_cost(p.id, db_session) == Decimal("31.00")

    db_session.refresh(out_m)
    assert out_m.unit_cost == Decimal("25.00")


def test_zero_cost_in_handled_correctly(db_session):
    p, l1, _ = setup_sample_data(db_session)

    movement_service.stock_in(
        StockInRequest(
            product_id=p.id,
            to_location_id=l1.id,
            quantity=Decimal("10.000"),
            unit_cost=Decimal("10.00"),
            created_by="alice",
        ),
        db_session,
    )

    movement_service.stock_in(
        StockInRequest(
            product_id=p.id,
            to_location_id=l1.id,
            quantity=Decimal("10.000"),
            unit_cost=Decimal("0.00"),
            created_by="alice",
        ),
        db_session,
    )

    assert movement_service.calculate_product_weighted_average_cost(p.id, db_session) == Decimal("5.00")


def test_positive_adjustment_increases_stock(db_session):
    p, l1, _ = setup_sample_data(db_session)

    movement_service.stock_adjustment(
        StockAdjustmentRequest(
            product_id=p.id,
            location_id=l1.id,
            quantity=Decimal("5.000"),
            reason="count correction",
            reference="Found unrecorded stock on shelf",
            created_by="auditor",
        ),
        db_session,
    )

    assert movement_service.get_stock_balance(p.id, l1.id, db_session) == Decimal("5.000")


def test_negative_adjustment_reduces_stock_and_prevents_negative(db_session):
    p, l1, _ = setup_sample_data(db_session)

    # Stock-in 10
    movement_service.stock_in(
        StockInRequest(
            product_id=p.id,
            to_location_id=l1.id,
            quantity=Decimal("10.000"),
            unit_cost=Decimal("15.00"),
            created_by="alice",
        ),
        db_session,
    )

    movement_service.stock_adjustment(
        StockAdjustmentRequest(
            product_id=p.id,
            location_id=l1.id,
            quantity=Decimal("-3.000"),
            reason="damaged",
            created_by="auditor",
        ),
        db_session,
    )

    assert movement_service.get_stock_balance(p.id, l1.id, db_session) == Decimal("7.000")

    # Exceeding negative adjustment should fail
    with pytest.raises(ValueError, match="Insufficient stock"):
        movement_service.stock_adjustment(
            StockAdjustmentRequest(
                product_id=p.id,
                location_id=l1.id,
                quantity=Decimal("-10.000"),
                reason="theft",
                created_by="auditor",
            ),
            db_session,
        )


def test_adjustment_validates_reason_list_and_other_note(db_session):
    p, l1, _ = setup_sample_data(db_session)

    # Invalid reason caught by Pydantic schema validation
    with pytest.raises(Exception, match="Input should be 'damaged', 'expired', 'count correction', 'theft' or 'other-with-note'"):
        StockAdjustmentRequest(
            product_id=p.id,
            location_id=l1.id,
            quantity=Decimal("2.000"),
            reason="random reason",  # type: ignore
            created_by="alice",
        )

    with pytest.raises(ValueError, match="A reference note is required"):
        movement_service.stock_adjustment(
            StockAdjustmentRequest(
                product_id=p.id,
                location_id=l1.id,
                quantity=Decimal("2.000"),
                reason="other-with-note",
                reference="",
                created_by="alice",
            ),
            db_session,
        )


def test_reverse_in_movement(db_session):
    p, l1, _ = setup_sample_data(db_session)

    in_m = movement_service.stock_in(
        StockInRequest(
            product_id=p.id,
            to_location_id=l1.id,
            quantity=Decimal("10.000"),
            unit_cost=Decimal("25.00"),
            created_by="alice",
        ),
        db_session,
    )

    rev = movement_service.reverse_movement(in_m.id, created_by="manager", db=db_session)
    assert rev.reverses_movement_id == in_m.id
    assert movement_service.is_movement_reversed(in_m.id, db_session) is True
    # Balance should now be 0
    assert movement_service.get_stock_balance(p.id, l1.id, db_session) == Decimal("0.000")


def test_reverse_out_movement(db_session):
    p, l1, _ = setup_sample_data(db_session)

    movement_service.stock_in(
        StockInRequest(
            product_id=p.id,
            to_location_id=l1.id,
            quantity=Decimal("10.000"),
            unit_cost=Decimal("25.00"),
            created_by="alice",
        ),
        db_session,
    )

    out_m = movement_service.stock_out(
        StockOutRequest(
            product_id=p.id,
            from_location_id=l1.id,
            quantity=Decimal("4.000"),
            created_by="alice",
        ),
        db_session,
    )
    assert movement_service.get_stock_balance(p.id, l1.id, db_session) == Decimal("6.000")

    rev = movement_service.reverse_movement(out_m.id, created_by="manager", db=db_session)
    assert rev.reverses_movement_id == out_m.id
    assert movement_service.get_stock_balance(p.id, l1.id, db_session) == Decimal("10.000")


def test_double_reversal_is_rejected(db_session):
    p, l1, _ = setup_sample_data(db_session)

    in_m = movement_service.stock_in(
        StockInRequest(
            product_id=p.id,
            to_location_id=l1.id,
            quantity=Decimal("5.000"),
            unit_cost=Decimal("10.00"),
            created_by="alice",
        ),
        db_session,
    )

    movement_service.reverse_movement(in_m.id, created_by="manager", db=db_session)

    with pytest.raises(ValueError, match="already been reversed"):
        movement_service.reverse_movement(in_m.id, created_by="manager", db=db_session)


def test_reversing_a_reversal_is_rejected(db_session):
    p, l1, _ = setup_sample_data(db_session)

    in_m = movement_service.stock_in(
        StockInRequest(
            product_id=p.id,
            to_location_id=l1.id,
            quantity=Decimal("5.000"),
            unit_cost=Decimal("10.00"),
            created_by="alice",
        ),
        db_session,
    )

    reversal_m = movement_service.reverse_movement(in_m.id, created_by="manager", db=db_session)

    with pytest.raises(ValueError, match="already a reversal movement"):
        movement_service.reverse_movement(reversal_m.id, created_by="manager", db=db_session)


def test_reverse_in_rejected_if_stock_already_consumed(db_session):
    p, l1, _ = setup_sample_data(db_session)

    in_m = movement_service.stock_in(
        StockInRequest(
            product_id=p.id,
            to_location_id=l1.id,
            quantity=Decimal("10.000"),
            unit_cost=Decimal("10.00"),
            created_by="alice",
        ),
        db_session,
    )

    movement_service.stock_out(
        StockOutRequest(
            product_id=p.id,
            from_location_id=l1.id,
            quantity=Decimal("7.000"),
            created_by="bob",
        ),
        db_session,
    )

    with pytest.raises(ValueError, match="insufficient stock"):
        movement_service.reverse_movement(in_m.id, created_by="manager", db=db_session)


def test_low_stock_report_detects_products_below_reorder_level(db_session):
    p, l1, _ = setup_sample_data(db_session)  # reorder_level = 10

    low_stock = movement_service.get_low_stock_products(db_session)
    assert len(low_stock) == 1
    assert low_stock[0]["product_id"] == p.id

    movement_service.stock_in(
        StockInRequest(
            product_id=p.id,
            to_location_id=l1.id,
            quantity=Decimal("15.000"),
            unit_cost=Decimal("10.00"),
            created_by="alice",
        ),
        db_session,
    )
    assert len(movement_service.get_low_stock_products(db_session)) == 0


def test_valuation_report_matches_wac_multiplied_by_stock(db_session):
    p, l1, _ = setup_sample_data(db_session)

    movement_service.stock_in(
        StockInRequest(
            product_id=p.id,
            to_location_id=l1.id,
            quantity=Decimal("10.000"),
            unit_cost=Decimal("20.00"),
            created_by="alice",
        ),
        db_session,
    )

    movement_service.stock_in(
        StockInRequest(
            product_id=p.id,
            to_location_id=l1.id,
            quantity=Decimal("10.000"),
            unit_cost=Decimal("40.00"),
            created_by="alice",
        ),
        db_session,
    )

    report = movement_service.get_valuation_report(db_session)
    assert report["total_warehouse_value"] == Decimal("600.00")
    assert report["items"][0]["average_cost"] == Decimal("30.00")
    assert report["items"][0]["total_quantity"] == Decimal("20.000")


def test_reconcile_consistent_ledger(db_session):
    p, l1, l2 = setup_sample_data(db_session)

    movement_service.stock_in(
        StockInRequest(
            product_id=p.id,
            to_location_id=l1.id,
            quantity=Decimal("10.000"),
            unit_cost=Decimal("10.00"),
            created_by="alice",
        ),
        db_session,
    )

    res = movement_service.reconcile_stock_ledger(db_session)
    assert res["status"] == "consistent"
    assert res["drift_detected"] is False
    assert res["total_records_checked"] == 2


def test_concurrent_outs_racing_for_units():
    import concurrent.futures

    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=test_engine, autoflush=False, expire_on_commit=False)
    Base.metadata.create_all(bind=test_engine)

    init_db = TestingSession()
    p = Product(sku="SKU-RACE", name="Race Rice", unit="kg", reorder_level=5)
    l1 = Location(bin_code="BIN-RACE", description="Race Bin")
    init_db.add_all([p, l1])
    init_db.commit()
    prod_id = p.id
    loc_id = l1.id

    movement_service.stock_in(
        StockInRequest(
            product_id=prod_id,
            to_location_id=loc_id,
            quantity=Decimal("10.000"),
            unit_cost=Decimal("20.00"),
            created_by="alice",
        ),
        init_db,
    )
    init_db.close()

    def try_dispatch(worker_id):
        worker_db = TestingSession()
        try:
            m = movement_service.stock_out(
                StockOutRequest(
                    product_id=prod_id,
                    from_location_id=loc_id,
                    quantity=Decimal("7.000"),
                    reference=f"RACE-{worker_id}",
                    created_by=f"worker_{worker_id}",
                ),
                worker_db,
            )
            return ("SUCCESS", m.id)
        except ValueError as err:
            return ("FAILED", str(err))
        finally:
            worker_db.close()

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(try_dispatch, 1)
        f2 = executor.submit(try_dispatch, 2)
        results = [f1.result(), f2.result()]

    statuses = [r[0] for r in results]
    assert "SUCCESS" in statuses
    assert "FAILED" in statuses

    verify_db = TestingSession()
    final_balance = movement_service.get_stock_balance(prod_id, loc_id, verify_db)
    verify_db.close()
    assert final_balance == Decimal("3.000")



def test_reconcile_detects_drift_when_ledger_corrupted(db_session):
    p, l1, _ = setup_sample_data(db_session)

    corrupt_m = Movement(
        movement_type="OUT",
        product_id=p.id,
        from_location_id=l1.id,
        to_location_id=None,
        quantity=Decimal("15.000"),
        unit_cost=Decimal("0.00"),
        created_by="hacker",
    )
    db_session.add(corrupt_m)
    db_session.commit()

    res = movement_service.reconcile_stock_ledger(db_session)
    assert res["status"] == "drift_detected"
    assert res["drift_detected"] is True
    assert len(res["drifts"]) >= 1
    assert res["drifts"][0]["product_id"] == p.id

