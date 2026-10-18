def test_create_product(client):
    response = client.post(
        "/products",
        json={
            "sku": "TEST-001",
            "name": "Rice",
            "unit": "kg",
            "reorder_level": 5,
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["sku"] == "TEST-001"
    assert data["name"] == "Rice"
    assert data["unit"] == "kg"
    assert data["reorder_level"] == 5
    assert "id" in data


def test_list_products(client):
    client.post(
        "/products",
        json={
            "sku": "TEST-002",
            "name": "Sugar",
            "unit": "kg",
            "reorder_level": 3,
        },
    )

    response = client.get("/products")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["sku"] == "TEST-002"


def test_duplicate_product_sku_is_rejected(client):
    payload = {
        "sku": "DUP-001",
        "name": "Rice",
        "unit": "kg",
        "reorder_level": 5,
    }

    first = client.post("/products", json=payload)
    second = client.post(
        "/products",
        json={**payload, "name": "Different Rice"},
    )

    assert first.status_code == 201
    assert second.status_code == 409


def test_invalid_product_unit_is_rejected(client):
    response = client.post(
        "/products",
        json={
            "sku": "TEST-003",
            "name": "Milk",
            "unit": "gallon",
            "reorder_level": 2,
        },
    )

    assert response.status_code == 422
