# Warehouse Stock Ledger

## 1. Title and one-liner
**Warehouse Stock Ledger** (Problem 3): An immutable inventory management system where stock balances are derived strictly from an append-only movement ledger, featuring atomic bin transfers, weighted-average costing (WAC), and compensating reversals.

---

## 2. Live links
- **Web UI**: [https://warehouse-stock-ledger-frontend.onrender.com](https://warehouse-stock-ledger-frontend.onrender.com)
- **API Base URL**: `https://warehouse-stock-ledger-backend.onrender.com`
- **Swagger / OpenAPI Docs**: [https://warehouse-stock-ledger-backend.onrender.com/docs](https://warehouse-stock-ledger-backend.onrender.com/docs)
- **Auth Credentials**: None required. Authentication was omitted intentionally so reviewers can test all routes and screens immediately without signup friction.

> [!NOTE]
> **Render Free-Tier Cold Starts**:
> Render puts free backend instances to sleep after 15 minutes of idle time. If you are opening the link after a gap, the backend container will take roughly **45 to 60 seconds** to wake up, boot FastAPI, and initialize the PostgreSQL connection pool.
>
> While waking up, the frontend navbar will show `"Connecting..."` and tables will display `"Loading stock balances..."`. Once the first ping succeeds, the indicator turns green (`API Connected`) and all subsequent requests are near-instant.

---

## 3. Tech stack
- **Backend**: **Python 3.12** with **FastAPI**. FastAPI was chosen for clean async support, fast Pydantic v2 validation, and automatic OpenAPI schema generation for easy evaluation.
- **ORM & DB Driver**: **SQLAlchemy 2.0** with **psycopg3**. Used for explicit transaction blocks and row-level locking (`with_for_update()`) during dispatches.
- **Database**: **PostgreSQL 16** on Render (and via local Docker Compose) to test real transactional concurrency, plus in-memory SQLite for fast, isolated test runs.
- **Frontend**: **React 19** + **TypeScript 5.8** built with **Vite 6**. Kept lightweight with client-side hash routing and a typed fetch client—no heavyweight component libraries.
- **Styling**: Handcrafted CSS tokens and responsive grid/flexbox layouts. Simple, accessible, and fast without the runtime baggage or build setup of utility-class frameworks.
- **Hosting**:
  - **Backend**: Render Web Service (Docker container build).
  - **Frontend**: Render Static Site (Vite build with `/* -> /index.html` rewrite).
  - **Database**: Render Managed PostgreSQL 16 (`warehouse-db`).
- **Testing**: **pytest 9.1** + **pytest-cov 7.1**.

---

## 4. Architecture

### Component & Request Flow
```text
 +-------------------------------------------------------------------------+
 |                          Client Browser / Device                        |
 |            (Desktop Chrome, Edge, Brave, Safari, Mobile Viewport)       |
 +------------------------------------+------------------------------------+
                                      |
                         HTTP / REST  |  Port 443 (HTTPS)
                                      v
 +-------------------------------------------------------------------------+
 |             Frontend Web Client (Render Static Site / Nginx)            |
 |  - React 19 App Shell (Tab navigation: #grid, #movement, #ledger, etc.) |
 |  - Typed API Service (injects X-Correlation-ID, handles CSV exports)    |
 |  - Automatic /ping heartbeat to monitor backend cold-starts             |
 +------------------------------------+------------------------------------+
                                      |
                           JSON API   |  X-Correlation-ID Header
                                      v
 +-------------------------------------------------------------------------+
 |                   Backend API (FastAPI / Uvicorn)                       |
 |  +-------------------------------------------------------------------+  |
 |  | Middleware: Correlation ID propagation, latency logging           |  |
 |  +-------------------------------------------------------------------+  |
 |  | API Routers (/products, /locations, /movements, /reports)         |  |
 |  +-------------------------------------------------------------------+  |
 |  | Business Logic Service: app/services/movement_service.py          |  |
 |  |   * Derived Balances: SUM(to_location) - SUM(from_location)       |  |
 |  |   * Atomic Bin Transfers (all-or-nothing database transactions)   |  |
 |  |   * Weighted-Average Costing (captured snapshot at time of OUT)   |  |
 |  |   * Append-Only Compensating Reversals                            |  |
 |  |   * Concurrency Safety (SELECT ... FOR UPDATE on product records) |  |
 |  +-------------------------------------------------------------------+  |
 +------------------------------------+------------------------------------+
                                      |
                          SQLAlchemy  |  Connection Pool (psycopg3)
                                      v
 +-------------------------------------------------------------------------+
 |                     PostgreSQL 16 Database Storage                      |
 |  - products (id, sku, name, unit, reorder_level)                        |
 |  - locations (id, bin_code, description)                                |
 |  - movements (id, timestamp, product_id, from_location_id,              |
 |               to_location_id, quantity, unit_price, movement_type,      |
 |               reference_id, reason, operator, is_reversed, reversal_of) |
 |    * CHECK (quantity > 0)                                               |
 |    * Append-Only: No UPDATE or DELETE allowed on movements              |
 +-------------------------------------------------------------------------+
```

### Folder Structure
- `backend/`: FastAPI application code and tests.
  - `backend/app/api/`: Endpoint route handlers, request validation, and status codes.
  - `backend/app/models/`: SQLAlchemy 2.0 models, relations, and table constraints.
  - `backend/app/schemas/`: Pydantic input/output schemas and enums.
  - `backend/app/services/`: Core business logic (`movement_service.py`).
  - `backend/migrations/`: Alembic database migration scripts.
  - `backend/tests/`: Pytest test suite covering business rules, edge cases, and concurrency.
- `frontend/`: Single-page React application.
  - `frontend/src/components/`: Views for Stock Matrix, Movement Form, Ledger History, and Reports.
  - `frontend/src/services/`: Typed API client with error mapping and correlation ID headers.
  - `frontend/src/utils/`: Client-side RFC 4180 CSV export and UTC-to-IST formatting helpers.
- `.github/workflows/`: CI pipeline running backend tests and linting on every push.
- `render.yaml`: Infrastructure blueprint definition for one-click deployment on Render.

### Where Business Rules Live and Why
All business rules live exclusively in **`backend/app/services/movement_service.py`**. 

I deliberately separated the business logic from HTTP route handlers. Routers only validate incoming payloads and return HTTP responses; they never perform balance math or run raw queries directly. Keeping logic inside a dedicated service layer ensures the exact same rules and validation run whether an operation is triggered by a REST call, an automated test case, or the database seed script. The UI never calculates balances on its own—it only displays what the backend computes.

---

## 5. Running locally

### Prerequisites
- **Python**: 3.11+ (built and tested with 3.12 / 3.14)
- **Node.js**: 18+ (Node 20 recommended) and `npm`
- **Docker & Docker Compose**: Recommended for spinning up the local PostgreSQL container

### Environment Variables
Copy the template to create your `.env`:
```bash
cp .env.example .env
```

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | SQLAlchemy connection string | `postgresql+psycopg://postgres:postgres@localhost:5432/warehouse_db` |
| `POSTGRES_USER` | Local Postgres username | `postgres` |
| `POSTGRES_PASSWORD`| Local Postgres password | `local_dev_password_123` |
| `POSTGRES_DB` | Local Postgres database name | `warehouse_db` |
| `VITE_API_URL` | Base API URL used by the React client | `http://localhost:8000` |

---

### Step-by-Step Manual Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/aswathy924/Warehouse-Stock-Ledger.git
   cd Warehouse-Stock-Ledger
   ```

2. **Start the local Postgres database**:
   ```bash
   docker compose up -d db
   ```

3. **Set up and start the backend**:
   ```bash
   cd backend
   python -m venv .venv
   
   # Activate virtualenv
   # On Windows (PowerShell):
   .venv\Scripts\Activate.ps1
   # On Linux / macOS:
   source .venv/bin/activate

   pip install -r requirements.txt
   alembic upgrade head
   python seed.py --reset
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   *The backend will be running at `http://localhost:8000` (Interactive docs: `http://localhost:8000/docs`).*

4. **Set up and start the frontend**:
   ```bash
   # Open a new terminal tab at the project root:
   cd frontend
   npm install
   npm run dev
   ```
   *The web client will be available at `http://localhost:5173`.*

---

### One-Command Docker Setup
If you prefer not to configure Python and Node locally, you can run the entire system (PostgreSQL, backend with auto-migrations/seeding, and frontend) using Docker Compose:
```bash
docker compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API & Docs: `http://localhost:8000/docs`

---

## 5a. Deployment

### Infrastructure Overview
The live application is hosted on **Render** using an Infrastructure-as-Code Blueprint (`render.yaml`):
1. **Database**: Render Managed PostgreSQL 16 (`warehouse-db`).
2. **Backend**: Render Web Service running the backend Docker container (`backend/Dockerfile`).
3. **Frontend**: Render Static Site built via `npm run build` with outputs served from `dist`.

### Initial Deployment Steps
1. Push the code to GitHub (`https://github.com/aswathy924/Warehouse-Stock-Ledger`).
2. In the Render Dashboard, go to **New +** -> **Blueprint**.
3. Link the repository. Render reads `render.yaml` and provisions the database, backend service, and frontend static site together.
4. During container startup, the backend automatically runs:
   ```bash
   alembic upgrade head && python seed.py && uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
   This applies pending migrations and loads realistic sample catalog data automatically.
5. The frontend static site uses a rewrite rule (`/* -> /index.html`) so direct URL bookmarks and client routes resolve properly.

### How to Redeploy After Code Changes
Continuous deployment is configured. Pushing to the `main` branch triggers an automated build and zero-downtime deployment on Render.

### How to Re-Seed the Production Database
1. Go to the Render Dashboard and click on `warehouse-stock-ledger-backend`.
2. Open the **Shell** tab.
3. Run:
   ```bash
   python seed.py --reset
   ```
   This resets the database and reloads the original clean seed catalog.

---

## 6. Running tests and coverage

### Run Test Suite
```bash
# Inside the backend folder with virtual environment active:
pytest
```

### Generate Coverage Report
```bash
pytest --cov=app --cov-report=term-missing
```

### Coverage Numbers
- **Business Logic Layer (`app/services/movement_service.py`)**: **86% statement coverage**
- **Overall Application**: **90% statement coverage**
- **Results**: **48 passed tests**
- The complete terminal output is committed in `backend/coverage.txt`.

### What is Covered
- All movement types: IN, OUT, TRANSFER, and ADJUSTMENT.
- Balance derivations and running ledger consistency over multiple sequential movements.
- Race conditions during dispatches (`test_concurrent_outs_racing_for_units`) using row-level locking.
- Reversal rules: successful compensating entries, rejecting double reversals, and preventing someone from reversing a reversal.
- Weighted-average costing math and capturing accurate snapshot unit costs at the moment of dispatch.
- Re-stocking and average cost calculations after a bin's inventory drops completely to zero.
- Low-stock reorder alerts and warehouse valuation summaries.
- Recomputing balances from scratch to confirm zero ledger drift.

### What is Deliberately Not Covered and Why
- Framework health ping failure fallback (`app/main.py:113-115`): Straightforward catch block for database drops; verified through manual smoke tests.
- Global 500 safety middleware (`app/main.py:76-83`): Defensive catch-all for uncaught server panics.
- SQLite-to-PostgreSQL driver dialect fallback (`database.py:48-52`): Only triggers when testing locally under different database configurations.

---

## 7. API overview

Every endpoint accepts and returns JSON, validates payloads via Pydantic v2 schemas, and echoes back an `X-Correlation-ID` header for request tracing.

| Method | Path | Purpose | Key Status Codes |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Service health check | 200 |
| `GET` | `/health/db` | Database connectivity verification | 200, 500 |
| `POST` | `/products` | Create product with SKU and reorder point | 201, 409 (SKU exists), 422 |
| `GET` | `/products` | List all catalog products | 200 |
| `POST` | `/locations` | Create warehouse bin location | 201, 409 (Bin code exists), 422 |
| `GET` | `/locations` | List all warehouse bins | 200 |
| `POST` | `/movements/in` | Record incoming shipment | 201, 400, 422 |
| `POST` | `/movements/out` | Dispatch inventory & lock in snapshot WAC | 201, 400 (Insufficient stock), 422 |
| `POST` | `/movements/transfer` | Move inventory atomically between two bins | 201, 400 (Same bin / no stock), 422 |
| `POST` | `/movements/adjust` | Record audit adjustments with reason code | 201, 400, 422 |
| `POST` | `/movements/{id}/reverse` | Post append-only compensating reversal | 201, 400 (Already reversed / invalid) |
| `GET` | `/movements` | View chronological movement history | 200 |
| `GET` | `/movements/{id}` | Inspect single movement details | 200, 404 |
| `GET` | `/movements/balance` | Query derived balance for (product, bin) | 200, 404 |
| `GET` | `/movements/grid` | Stock balance matrix (products × bins) | 200 |
| `GET` | `/reports/low-stock` | Products at or below reorder threshold | 200 |
| `GET` | `/reports/valuation` | Warehouse valuation & current product WAC | 200 |
| `POST`, `GET` | `/reports/reconcile` | Recomputes derived balances from ledger | 200 (Reports drift count) |

> **CSV Export**: Matrix and ledger exports are handled directly in the browser via `frontend/src/utils/csvExport.ts`. This lets users export their active filters immediately without placing formatting strain on the backend.

*Interactive OpenAPI docs are live at:* [https://warehouse-stock-ledger-backend.onrender.com/docs](https://warehouse-stock-ledger-backend.onrender.com/docs).

---

## 8. Business rules and assumptions

### Business Rules Mapping
1. **Rule 1: Immutability & Reversals**
   - *Enforced in*: `backend/app/services/movement_service.py::reverse_movement`
   - *Tested in*: `backend/tests/test_business_rules.py::test_reverse_in_movement`, `test_double_reversal_is_rejected`, `test_reversing_a_reversal_is_rejected`
2. **Rule 2: Derived Balances & Reconciliation**
   - *Enforced in*: `backend/app/services/movement_service.py::get_stock_balance`, `reconcile_stock_ledger`
   - *Tested in*: `backend/tests/test_business_rules.py::test_reconcile_consistent_ledger`, `test_reconcile_detects_drift_when_ledger_corrupted`
3. **Rule 3: No Negative Stock & Concurrency Protection**
   - *Enforced in*: `backend/app/services/movement_service.py::stock_out`, `stock_transfer` (uses `with_for_update()` to lock product rows)
   - *Tested in*: `backend/tests/test_business_rules.py::test_concurrent_outs_racing_for_units`, `test_stock_out_cannot_drive_balance_negative`
4. **Rule 4: Atomic Bin Transfers**
   - *Enforced in*: `backend/app/services/movement_service.py::stock_transfer`
   - *Tested in*: `backend/tests/test_business_rules.py::test_atomic_transfer_moves_stock_between_locations`
5. **Rule 5: Weighted-Average Costing (WAC)**
   - *Enforced in*: `backend/app/services/movement_service.py::calculate_product_weighted_average_cost`
   - *Tested in*: `backend/tests/test_business_rules.py::test_weighted_average_cost_calculated_and_stored_on_out`, `test_zero_cost_in_handled_correctly`
6. **Rule 6: Inventory Adjustments**
   - *Enforced in*: `backend/app/services/movement_service.py::stock_adjustment` (Reasons: `damaged`, `expired`, `count correction`, `theft`, `other-with-note`)
   - *Tested in*: `backend/tests/test_business_rules.py::test_positive_adjustment_increases_stock`, `test_negative_adjustment_reduces_stock_and_prevents_negative`
7. **Rule 7: Low-Stock & Valuation Reports**
   - *Enforced in*: `backend/app/services/movement_service.py::get_low_stock_products`, `get_valuation_report`
   - *Tested in*: `backend/tests/test_business_rules.py::test_low_stock_report_detects_products_below_reorder_level`, `test_valuation_report_matches_wac_multiplied_by_stock`

### Documented Assumptions
1. **Assumption 1 (Negative Adjustment Storage)**: To satisfy the database constraint `CheckConstraint("quantity > 0")`, negative adjustments record the bin in `from_location_id`, while positive adjustments record it in `to_location_id`. This allows a single mathematical formula `SUM(to) - SUM(from)` to calculate balances across all movement types without negative integers in the quantity field.
2. **Assumption 2 (Valuation on Reversing an OUT)**: If an OUT movement is reversed, stock returns to the bin and inherits the exact snapshot unit cost recorded on that original dispatch.
3. **Assumption 3 (WAC Reset on Full Depletion)**: When total inventory for a product reaches zero, the next incoming shipment resets the weighted-average cost to that shipment's purchase price.
4. **Assumption 4 (Same-Bin Transfer Guard)**: Attempting to transfer stock where `from_location_id == to_location_id` is rejected at the API schema layer with HTTP 400 to prevent zero-value noise in the ledger.

---

## 9. Error handling and logging

### Error Response Format
All API errors return a standard JSON structure:
```json
{
  "detail": "Cannot dispatch 20 units. Only 15 units available in BIN-A01.",
  "error_type": "BUSINESS_RULE_VIOLATION",
  "correlation_id": "c1f7b60e-4369-450e-9df1-8e9915e8b0b5"
}
```

### Error Types
- **`BUSINESS_RULE_VIOLATION` (400)**: Domain check failures (e.g., negative balance attempts, double reversals, missing reason note).
- **`NOT_FOUND` (404)**: Entity not found (e.g., product or location ID does not exist).
- **`CONFLICT` (409)**: Unique constraint failures (e.g., duplicate SKU or bin code).
- **`VALIDATION_ERROR` (422)**: Pydantic schema validation failures (e.g., non-positive quantity, malformed fields).
- **`INTERNAL_SERVER_ERROR` (500)**: Uncaught database or runtime errors.

### Structured Logging & Correlation IDs
- **Middleware**: Incoming requests receive or generate an `X-Correlation-ID` (UUID4).
- **Log Format**: Logs record timestamp, log level, correlation ID, path, HTTP status, and response latency:
  ```text
  2026-10-22 08:54:25 [INFO] [correlation_id=6dbecac7-ac9c-47e8-8fba-3bb7a8561b44] Completed request: GET /movements/grid - Status: 200 (4.21ms)
  ```
- **Viewing Logs on Render**:
  1. Open the [Render Dashboard](https://dashboard.render.com).
  2. Select `warehouse-stock-ledger-backend`.
  3. Go to the **Logs** tab to view real-time logs and filter by `correlation_id`.

---

## 10. Reviewer aids

### How to Reset / Re-Seed Sample Data
If you make several test transactions and want to return to a clean catalog:
- **Locally**: Run `python backend/seed.py --reset`
- **Hosted Instance**: Render Dashboard -> `warehouse-stock-ledger-backend` -> **Shell** tab -> run `python seed.py --reset`

### Quick 3-Minute Walkthrough
1. **Stock Matrix & CSV Export**:
   - Open **Stock Overview** (`#grid`).
   - Look at derived product balances across bins.
   - Click **Export CSV** to download the current grid as an RFC 4180 CSV file.
2. **Post IN and OUT Movements with WAC**:
   - Go to **Record Movement** (`#movement`).
   - Add an `IN` shipment for `SEED-PADDY-BPT` (e.g., quantity `50`, unit price `850.00`).
   - Record an `OUT` movement for `10` units. Notice the system ensures adequate stock and locks in the average cost snapshot.
3. **Atomic Bin Transfer**:
   - Pick `TRANSFER`, select source `BIN-A01` and target `BIN-STAGE`.
   - The transfer moves inventory in a single atomic transaction.
4. **Append-Only Reversals**:
   - Open **Ledger History** (`#ledger`) and filter by a product.
   - Click **Reverse** on any movement, enter a reason, and confirm.
   - The original entry is marked as reversed, a compensating movement is appended, and the running balance updates immediately. Trying to reverse it a second time is blocked.
5. **Reconciliation Check**:
   - Go to **Reports** (`#reports`).
   - Click **Reconcile Ledger** to recalculate derived balances across the whole ledger and confirm zero drift.

---

## 11. Known limitations

1. **Single Warehouse Scope**: Designed for bin-to-bin movements inside one physical warehouse. Multi-warehouse transfers requiring in-transit shipping states are not currently supported.
2. **No Authentication**: Omitted deliberately in accordance with assessment instructions so reviewers can test all routes without needing login credentials.
3. **Synchronous WAC Calculations**: Weighted average cost is computed synchronously on each dispatch. This is exact and prevents drift for normal warehouse volumes, but an enterprise deployment handling millions of transactions per minute would likely require precomputed rollups.
4. **Render Free-Tier Spin-Down**: Free instances shut down after 15 minutes of inactivity, resulting in a ~45–60 second delay on the first visit while the container boots up (noted in Section 2).

---

## 12. AI and third-party usage

### Tools & Assistants
- **Antigravity AI Coding Assistant (DeepMind)**: Used for bounce-boarding schema designs, drafting initial pytest assertions, scaffolding Docker and CI configs, and checking cross-browser styling edge cases.
- **Third-Party Libraries**:
  - Backend: `fastapi`, `sqlalchemy`, `pydantic`, `psycopg`, `alembic`, `pytest`, `pytest-cov`, `uvicorn`
  - Frontend: `react`, `react-dom`, `vite`, `typescript`

### Prompt Log Reference
Detailed log of prompts and usage notes: [PROMPTS.md](PROMPTS.md)