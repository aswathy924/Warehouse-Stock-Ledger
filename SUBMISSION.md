# SUBMISSION.md — Project Write-Up

## A. What I built
I built an append-only warehouse stock ledger system designed around agricultural inventory where physical items are moved between specific storage bins. Instead of modifying quantity numbers directly in a table, the system derives all on-hand stock dynamically by aggregating the movement history. The core flows handle batch arrivals, dispatches locked to weighted-average cost snapshots, atomic bin-to-bin transfers, and physical audit adjustments. Mistakes are corrected through compensating reversal records that preserve the audit trail and update running balances without permitting duplicate reversals. All seven Core requirements are fully implemented with 48 passing tests, a responsive React web interface, client-side CSV exports, and live hosting on Render.

---

## B. Three design decisions

### Decision 1: Derived Balances vs. Stored Quantity Columns
- **Decision**: Calculate on-hand stock on the fly using `SUM(to_location) - SUM(from_location)` from ledger rows instead of keeping a mutable `current_stock` column.
- **Alternative considered**: Storing an editable balance column updated via application writes or database triggers.
- **Why I chose this**: It completely prevents cache drift and eliminates race conditions where a ledger write succeeds but the cached balance update fails.
- **What it cost me**: Balance queries have to scan indexed movement records rather than reading a single row, though indexes keep response times under 5ms.

### Decision 2: Dedicated Service Layer vs. Router Logic
- **Decision**: Put all warehouse rules, constraints, and balance math exclusively inside `backend/app/services/movement_service.py`.
- **Alternative considered**: Putting queries and validation directly inside FastAPI endpoint functions.
- **Why I chose this**: The same business logic is guaranteed to run whether an operation comes from the API, automated tests, or the database seed script.
- **What it cost me**: Extra plumbing code to map Pydantic schemas into domain objects and translate service-layer exceptions into HTTP status codes.

### Decision 3: Single-Record Transfers vs. Paired OUT/IN Entries
- **Decision**: Record bin transfers as a single movement entry holding both `from_location_id` and `to_location_id` inside one transaction.
- **Alternative considered**: Creating two separate records: an OUT entry from the source bin and an IN entry to the destination bin.
- **Why I chose this**: It guarantees the transfer happens atomically without risking an orphaned deduction if the second write fails, and reversing it requires only one compensating row.
- **What it cost me**: Location audit queries have to filter against both source and destination columns instead of checking a single column.

---

## C. The hardest part
The trickiest issue was getting concurrency control to work reliably across both production PostgreSQL and the local SQLite test suite. During M2 (commit `b943a3f`), I noticed parallel test threads in `test_concurrent_outs_racing_for_units` were causing negative stock balances under SQLite because in-memory SQLite completely ignores SQLAlchemy's `with_for_update()` row locks. 

In commit `48662ed`, I fixed this by adding an in-memory process lock (`get_product_lock`) alongside the database row lock so race conditions were prevented in unit tests as well as Postgres. Later in M5 (commit `b827a4d`), I ran into an unexpected bug where Brave Shields blocked `/health` API calls in the browser as tracking pings. I updated `App.tsx` with a silent fallback that checks `api.getLocations()`, preventing the frontend from mistakenly showing an offline status banner.

---

## D. How I handle failure
Every error is trapped before reaching the client, logged with a request correlation ID, and converted into a standard JSON response (`detail`, `error_type`, `correlation_id`):

| Failure Type | Where Caught | Handled By | What the User Sees | What Gets Logged |
| :--- | :--- | :--- | :--- | :--- |
| **Malformed Payload** | Pydantic layer | FastAPI request validator | HTTP 422 with clear field validation errors | `WARNING` with missing/invalid field names |
| **Rule Violation** (e.g. Negative stock) | `movement_service.py` | Router exception mapper | HTTP 400 with a plain-English explanation | `WARNING` with attempted quantity vs available units |
| **Database Failure** (e.g. Broken connection) | SQLAlchemy engine | Global exception middleware | HTTP 500 clean message without internal stack traces | `ERROR` with the full traceback and correlation ID |
| **Adblocker Block** (Browser-side) | Frontend client | `App.tsx` catch handler | Seamlessly falls back to data endpoint check | Console warning only; no false offline banner |

All write operations run inside database transaction blocks, ensuring that any failed validation immediately rolls back without partial writes.

---

## E. Milestone log

| Milestone | Date Completed | Commit Hash |
| :--- | :--- | :--- |
| **M0 — Scaffold** | 2026-10-18 | `6e8431c` |
| **M1 — Domain model** | 2026-10-18 | `7f172f0` |
| **M2 — Business rules** | 2026-10-19 | `b943a3f` |
| **M3 — API** | 2026-10-19 | `98439df` |
| **M4 — UI** | 2026-10-21 | `fb95256` |
| **M5 — Deployment** | 2026-10-22 | `b827a4d` |
| **M6 — Documentation** | 2026-10-22 | `HEAD` |

---

## F. If I had two more days
1. **Multi-Warehouse Transfers**: Add support for in-transit shipment states when transferring goods between geographically separate warehouse facilities.
2. **Batch & Expiry Date Tracking**: Support batch/lot numbers and FEFO (First Expired, First Out) suggestions for perishable agricultural bio-inputs.
3. **Role-Based Access Control**: Add login sessions with roles (`operator`, `auditor`, `manager`) and require manager sign-off for large inventory write-offs.
---

## G. Self-assessment

| Criterion | Weight | Score (1–5) | Justification |
| :--- | :---: | :---: | :--- |
| **Business logic correctness** | 25 | 5 | All seven core rules implemented in the backend; prevents negative stock, handles concurrent dispatches, computes WAC correctly, and handles reversals cleanly. |
| **Code clarity and structure** | 14 | 4 | Clean separation between routes, services, and models; `movement_service.py` is well-structured, though at ~500 lines it could eventually be split into smaller sub-modules. |
| **Error and exception handling** | 10 | 5 | Clean division between validation (422), business rule (400), and system (500) errors with consistent JSON envelopes and correlation IDs. |
| **Logging and observability** | 8 | 4 | Structured logging with timestamps, latency, status codes, and correlation IDs; could add OpenTelemetry export in a real production environment. |
| **Data modelling and persistence** | 9 | 5 | True append-only table design with `CHECK (quantity > 0)`, indexed lookups, clean Alembic migrations, and realistic seed data. |
| **API design** | 8 | 4 | Resource-focused REST endpoints with automatic OpenAPI documentation and query filters; could add explicit `/api/v1/` prefixing. |
| **UI usability** | 6 | 4 | Clean, practical layout that works well on both desktop and mobile; could add floating toast notifications for user actions. |
| **Testing** | 7 | 5 | 48 automated tests covering core logic, edge cases, race conditions, and reversals; runs with a single `pytest` command with 86% service coverage. |
| **Deployment and operability** | 5 | 4 | Docker, Docker Compose, CI workflows, and Render configuration work smoothly; free tier has cold-start latency when waking from sleep. |
| **Git hygiene** | 4 | 5 | Meaningful commit history following Conventional Commits mapped to milestones M0 through M6, tagged `v1.0` with no secrets in history. |
| **Documentation and write-up** | 4 | 5 | Follows the required headings and word limits exactly, provides genuine engineering trade-offs, and documents all prompts in PROMPTS.md. |