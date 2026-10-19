from decimal import Decimal


def create_product(client, sku="SKU-001", name="Sugar", unit="kg", reorder_level=10):
    res = client.post(
        "/products",
        json={"sku": sku, "name": name, "unit": unit, "reorder_level": reorder_level},
    )
    assert res.status_code == 201
    return res.json()["id"]


def create_location(client, bin_code="BIN-A1", description="Aisle A Bin 1"):
    res = client.post(
        "/locations",
        json={"bin_code": bin_code, "description": description},
    )
    assert res.status_code == 201
    return res.json()["id"]


def test_api_transfer_movement_success(client):
    p_id = create_product(client, "SKU-TRF-1")
    l1 = create_location(client, "BIN-T1")
    l2 = create_location(client, "BIN-T2")

    client.post(
        "/movements/in",
        json={
            "product_id": p_id,
            "to_location_id": l1,
            "quantity": "10.000",
            "unit_cost": "20.00",
            "created_by": "tester",
        },
    )

    res = client.post(
        "/movements/transfer",
        json={
            "product_id": p_id,
            "from_location_id": l1,
            "to_location_id": l2,
            "quantity": "4.000",
            "reference": "TRF-TEST",
            "created_by": "tester",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["movement_type"] == "TRANSFER"
    assert data["from_location_id"] == l1
    assert data["to_location_id"] == l2
    assert Decimal(data["quantity"]) == Decimal("4.000")

    bal1 = client.get("/movements/balance", params={"product_id": p_id, "location_id": l1})
    bal2 = client.get("/movements/balance", params={"product_id": p_id, "location_id": l2})
    assert Decimal(str(bal1.json()["quantity"])) == Decimal("6.000")
    assert Decimal(str(bal2.json()["quantity"])) == Decimal("4.000")


def test_api_transfer_insufficient_stock_fails(client):
    p_id = create_product(client, "SKU-TRF-2")
    l1 = create_location(client, "BIN-T3")
    l2 = create_location(client, "BIN-T4")

    res = client.post(
        "/movements/transfer",
        json={
            "product_id": p_id,
            "from_location_id": l1,
            "to_location_id": l2,
            "quantity": "5.000",
            "created_by": "tester",
        },
    )
    assert res.status_code == 400
    assert "Insufficient stock" in res.json()["detail"]


def test_api_transfer_same_location_fails(client):
    p_id = create_product(client, "SKU-TRF-3")
    l1 = create_location(client, "BIN-T5")

    res = client.post(
        "/movements/transfer",
        json={
            "product_id": p_id,
            "from_location_id": l1,
            "to_location_id": l1,
            "quantity": "5.000",
            "created_by": "tester",
        },
    )
    assert res.status_code == 400
    assert "cannot be the same" in res.json()["detail"]


def test_api_positive_and_negative_adjustments(client):
    p_id = create_product(client, "SKU-ADJ-1")
    l1 = create_location(client, "BIN-ADJ-1")

    res_pos = client.post(
        "/movements/adjust",
        json={
            "product_id": p_id,
            "location_id": l1,
            "quantity": "8.000",
            "reason": "count correction",
            "created_by": "auditor",
        },
    )
    assert res_pos.status_code == 201
    assert res_pos.json()["movement_type"] == "ADJUSTMENT"
    assert res_pos.json()["to_location_id"] == l1

    bal = client.get("/movements/balance", params={"product_id": p_id, "location_id": l1})
    assert Decimal(str(bal.json()["quantity"])) == Decimal("8.000")

    res_neg = client.post(
        "/movements/adjust",
        json={
            "product_id": p_id,
            "location_id": l1,
            "quantity": "-3.000",
            "reason": "damaged",
            "created_by": "auditor",
        },
    )
    assert res_neg.status_code == 201
    assert res_neg.json()["movement_type"] == "ADJUSTMENT"
    assert res_neg.json()["from_location_id"] == l1

    bal2 = client.get("/movements/balance", params={"product_id": p_id, "location_id": l1})
    assert Decimal(str(bal2.json()["quantity"])) == Decimal("5.000")


def test_api_adjustment_other_with_note_validation(client):
    p_id = create_product(client, "SKU-ADJ-2")
    l1 = create_location(client, "BIN-ADJ-2")

    res = client.post(
        "/movements/adjust",
        json={
            "product_id": p_id,
            "location_id": l1,
            "quantity": "1.000",
            "reason": "other-with-note",
            "reference": "",
            "created_by": "auditor",
        },
    )
    assert res.status_code == 400
    assert "reference note is required" in res.json()["detail"]


def test_api_reverse_movement_and_prevent_double_reversal(client):
    p_id = create_product(client, "SKU-REV-1")
    l1 = create_location(client, "BIN-REV-1")
    in_res = client.post(
        "/movements/in",
        json={
            "product_id": p_id,
            "to_location_id": l1,
            "quantity": "10.000",
            "unit_cost": "15.00",
            "created_by": "tester",
        },
    )
    in_id = in_res.json()["id"]

    rev_res = client.post(
        f"/movements/{in_id}/reverse",
        json={"reason": "Incorrect invoice posted", "created_by": "manager"},
    )
    assert rev_res.status_code == 201
    assert rev_res.json()["reverses_movement_id"] == in_id

    bal = client.get("/movements/balance", params={"product_id": p_id, "location_id": l1})
    assert Decimal(str(bal.json()["quantity"])) == Decimal("0.000")

    single_res = client.get(f"/movements/{in_id}")
    assert single_res.status_code == 200
    assert single_res.json()["is_reversed"] is True

    double_rev = client.post(
        f"/movements/{in_id}/reverse",
        json={"created_by": "manager"},
    )
    assert double_rev.status_code == 400
    assert "already been reversed" in double_rev.json()["detail"]


def test_api_list_movements_with_filters(client):
    p1 = create_product(client, "SKU-HIST-1")
    p2 = create_product(client, "SKU-HIST-2")
    l1 = create_location(client, "BIN-HIST-1")

    client.post(
        "/movements/in",
        json={"product_id": p1, "to_location_id": l1, "quantity": "5.000", "unit_cost": "10.00", "created_by": "t1"},
    )
    client.post(
        "/movements/in",
        json={"product_id": p2, "to_location_id": l1, "quantity": "8.000", "unit_cost": "12.00", "created_by": "t1"},
    )

    res_p1 = client.get("/movements", params={"product_id": p1})
    assert res_p1.status_code == 200
    assert len(res_p1.json()) == 1
    assert res_p1.json()[0]["product_id"] == p1

    res_type = client.get("/movements", params={"movement_type": "IN"})
    assert res_type.status_code == 200
    assert len(res_type.json()) >= 2


def test_api_stock_overview_grid(client):
    p_id = create_product(client, "SKU-GRID-1")
    l_id = create_location(client, "BIN-GRID-1")

    client.post(
        "/movements/in",
        json={"product_id": p_id, "to_location_id": l_id, "quantity": "12.000", "unit_cost": "25.00", "created_by": "t1"},
    )

    grid_res = client.get("/movements/grid", params={"product_id": p_id, "location_id": l_id})
    assert grid_res.status_code == 200
    grid = grid_res.json()
    assert len(grid) == 1
    assert Decimal(str(grid[0]["quantity"])) == Decimal("12.000")
    assert Decimal(str(grid[0]["unit_cost"])) == Decimal("25.00")
    assert Decimal(str(grid[0]["total_value"])) == Decimal("300.00")



def test_api_reports_and_reconciliation(client):
    p_id = create_product(client, "SKU-REP-1", reorder_level=10)
    l_id = create_location(client, "BIN-REP-1")
    low_res = client.get("/reports/low-stock")
    assert low_res.status_code == 200
    assert any(item["product_id"] == p_id for item in low_res.json())

    client.post(
        "/movements/in",
        json={"product_id": p_id, "to_location_id": l_id, "quantity": "20.000", "unit_cost": "15.00", "created_by": "t1"},
    )
    low_res_after = client.get("/reports/low-stock")
    assert not any(item["product_id"] == p_id for item in low_res_after.json())

    val_res = client.get("/reports/valuation")
    assert val_res.status_code == 200
    assert Decimal(str(val_res.json()["total_warehouse_value"])) >= Decimal("300.00")
    rec_res = client.post("/reports/reconcile")
    assert rec_res.status_code == 200
    assert rec_res.json()["status"] == "consistent"
    assert rec_res.json()["drift_detected"] is False


def test_api_health_and_correlation_id_headers(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"
    assert "X-Correlation-ID" in res.headers

    custom_id = "test-corr-12345"
    res_custom = client.get("/health", headers={"X-Correlation-ID": custom_id})
    assert res_custom.status_code == 200
    assert res_custom.headers["X-Correlation-ID"] == custom_id
