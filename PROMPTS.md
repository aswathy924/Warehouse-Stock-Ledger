# AI Prompt Log (PROMPTS.md)

As required by Section 9 of the KJBN Labs Take-Home Assignment specifications, below is the chronological log of queries and prompts given to AI coding assistants during the implementation of Problem 3: Warehouse Stock Ledger. AI was used as a productivity multiplier for environment troubleshooting, scaffolding test fixtures and parameterized test suites, drafting initial FastAPI routes/middleware, generating UI component boilerplate, and creating realistic domain seed data. All architectural decisions, transactional integrity rules, concurrency logic, and balance derivation math were directed, validated, and refined by me.

---

### Prompt 1
- **Tool**: Antigravity AI Assistant
- **Request**: "I altered the postgres user password inside psql, but my docker container is throwing a connection refused error on port 5432. Why is that?"
- **Action Taken / Outcome**: *Edited*. The assistant pointed out an active native Windows PostgreSQL service running on host port 5432. I remapped Docker Compose to `5434:5432` and updated my local `.env`.

### Prompt 2
- **Tool**: Antigravity AI Assistant
- **Request**: "Why is `git push -u origin main` returning `src refspec main does not match any` on a newly created local git repo?"
- **Action Taken / Outcome**: *Used as-is*. Local git defaulted to `master`. Renamed branch to `main` with `git branch -M main` and completed the initial M0 commit.

### Prompt 3
- **Tool**: Antigravity AI Assistant
- **Request**: "My pip install is failing on a clean virtualenv with errors on requirements.txt. Can you see why?"
- **Action Taken / Outcome**: *Used as-is*. Detected PowerShell had saved `requirements.txt` as UTF-16LE. Converted the file to standard UTF-8 and installed dependencies.

### Prompt 4
- **Tool**: Antigravity AI Assistant
- **Request**: "Write a standard pytest `conftest.py` with an in-memory SQLite fixture and a FastAPI `TestClient` override so test runs don't require an active PostgreSQL instance."
- **Action Taken / Outcome**: *Edited*. Took the database session fixture boilerplate and adapted it to create all declarative SQLAlchemy tables on setup and drop them on teardown.

### Prompt 5
- **Tool**: Antigravity AI Assistant
- **Request**: "Give me a standard `pytest.ini` template so I can run `pytest` from the backend directory without needing to manually set `PYTHONPATH=.` each time."
- **Action Taken / Outcome**: *Used as-is*. Added `pythonpath = .` and test discovery patterns to root `pytest.ini`.

### Prompt 6
- **Tool**: Antigravity AI Assistant
- **Request**: "I am drafting unit tests for my movement service for Milestone 1 to M2. Can you generate initial test boilerplate for testing stock IN, OUT, and checking insufficient inventory?"
- **Action Taken / Outcome**: *Edited*. Scaffolding saved time. I expanded the assertions to test boundary conditions (e.g. attempting to dispatch exactly `available + 1` units) and verify domain exception messages.

### Prompt 7
- **Tool**: Antigravity AI Assistant
- **Request**: "What edge cases should I cover in tests for weighted average cost when current stock drops to 0 and a new shipment comes in?"
- **Action Taken / Outcome**: *Edited*. Assistant suggested testing that WAC resets cleanly to the new shipment's unit cost rather than dividing by zero or carrying stale valuation. I implemented `test_zero_cost_in_handled_correctly`.

### Prompt 8
- **Tool**: Antigravity AI Assistant
- **Request**: "Generate a pytest test case verifying that an already reversed movement cannot be reversed a second time, and that reversing a reversal movement is rejected."
- **Action Taken / Outcome**: *Edited*. Integrated the tests into `test_business_rules.py` and adjusted the expected exception types to match my service layer's custom `BusinessRuleViolation`.

### Prompt 9
- **Tool**: Antigravity AI Assistant
- **Request**: "How can I test two concurrent threads executing dispatches simultaneously in pytest using `concurrent.futures` to test row-level locking?"
- **Action Taken / Outcome**: *Edited*. Implemented `test_concurrent_outs_racing_for_units`. Identified that SQLite in-memory ignores `with_for_update()`, prompting me to implement an in-process threading lock (`get_product_lock`) to maintain test pass guarantees across both SQLite and Postgres.

### Prompt 10
- **Tool**: Antigravity AI Assistant
- **Request**: "Create a FastAPI middleware to generate or propagate an `X-Correlation-ID` header, log request execution time in ms, and attach the correlation ID to the response."
- **Action Taken / Outcome**: *Edited*. Adapted the middleware in `app/main.py` and configured Python's `logging` module to output structured logs with the correlation ID.

### Prompt 11
- **Tool**: Antigravity AI Assistant
- **Request**: "What is the standard idiom in pydantic v2 to validate that an adjustment reason belongs to a fixed set of allowed string values or requires a non-empty note if 'other-with-note' is selected?"
- **Action Taken / Outcome**: *Edited*. Used a Pydantic `@model_validator(mode="after")` to enforce mandatory explanatory notes whenever `reason == "other-with-note"`.

