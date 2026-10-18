from pydantic import BaseModel, ConfigDict, Field


class LocationCreate(BaseModel):
    bin_code: str = Field(min_length=1, max_length=50)
    description: str = Field(min_length=1, max_length=200)


class LocationResponse(BaseModel):
    id: int
    bin_code: str
    description: str

    model_config = ConfigDict(from_attributes=True)
