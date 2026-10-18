from decimal import Decimal


def create_product(client):
    response = client.post(
        "/products",
        json={
            "sku": "RICE-001",
            "name": "Rice",
            "unit": "kg",
            "reorder_level": 5,
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def create_location(client):
    response = client.post(
        "/locations",
        json={
            "bin_code": "A-01",
            "description": "Storage bin A-01",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_stock_in_creates_movement_and_increases_balance(client):
    product_id = create_product(client)
    location_id = create_location(client)

    response = client.post(
        "/movements/in",
        json={
            "product_id": product_id,
            "to_location_id": location_id,
            "quantity": "10.000",
            "unit_cost": "25.00",
            "reference": "PO-001",
            "created_by": "tester",
        },
    )

    assert response.status_code == 201
    movement = response.json()
    assert movement["movement_type"] == "IN"
    assert movement["product_id"] == product_id
    assert movement["to_location_id"] == location_id
    assert Decimal(movement["quantity"]) == Decimal("10.000")
    assert Decimal(movement["unit_cost"]) == Decimal("25.00")

    balance_response = client.get(
        "/movements/balance",
        params={
            "product_id": product_id,
            "location_id": location_id,
        },
    )

    assert balance_response.status_code == 200
    assert Decimal(str(balance_response.json()["quantity"])) == Decimal("10.000")


def test_stock_out_reduces_balance(client):
    product_id = create_product(client)
    location_id = create_location(client)

    stock_in_response = client.post(
        "/movements/in",
        json={
            "product_id": product_id,
            "to_location_id": location_id,
            "quantity": "10.000",
            "unit_cost": "25.00",
            "created_by": "tester",
        },
    )
    assert stock_in_response.status_code == 201

    stock_out_response = client.post(
        "/movements/out",
        json={
            "product_id": product_id,
            "from_location_id": location_id,
            "quantity": "3.000",
            "reference": "SO-001",
            "created_by": "tester",
        },
    )

    assert stock_out_response.status_code == 201
    assert stock_out_response.json()["movement_type"] == "OUT"

    balance_response = client.get(
        "/movements/balance",
        params={
            "product_id": product_id,
            "location_id": location_id,
        },
    )

    assert balance_response.status_code == 200
    assert Decimal(str(balance_response.json()["quantity"])) == Decimal("7.000")


def test_stock_out_rejects_insufficient_stock(client):
    product_id = create_product(client)
    location_id = create_location(client)

    client.post(
        "/movements/in",
        json={
            "product_id": product_id,
            "to_location_id": location_id,
            "quantity": "5.000",
            "unit_cost": "10.00",
            "created_by": "tester",
        },
    )

    response = client.post(
        "/movements/out",
        json={
            "product_id": product_id,
            "from_location_id": location_id,
            "quantity": "6.000",
            "created_by": "tester",
        },
    )

    assert response.status_code == 400
    assert "Insufficient stock" in response.json()["detail"]

    balance_response = client.get(
        "/movements/balance",
        params={
            "product_id": product_id,
            "location_id": location_id,
        },
    )

    assert balance_response.status_code == 200
    assert Decimal(str(balance_response.json()["quantity"])) == Decimal("5.000")


def test_stock_in_rejects_unknown_product(client):
    location_id = create_location(client)

    response = client.post(
        "/movements/in",
        json={
            "product_id": 9999,
            "to_location_id": location_id,
            "quantity": "5.000",
            "unit_cost": "10.00",
            "created_by": "tester",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Product not found"


def test_stock_in_rejects_unknown_location(client):
    product_id = create_product(client)

    response = client.post(
        "/movements/in",
        json={
            "product_id": product_id,
            "to_location_id": 9999,
            "quantity": "5.000",
            "unit_cost": "10.00",
            "created_by": "tester",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Destination location not found"


def test_stock_out_rejects_unknown_product(client):
    location_id = create_location(client)

    response = client.post(
        "/movements/out",
        json={
            "product_id": 9999,
            "from_location_id": location_id,
            "quantity": "1.000",
            "created_by": "tester",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Product not found"


def test_balance_rejects_unknown_product(client):
    location_id = create_location(client)

    response = client.get(
        "/movements/balance",
        params={
            "product_id": 9999,
            "location_id": location_id,
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Product not found"


def test_balance_rejects_unknown_location(client):
    product_id = create_product(client)

    response = client.get(
        "/movements/balance",
        params={
            "product_id": product_id,
            "location_id": 9999,
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Location not found"


def test_stock_in_rejects_zero_quantity(client):
    product_id = create_product(client)
    location_id = create_location(client)

    response = client.post(
        "/movements/in",
        json={
            "product_id": product_id,
            "to_location_id": location_id,
            "quantity": "0",
            "unit_cost": "10.00",
            "created_by": "tester",
        },
    )

    assert response.status_code == 422


def test_stock_in_rejects_negative_quantity(client):
    product_id = create_product(client)
    location_id = create_location(client)

    response = client.post(
        "/movements/in",
        json={
            "product_id": product_id,
            "to_location_id": location_id,
            "quantity": "-2",
            "unit_cost": "10.00",
            "created_by": "tester",
        },
    )

    assert response.status_code == 422


def test_stock_in_rejects_negative_unit_cost(client):
    product_id = create_product(client)
    location_id = create_location(client)

    response = client.post(
        "/movements/in",
        json={
            "product_id": product_id,
            "to_location_id": location_id,
            "quantity": "2",
            "unit_cost": "-1.00",
            "created_by": "tester",
        },
    )

    assert response.status_code == 422


def test_stock_out_rejects_zero_quantity(client):
    product_id = create_product(client)
    location_id = create_location(client)

    response = client.post(
        "/movements/out",
        json={
            "product_id": product_id,
            "from_location_id": location_id,
            "quantity": "0",
            "created_by": "tester",
        },
    )

    assert response.status_code == 422
