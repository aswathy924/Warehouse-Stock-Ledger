from sqlalchemy import String, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer,primary_key=True,index=True,)
    sku: Mapped[str] = mapped_column(String(50), unique=True,nullable=False,)
    name: Mapped[str] = mapped_column(String(200),nullable=False,)
    unit: Mapped[str] = mapped_column(String(20),nullable=False,)
    reorder_level: Mapped[int] = mapped_column(Integer,nullable=False,default=0,)
