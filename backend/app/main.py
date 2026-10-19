import logging
import time
import uuid

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.database import engine
from app.api.products import router as products_router
from app.api.locations import router as locations_router
from app.api.movements import router as movements_router
from app.api.reports import router as reports_router


# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [correlation_id=%(correlation_id)s] %(message)s",
)
logger = logging.getLogger("warehouse_ledger")


class CorrelationIdFilter(logging.Filter):
    def __init__(self, correlation_id: str = "none"):
        super().__init__()
        self.correlation_id = correlation_id

    def filter(self, record):
        if not hasattr(record, "correlation_id"):
            record.correlation_id = self.correlation_id
        return True


default_filter = CorrelationIdFilter()
logger.addFilter(default_filter)


app = FastAPI(
    title="Warehouse Stock Ledger API",
    description="Immutable, append-only warehouse stock ledger with derived balances and weighted-average costing.",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def logging_and_correlation_middleware(request: Request, call_next):
    correlation_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
    request.state.correlation_id = correlation_id

    start_time = time.perf_counter()
    logger.info(
        f"Incoming request: {request.method} {request.url.path}",
        extra={"correlation_id": correlation_id},
    )

    try:
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        response.headers["X-Correlation-ID"] = correlation_id
        logger.info(
            f"Completed request: {request.method} {request.url.path} - Status: {response.status_code} ({duration_ms}ms)",
            extra={"correlation_id": correlation_id},
        )
        return response
    except Exception as exc:
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.error(
            f"Unhandled exception during {request.method} {request.url.path}: {str(exc)} ({duration_ms}ms)",
            exc_info=True,
            extra={"correlation_id": correlation_id},
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "An internal server error occurred",
                "error_type": "INTERNAL_SERVER_ERROR",
                "correlation_id": correlation_id,
            },
            headers={"X-Correlation-ID": correlation_id},
        )


app.include_router(products_router)
app.include_router(locations_router)
app.include_router(movements_router)
app.include_router(reports_router)


@app.get("/")
def root():
    return {"message": "Warehouse Stock Ledger API"}



@app.get("/health")
def service_health():
    return {"status": "healthy", "service": "Warehouse Stock Ledger"}


@app.get("/health/db")
def database_health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"database": "connected", "status": "healthy"}