### Prompt 12
- **Tool**: Antigravity AI Assistant
- **Request**: "Create the FastAPI router for `/movements` with endpoints for `/in`, `/out`, `/transfer`, `/adjust`, and `/{id}/reverse` that call into a service layer."
- **Action Taken / Outcome**: *Edited*. Reused the router boilerplate, wired the endpoints into `movement_service.py`, and added proper HTTP status codes (201 for creations, 400 for domain errors, 404 for missing records).

### Prompt 13
- **Tool**: Antigravity AI Assistant
- **Request**: "Create 10 API integration tests using `TestClient` to verify HTTP status codes and error response shapes for invalid movement payloads (missing fields, negative quantity, invalid UUIDs)."
- **Action Taken / Outcome**: *Edited*. Cleaned up payload fixtures and added assertions ensuring every 4xx response returned a matching `correlation_id` and structured `detail`.

### Prompt 14
- **Tool**: Antigravity AI Assistant
- **Request**: "Give me a clean modern CSS reset and CSS variable palette (slate/indigo theme, neutral grays) for a responsive data table layout without using Tailwind."
- **Action Taken / Outcome**: *Edited*. Adapted the custom CSS tokens into `frontend/src/index.css` for a zero-runtime vanilla CSS design system.

### Prompt 15
- **Tool**: Antigravity AI Assistant
- **Request**: "Give me a TypeScript utility function to format UTC ISO timestamps into Asia/Kolkata (IST) time using native `Intl.DateTimeFormat`."
- **Action Taken / Outcome**: *Used as-is*. Placed in `frontend/src/utils/date.ts` to satisfy the project timestamp display requirement.

### Prompt 16
- **Tool**: Antigravity AI Assistant
- **Request**: "Generate initial React TypeScript boilerplate for a modal component that accepts a movement ID, an operator name, and a reversal reason, and submits to the reverse API."
- **Action Taken / Outcome**: *Edited*. Integrated into `LedgerHistory.tsx` with error toast handling and disabled submission buttons during pending network requests.

### Prompt 17
- **Tool**: Antigravity AI Assistant
- **Request**: "I want to add a client-side CSV export function for the stock table in TypeScript so users can export without an extra backend call."
- **Action Taken / Outcome**: *Edited*. Built `frontend/src/utils/csvExport.ts` with cell sanitization and dynamic browser download triggers for the stock matrix and ledger history views.

### Prompt 18
- **Tool**: Antigravity AI Assistant
- **Request**: "Generate realistic seed data for an Indian agricultural warehouse (KJBN Labs). I need real product names, units, realistic wholesale prices in INR, and organized bin codes."
- **Action Taken / Outcome**: *Used as-is*. Replaced generic mock items in `backend/seed.py` with certified seeds, bio-inputs, and specialized storage bays.

### Prompt 19
- **Tool**: Antigravity AI Assistant
- **Request**: "Provide a minimal multi-stage Dockerfile for a React Vite SPA served via Nginx with an SPA rewrite rule (`try_files $uri $uri/ /index.html`)."
- **Action Taken / Outcome**: *Edited*. Configured `frontend/Dockerfile` and `frontend/nginx.conf` for local container testing.

### Prompt 20
- **Tool**: Antigravity AI Assistant
- **Request**: "Create a standard GitHub Actions CI YAML workflow that caches pip and npm dependencies, runs pytest with coverage, and checks Vite build compilation on push."
- **Action Taken / Outcome**: *Edited*. Configured `.github/workflows/ci.yml` to run automated test gates on both backend and frontend.

### Prompt 21
- **Tool**: Antigravity AI Assistant
- **Request**: "How do I structure a `render.yaml` Blueprint to spin up a managed Postgres instance, a FastAPI web service running `alembic upgrade head && python seed.py`, and a static Vite frontend?"
- **Action Taken / Outcome**: *Edited*. Added database environment variable cross-references (`fromDatabase`) and static site rewrite rules in root `render.yaml`.

### Prompt 22
- **Tool**: Antigravity AI Assistant
- **Request**: "My deployed frontend loads data fine on Chrome and Safari, but on Brave browser it shows an API offline indicator. Network tab shows `/health` is blocked with `ERR_BLOCKED_BY_CLIENT` . How to fix this?"
- **Action Taken / Outcome**: *Edited*. Added a fallback in `App.tsx`: if the `/health` ping is blocked by client privacy extensions, the app makes a lightweight check against `api.getLocations()`, preventing false offline warnings while keeping the health check intact.

### Prompt 23
- **Tool**: Antigravity AI Assistant
- **Request**: "Help me proofread my draft of README.md and SUBMISSION.md. Check that all 12 README sections and the 7 SUBMISSION.md sections match the evaluation guidelines, and make sure my wording sounds clear and concise."
- **Action Taken / Outcome**: *Edited*. Integrated feedback to ensure all headings matched the specification exactly, verified word count limits on SUBMISSION.md, and ensured all technical decisions and trade-offs were explained clearly.