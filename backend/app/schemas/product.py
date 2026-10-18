from pydantic import BaseModel, ConfigDict, Field


class ProductCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=200)
    unit: str
    reorder_level: int = Field(ge=0)


class ProductResponse(BaseModel):
    id: int
    sku: str
    name: str
    unit: str
    reorder_level: int

    model_config = ConfigDict(from_attributes=True)
