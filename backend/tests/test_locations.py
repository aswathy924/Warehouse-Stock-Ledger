def test_create_location(client):
    response = client.post(
        "/locations",
        json={
            "bin_code": "A-01",
            "description": "Storage aisle A, bin 01",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["bin_code"] == "A-01"
    assert data["description"] == "Storage aisle A, bin 01"
    assert "id" in data


def test_list_locations(client):
    client.post(
        "/locations",
        json={
            "bin_code": "B-01",
            "description": "Storage bin B-01",
        },
    )

    response = client.get("/locations")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["bin_code"] == "B-01"


def test_duplicate_location_bin_code_is_rejected(client):
    payload = {
        "bin_code": "C-01",
        "description": "Storage bin C-01",
    }

    first = client.post("/locations", json=payload)
    second = client.post(
        "/locations",
        json={**payload, "description": "Another description"},
    )

    assert first.status_code == 201
    assert second.status_code == 409
