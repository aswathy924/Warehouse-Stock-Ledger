# Warehouse Stock Ledger

Problem 3: Warehouse Stock Ledger — An immutable, append-only inventory ledger where stock is never edited in place, every balance is derived from recorded movements, and valuation uses weighted-average costing.

---

## 1. Title and one-liner
**Warehouse Stock Ledger** (Problem 3): A full-stack immutable warehouse inventory management system with derived balances, atomic bin transfers, weighted-average costing (WAC), and append-only reversals.

---

## 2. Live links
- **Web UI**: *(To be populated)*
- **API Base URL**: `` 
- **API Swagger / OpenAPI Docs**: ``
- **Auth Credentials**: Authentication is not required (public access enabled for assessment).

---

## 3. Tech stack
- **Backend**: Python 3.14 + FastAPI + SQLAlchemy 2.0 (psycopg3).
- **Database**: PostgreSQL 16 (production/Docker) & SQLite in-memory (fast isolated automated test runs).
- **Frontend**: TypeScript + React 19 + Vite.
- **Testing & Coverage**: pytest + pytest-cov (85% business rules coverage, 90% overall coverage).

---

## 4. Architecture

### Folder Structure
- `backend/app/`: Core backend application code.
  - `backend/app/api/`: Route handlers and HTTP endpoint controllers.
  - `backend/app/models/`: SQLAlchemy ORM database models and constraints.
  - `backend/app/schemas/`: Pydantic request/response validation schemas.
  - `backend/app/services/`: Pure business rules layer (`movement_service.py`).
- `backend/migrations/`: Alembic database migration scripts.
- `backend/tests/`: Comprehensive automated test suites (API, business rules, models).
- `frontend/`: React TypeScript web client with Vite.

### Where Business Rules Live
All business logic lives exclusively in `backend/app/services/movement_service.py`. The API routers only perform request parsing, dependency injection, and exception translation. Rules are never delegated to the UI.

---

## 5. Running locally

### Prerequisites
- Python 3.11+
- Node.js 18+ & npm
- Docker & Docker Compose (optional for local PostgreSQL)

### Step-by-Step Instructions

1. **Clone the repository**:
   ```bash
   git clone https://github.com/aswathy924/Warehouse-Stock-Ledger.git
   cd Warehouse-Stock-Ledger
   ```

2. **Environment Configuration**:
   ```bash
   cp .env.example .env
   ```
   *(Ensure `POSTGRES_PASSWORD` is set).*

3. **Start Database (Docker)**:
   ```bash
   docker compose up -d
   ```

4. **Setup Backend**:
   ```bash
   cd backend
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # Linux/macOS:
   source .venv/bin/activate

   pip install -r requirements.txt
   alembic upgrade head
   python seed.py --reset
   python -m uvicorn app.main:app --reload
   ```
   *Backend is live at `http://localhost:8000` (Docs at `http://localhost:8000/docs`).*

5. **Setup Frontend**:
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```
   *Frontend is live at `http://localhost:5173`.*

---


## 6. Running tests and coverage

### Single Command to Run Tests
```bash
# Inside backend directory with venv activated:
pytest
```

### Command to Produce Coverage Report
```bash
pytest --cov=app --cov-report=term-missing
```

### Coverage Summary
- **Business-rules module (`app/services/movement_service.py`)**: **85%**.
- **Overall Backend Code Coverage**: **90%**.
- Exact coverage report committed in `backend/coverage.txt`.

---

## 7. API overview

| Method | Path | Purpose | Key Status / Error Codes |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Service health & correlation ID check | 200 |
| `GET` | `/health/db` | Database connectivity health check | 200, 500 |
| `POST` | `/products` | Create product (unique SKU, unit, reorder) | 201, 409, 422 |
| `GET` | `/products` | List all products | 200 |
| `POST` | `/locations` | Create bin location (unique bin_code) | 201, 409, 422 |
| `GET` | `/locations` | List all bin locations | 200 |
| `POST` | `/movements/in` | Record incoming inventory batch | 201, 400, 422 |
| `POST` | `/movements/out` | Dispatch inventory with WAC snapshot | 201, 400 (Insufficient stock), 422 |
| `POST` | `/movements/transfer` | Move inventory atomically between two bins | 201, 400, 422 |
| `POST` | `/movements/adjust` | Record audit adjustments with fixed reason codes | 201, 400, 422 |
| `POST` | `/movements/{id}/reverse` | Post append-only reversal of existing movement | 201, 400 (Double reversal/insufficient stock) |
| `GET` | `/movements` | Chronological ledger history with filters | 200 |
| `GET` | `/movements/{id}` | Single movement details with reversal status | 200, 404 |
| `GET` | `/movements/balance` | Query balance for (product, location) | 200, 404 |
| `GET` | `/movements/grid` | Full stock matrix (products × locations) | 200 |
| `GET` | `/reports/low-stock` | Products at or below reorder level | 200 |
| `GET` | `/reports/valuation` | Total warehouse value & per-product WAC | 200 |
| `POST` | `/reports/reconcile` | Recomputes derived balances from scratch | 200 |

