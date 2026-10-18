import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models.product import Product
from app.models.location import Location
from app.models.movement import Movement


@pytest.fixture()
def client():
    # An isolated in-memory database for each test.
    test_engine = create_engine("sqlite://",connect_args={"check_same_thread": False},poolclass=StaticPool,)

    TestingSessionLocal = sessionmaker(bind=test_engine, autoflush=False,expire_on_commit=False,)

    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=test_engine)
        test_engine.dispose()
