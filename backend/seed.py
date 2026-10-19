import sys
from decimal import Decimal
from sqlalchemy import select

from app.database import SessionLocal, Base, engine
from app.models.product import Product
from app.models.location import Location
from app.models.movement import Movement
from app.services import movement_service
from app.schemas.movement import (
    StockInRequest,
    StockOutRequest,
    StockTransferRequest,
    StockAdjustmentRequest,
)


def seed():
    print("Connecting to database and preparing tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Check if already seeded
        existing_products = db.scalars(select(Product)).first()
        if existing_products:
            print("Database already contains data.")
            if "--reset" in sys.argv:
                print("Reset flag detected: clearing existing movements, products, locations...")
                db.query(Movement).delete()
                db.query(Product).delete()
                db.query(Location).delete()
                db.commit()
            else:
                print("Skipping seed. Pass '--reset' to wipe and reseed.")
                return

        print("Creating realistic warehouse locations...")
        locations_data = [
            {"bin_code": "BIN-A01", "description": "Bulk Grain Pallet Rack A1"},
            {"bin_code": "BIN-A02", "description": "Bulk Grain Pallet Rack A2"},
            {"bin_code": "BIN-B01", "description": "Liquids & Oils Storage Bay B1"},
            {"bin_code": "BIN-C01", "description": "Packaged Goods Shelf C1"},
            {"bin_code": "BIN-STAGE", "description": "Loading Dock Staging Area"},
        ]

        loc_map = {}
        for l in locations_data:
            loc = Location(bin_code=l["bin_code"], description=l["description"])
            db.add(loc)
            db.commit()
            db.refresh(loc)
            loc_map[loc.bin_code] = loc
            print(f"  + Location [{loc.bin_code}] (ID: {loc.id}): {loc.description}")

        print("\nCreating realistic distributor products...")
        products_data = [
            {"sku": "RICE-BASMATI-001", "name": "Royal Basmati Rice", "unit": "kg", "reorder_level": 50},
            {"sku": "OIL-SUNFLOWER-001", "name": "Refined Sunflower Oil", "unit": "litre", "reorder_level": 30},
            {"sku": "FLOUR-WHEAT-001", "name": "Stoneground Whole Wheat Atta", "unit": "kg", "reorder_level": 40},
            {"sku": "SUGAR-CANE-001", "name": "Pure Cane White Sugar", "unit": "kg", "reorder_level": 25},
            {"sku": "SALT-IODIZED-001", "name": "Refined Iodized Table Salt", "unit": "kg", "reorder_level": 15},
        ]

        prod_map = {}
        for p in products_data:
            prod = Product(sku=p["sku"], name=p["name"], unit=p["unit"], reorder_level=p["reorder_level"])
            db.add(prod)
            db.commit()
            db.refresh(prod)
            prod_map[prod.sku] = prod
            print(f"  + Product [{prod.sku}] (ID: {prod.id}): {prod.name} ({prod.unit})")

        print("\nRecording initial stock movements (IN, TRANSFER, OUT, ADJUSTMENT)...")

        # 1. Receive Basmati Rice: Batch 1 (100 kg @ 45.00)
        movement_service.stock_in(
            StockInRequest(
                product_id=prod_map["RICE-BASMATI-001"].id,
                to_location_id=loc_map["BIN-A01"].id,
                quantity=Decimal("100.000"),
                unit_cost=Decimal("45.00"),
                reference="INV-2026-001",
                created_by="warehouse_seed",
            ),
            db,
        )

        # 2. Receive Basmati Rice: Batch 2 (100 kg @ 55.00) -> WAC becomes 50.00
        movement_service.stock_in(
            StockInRequest(
                product_id=prod_map["RICE-BASMATI-001"].id,
                to_location_id=loc_map["BIN-A01"].id,
                quantity=Decimal("100.000"),
                unit_cost=Decimal("55.00"),
                reference="INV-2026-002",
                created_by="warehouse_seed",
            ),
            db,
        )

        # 3. Receive Sunflower Oil: 80 litres @ 110.00
        movement_service.stock_in(
            StockInRequest(
                product_id=prod_map["OIL-SUNFLOWER-001"].id,
                to_location_id=loc_map["BIN-B01"].id,
                quantity=Decimal("80.000"),
                unit_cost=Decimal("110.00"),
                reference="INV-2026-003",
                created_by="warehouse_seed",
            ),
            db,
        )

        # 4. Receive Wheat Flour: 120 kg @ 35.00
        movement_service.stock_in(
            StockInRequest(
                product_id=prod_map["FLOUR-WHEAT-001"].id,
                to_location_id=loc_map["BIN-A02"].id,
                quantity=Decimal("120.000"),
                unit_cost=Decimal("35.00"),
                reference="INV-2026-004",
                created_by="warehouse_seed",
            ),
            db,
        )

        # 5. Receive Sugar: 60 kg @ 42.00
        movement_service.stock_in(
            StockInRequest(
                product_id=prod_map["SUGAR-CANE-001"].id,
                to_location_id=loc_map["BIN-C01"].id,
                quantity=Decimal("60.000"),
                unit_cost=Decimal("42.00"),
                reference="INV-2026-005",
                created_by="warehouse_seed",
            ),
            db,
        )

        # Note: Salt has 0 initial stock to test the Low-Stock Alert report!

        # 6. Transfer 40 kg Rice from BIN-A01 to Staging BIN-STAGE
        movement_service.stock_transfer(
            StockTransferRequest(
                product_id=prod_map["RICE-BASMATI-001"].id,
                from_location_id=loc_map["BIN-A01"].id,
                to_location_id=loc_map["BIN-STAGE"].id,
                quantity=Decimal("40.000"),
                reference="TRF-STAGE-01",
                created_by="warehouse_seed",
            ),
            db,
        )

        # 7. Dispatch 25 kg Rice from BIN-STAGE (Sales Order)
        movement_service.stock_out(
            StockOutRequest(
                product_id=prod_map["RICE-BASMATI-001"].id,
                from_location_id=loc_map["BIN-STAGE"].id,
                quantity=Decimal("25.000"),
                reference="SO-DELIV-001",
                created_by="warehouse_seed",
            ),
            db,
        )

        # 8. Dispatch 15 litres Oil from BIN-B01
        movement_service.stock_out(
            StockOutRequest(
                product_id=prod_map["OIL-SUNFLOWER-001"].id,
                from_location_id=loc_map["BIN-B01"].id,
                quantity=Decimal("15.000"),
                reference="SO-DELIV-002",
                created_by="warehouse_seed",
            ),
            db,
        )

        # 9. Stock Adjustment: 1 kg Flour damaged by torn sack
        movement_service.stock_adjustment(
            StockAdjustmentRequest(
                product_id=prod_map["FLOUR-WHEAT-001"].id,
                location_id=loc_map["BIN-A02"].id,
                quantity=Decimal("-1.000"),
                reason="damaged",
                reference="Bag punctured during fork handling",
                created_by="auditor",
            ),
            db,
        )

        # 10. Stock Adjustment: Found 2 extra kg Sugar during count
        movement_service.stock_adjustment(
            StockAdjustmentRequest(
                product_id=prod_map["SUGAR-CANE-001"].id,
                location_id=loc_map["BIN-C01"].id,
                quantity=Decimal("2.000"),
                reason="count correction",
                reference="Physical count showed 62kg instead of 60kg",
                created_by="auditor",
            ),
            db,
        )

        print("\nSeed completed successfully!")
        val = movement_service.get_valuation_report(db)
        print(f"Total Warehouse Valuation: Rs. {val['total_warehouse_value']}")
        low_stock = movement_service.get_low_stock_products(db)
        print(f"Low Stock Alerts: {[item['sku'] for item in low_stock]}")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
