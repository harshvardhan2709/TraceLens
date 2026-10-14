# TraceLens AI

> **AI-Powered API Failure Investigation & Regression Testing Platform**

TraceLens AI helps engineering and DevOps teams investigate failed API requests by analyzing application logs, correlating distributed traces, generating evidence-backed diagnostic hypotheses, and synthesizing reproducible regression tests.

---

## 1. Architecture Overview

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
├── backend/                      # Python 3.13 + FastAPI + PyMongo Async API
│   ├── app/
│   │   ├── api/routes/           # API routes (GET /api/health, GET /api/health/db)
│   │   ├── core/                 # Settings & Pydantic config (MONGODB_URL)
│   │   ├── db/                   # PyMongo AsyncMongoClient lifecycle & collections
│   │   │   ├── mongo.py          # Connection pool, health check, index creation
│   │   │   └── __init__.py       # Database package exports
│   │   ├── models/               # Data model schemas (Phase 2)
│   │   ├── schemas/              # Pydantic validation schemas
│   │   ├── services/             # Diagnostic domain logic (Phase 2)
│   │   └── main.py               # FastAPI entry point, lifespan, & CORS
│   ├── tests/                    # pytest + HTTPX automated test suite
│   ├── requirements.txt          # Pinned backend dependencies
│   └── .env.example              # Backend environment template
├── docs/                         # Architecture documentation & ADRs
├── .gitignore                    # Secrets, virtualenvs, and data files
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
| **MongoDB** | 6.0+ or 7.0+ | MongoDB 7.0 (Local or Atlas) |

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

### Step B: Database Setup (MongoDB)

TraceLens AI connects asynchronously via PyMongo's modern `AsyncMongoClient` (PyMongo 4.9+):

#### Option 1: Local MongoDB Server
1. If running as a Windows Service:
   ```powershell
   # In an elevated PowerShell / Command Prompt:
   net start MongoDB
   ```
2. Or run `mongod` directly:
   ```powershell
   mongod --dbpath backend/data/db --bind_ip 127.0.0.1 --port 27017
   ```
3. Set your configuration in `backend/.env`:
   ```bash
   MONGODB_URL="mongodb://127.0.0.1:27017"
   MONGODB_DATABASE="tracelens"
   MONGODB_TIMEOUT_MS=2000
   ```

#### Option 2: Managed MongoDB (MongoDB Atlas)
1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Create a database user and allow your IP in Network Access.
3. Set your connection string in `backend/.env`:
   ```bash
   MONGODB_URL="mongodb+srv://<username>:<password>@<cluster-url>/tracelens?retryWrites=true&w=majority"
   MONGODB_DATABASE="tracelens"
   ```

*Note: If MongoDB is unavailable when the backend starts, the FastAPI service will still start cleanly and report database connection status via `GET /api/health/db` without crashing.*

---

### Step C: Database Collections & Index Planning

TraceLens AI organizes data across two separate collections to prevent document unbounded growth:

1. **`incidents`**:
   - Stores failure incident metadata, severity status, and investigation lifecycle.
   - Indexes:
     - `status`: Ascending (`idx_incident_status`)
     - `created_at`: Descending (`idx_incident_created_at`)

2. **`log_events`**:
   - Stores individual searchable log entries correlated with an incident.
   - Indexes:
     - `incident_id`: Ascending (`idx_log_incident_id`)
     - `timestamp`: Descending (`idx_log_timestamp`)
     - Compound `("incident_id", 1), ("timestamp", -1)` (`idx_log_incident_timestamp`)
     - `severity`: Ascending (`idx_log_severity`)
     - `request_id`: Ascending, sparse (`idx_log_request_id`)

Indexes are verified and initialized automatically during application lifespan startup when the database is connected.

---

### Step D: Frontend Setup

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

## 4. API Endpoints

| Method | Path | Description | Expected Status |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service status, project name, version, and environment | `200 OK` |
| `GET` | `/api/health/db` | Probes MongoDB connectivity via `client.admin.command('ping')` | `200 OK` (connected) / `503 Service Unavailable` |
| `GET` | `/api/docs` | Swagger UI documentation | `200 OK` |
| `GET` | `/api/openapi.json` | OpenAPI 3.1 specification schema | `200 OK` |

---

## 5. Security & Hygiene Rules

- **Zero Secret Commits**: Real credentials, `.env` files, connection strings, and local database data folders (`data/`, `backend/data/`) are excluded by root `.gitignore`.
- **Environment Driven**: Both backend and frontend dynamically read configuration from environment files (`.env`).
- **CORS Restricted**: Backend CORS is explicitly restricted to local Vite dev server origins (`http://localhost:5173`, `http://127.0.0.1:5173`).
