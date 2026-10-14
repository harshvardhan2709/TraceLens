# TraceLens AI

> **AI-Powered API Failure Investigation & Regression Testing Platform**

TraceLens AI helps engineering and DevOps teams investigate failed API requests by analyzing application logs, correlating distributed traces, generating evidence-backed diagnostic hypotheses, and synthesizing reproducible regression tests.

---

## 1. Architecture Overview (Phase 1: Foundation)

```text
tracelens-ai/
├── frontend/                     # React 19 + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── api/                  # Axios HTTP client & health probe methods
│   │   ├── components/           # UI components (StatusBadge, MetricCard)
│   │   ├── layouts/              # Root layout & developer-tool header
│   │   ├── pages/                # DashboardPage, NotFoundPage
│   │   ├── routes/               # React Router navigation
│   │   ├── types/                # TypeScript domain models
│   │   ├── App.tsx               # App root
│   │   └── main.tsx              # DOM mounting point
│   ├── .env.example              # Frontend environment template
│   └── package.json
├── backend/                      # Python 3.13 + FastAPI + SQLAlchemy 2.0
│   ├── app/
│   │   ├── api/routes/           # API routes (GET /api/health, GET /api/health/db)
│   │   ├── core/                 # Settings & Pydantic config
│   │   ├── db/                   # SQLAlchemy engine, session maker, Base
│   │   ├── models/               # SQLAlchemy ORM models (Phase 2+)
│   │   ├── schemas/              # Pydantic validation schemas
│   │   ├── services/             # Diagnostic domain logic (Phase 2+)
│   │   └── main.py               # FastAPI entry point & CORS configuration
│   ├── alembic/                  # Schema migration versions & env.py
│   ├── tests/                    # pytest + HTTPX automated test suite
│   ├── alembic.ini               # Database migration configuration
│   ├── requirements.txt          # Pinned backend dependencies
│   └── .env.example              # Backend environment template
├── docs/                         # Architecture documentation & ADRs
├── .gitignore                    # Secrets, virtualenvs, and build artifacts
├── README.md                     # Setup instructions & developer guide
└── .env.example                  # Root workspace environment template
```

---

## 2. Prerequisites

| Tool | Recommended Version | Tested In This Project |
| :--- | :--- | :--- |
| **Python** | 3.11+ (or 3.13) | Python 3.13.0 |
| **Node.js** | 20.x or 22.x LTS | Node v22.22.2 |
| **npm** | 10.x+ | npm 10.9.7 |
| **PostgreSQL** | 14+ | Local or Cloud (Neon, Supabase, RDS) |

---

## 3. Quickstart & Installation

### Step A: Backend Setup

#### 1. Navigate to backend and create a virtual environment
```powershell
# In PowerShell (Windows):
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# In Bash (macOS/Linux):
# cd backend
# python3 -m venv .venv
# source .venv/bin/activate
```

#### 2. Install dependencies
```powershell
pip install -r requirements.txt
```

#### 3. Create your local environment configuration
Copy the template into `.env`:
```powershell
Copy-Item .env.example .env
# In Bash: cp .env.example .env
```

#### 4. Run automated backend tests
```powershell
pytest -v
```

#### 5. Start the FastAPI development server
```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- API Base URL: `http://127.0.0.1:8000`
- Swagger Interactive Docs: `http://127.0.0.1:8000/api/docs`
- Health Endpoint: `http://127.0.0.1:8000/api/health`
- Database Probe: `http://127.0.0.1:8000/api/health/db`

---

### Step B: Database Setup (PostgreSQL)

TraceLens AI connects via modern `SQLAlchemy 2.0` with the `psycopg` (psycopg 3) driver:

1. Create a database named `tracelens` in your PostgreSQL instance.
2. Configure `DATABASE_URL` in `backend/.env`:
   ```bash
   DATABASE_URL="postgresql+psycopg://<username>:<password>@localhost:5432/tracelens"
   ```
3. Run Alembic migrations:
   ```powershell
   cd backend
   alembic upgrade head
   ```

*Note: If PostgreSQL is not yet running locally, the FastAPI service will still start cleanly and report database connection status via `GET /api/health/db` without crashing.*

---

### Step C: Frontend Setup

#### 1. Navigate to frontend and install dependencies
```powershell
cd frontend
npm install
```

#### 2. Create frontend environment configuration
```powershell
Copy-Item .env.example .env
# In Bash: cp .env.example .env
```

#### 3. Start the Vite development server
```powershell
npm run dev
```
- Frontend UI: `http://127.0.0.1:5173`

---

## 4. API Endpoints (Phase 1)

| Method | Path | Description | Expected Status |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service status, project name, version, and environment | `200 OK` |
| `GET` | `/api/health/db` | Probes PostgreSQL connectivity via `SELECT 1` | `200 OK` (connected) / `503 Service Unavailable` |
| `GET` | `/api/docs` | Swagger UI documentation | `200 OK` |
| `GET` | `/api/openapi.json` | OpenAPI 3.1 specification schema | `200 OK` |

---

## 5. Security & Hygiene Rules

- **Zero Secret Commits**: Real credentials, `.env` files, and connection strings are excluded by root `.gitignore`.
- **Environment Driven**: Both backend and frontend dynamically read configuration from environment files (`.env`).
- **CORS Restricted**: Backend CORS is explicitly restricted to local Vite dev server origins (`http://localhost:5173`, `http://127.0.0.1:5173`).