---

## 8. Business rules and assumptions

### Business Rules Mapping
1. **Rule 1: Immutability & Reversals**
   - *Enforced*: `backend/app/services/movement_service.py::reverse_movement`
   - *Tested in*: `backend/tests/test_business_rules.py::test_reverse_in_movement`, `test_double_reversal_is_rejected`, `test_reversing_a_reversal_is_rejected`
2. **Rule 2: Derived Balances & Reconcile**
   - *Enforced*: `backend/app/services/movement_service.py::get_stock_balance`, `reconcile_stock_ledger`
   - *Tested in*: `backend/tests/test_business_rules.py::test_reconcile_consistent_ledger`, `test_reconcile_detects_drift_when_ledger_corrupted`
3. **Rule 3: No Negative Stock & Concurrency**
   - *Enforced*: `backend/app/services/movement_service.py::stock_out`, `stock_transfer` using `with_for_update()`
   - *Tested in*: `backend/tests/test_business_rules.py::test_concurrent_outs_racing_for_units`
4. **Rule 4: Atomic Bin Transfers**
   - *Enforced*: `backend/app/services/movement_service.py::stock_transfer`
   - *Tested in*: `backend/tests/test_business_rules.py::test_atomic_transfer_moves_stock_between_locations`
5. **Rule 5: Weighted-Average Costing (WAC)**
   - *Enforced*: `backend/app/services/movement_service.py::calculate_product_weighted_average_cost`
   - *Tested in*: `backend/tests/test_business_rules.py::test_weighted_average_cost_calculated_and_stored_on_out`, `test_zero_cost_in_handled_correctly`
6. **Rule 6: Inventory Adjustments**
   - *Enforced*: `backend/app/services/movement_service.py::stock_adjustment` (Reasons: `damaged`, `expired`, `count correction`, `theft`, `other-with-note`)
   - *Tested in*: `backend/tests/test_business_rules.py::test_positive_adjustment_increases_stock`, `test_negative_adjustment_reduces_stock_and_prevents_negative`
7. **Rule 7: Low-Stock & Valuation Reports**
   - *Enforced*: `backend/app/services/movement_service.py::get_low_stock_products`, `get_valuation_report`
   - *Tested in*: `backend/tests/test_business_rules.py::test_low_stock_report_detects_products_below_reorder_level`, `test_valuation_report_matches_wac_multiplied_by_stock`

### Documented Assumptions
1. **Assumption 1 (Negative Adjustment Direction)**: In compliance with `CheckConstraint("quantity > 0")`, negative adjustments record the affected bin in `from_location_id` and positive adjustments in `to_location_id`. This allows unified balance calculation (`to - from`) without altering DB schema constraints.
2. **Assumption 2 (Reversal Snapshot Costs)**: A reversal of an OUT restores inventory and inherits the exact snapshot unit cost recorded on the original movement.
3. **Assumption 3 (WAC on Zero Inventory)**: When warehouse stock drops to 0 after dispatches, subsequent IN shipments reset the weighted-average cost to the new shipment's unit cost.

---

## 9. Error handling and logging
- **Error Response Shape**:
  ```json
  {
    "detail": "Description of domain or validation error",
    "error_type": "BUSINESS_RULE_VIOLATION | VALIDATION_ERROR | INTERNAL_SERVER_ERROR",
    "correlation_id": "c1f7b60e-4369-450e-9df1-8e9915e8b0b5"
  }
  ```
- **Logging**: Structured logs with timestamp, log level, latency in ms, and `correlation_id` on every HTTP request and domain error.
- **Correlation ID**: Propagated via standard `X-Correlation-ID` header on all responses.

---

## 10. Reviewer aids
- **Quick Re-seed**: Run `python seed.py --reset` inside `backend/` to instantly restore clean, realistic inventory data.
---
