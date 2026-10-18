
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductResponse


router = APIRouter(prefix="/products", tags=["Products"])


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED,)
def create_product(
    product_data: ProductCreate,
    db: Session = Depends(get_db),
):

    allowed_units = {"kg", "pcs", "litre"}

    if product_data.unit not in allowed_units:
        raise HTTPException(status_code=422, detail="Unit must be kg, pcs, or litre",)

    existing_product = db.scalar(select(Product).where(Product.sku == product_data.sku))

    if existing_product:
        raise HTTPException(status_code=409, detail="A product with this SKU already exists",)

    product = Product(**product_data.model_dump())
    db.add(product)

    try:
        db.commit()
        db.refresh(product)

    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409,detail="Could not create product because of a database constraint",)

    return product


@router.get("", response_model=list[ProductResponse])
def list_products(
    db: Session = Depends(get_db)
):
    products = db.scalars(select(Product).order_by(Product.id)).all()

    return products
