
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.location import Location
from app.schemas.location import LocationCreate, LocationResponse


router = APIRouter(prefix="/locations", tags=["Locations"])


@router.post("", response_model=LocationResponse,status_code=status.HTTP_201_CREATED,)
def create_location(
    location_data: LocationCreate,
    db: Session = Depends(get_db),
):
    existing_location = db.scalar(select(Location).where(Location.bin_code == location_data.bin_code))

    if existing_location:
        raise HTTPException(status_code=409,detail="A location with this bin code already exists",)

    location = Location(**location_data.model_dump())
    db.add(location)

    try:
        db.commit()
        db.refresh(location)    
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409,detail="Could not create location because of a database constraint",)

    return location


@router.get("", response_model=list[LocationResponse])
def list_locations(
    db: Session = Depends(get_db)
):
    locations = db.scalars(select(Location).order_by(Location.id)).all()

    return locations
