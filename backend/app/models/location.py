from sqlalchemy import String, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(Integer,primary_key=True,index=True,)
    bin_code: Mapped[str] = mapped_column(String(50),unique=True,nullable=False,)
    description: Mapped[str] = mapped_column(String(200),nullable=False,)
