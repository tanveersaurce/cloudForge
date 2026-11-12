# CloudForge

**CloudForge** is an interactive AWS Cloud Architecture Builder and Infrastructure Automation Platform. It enables engineers and architects to visually design AWS topologies, validate configurations, estimate monthly costs, generate modular Terraform projects, and deploy infrastructure with explicit approval.

> **Current Status**: **Phase 02 — Authentication & Functional Dashboard**

## Architecture & Tech Stack

- **Frontend (`frontend/`)**: React, TypeScript, Vite, Tailwind CSS, React Router, Zustand, React Flow (`@xyflow/react`), Zod, Lucide Icons
- **Backend (`backend/`)**: Node.js, Express.js, TypeScript, Zod, Pino, Prisma ORM, bcryptjs, jsonwebtoken, cookie-parser, express-rate-limit
- **Database**: PostgreSQL 16 (via Docker Compose)

See the [docs/](docs/) directory for full documentation:
- [Project Overview](docs/PROJECT_OVERVIEW.md)
- [Technical Architecture](docs/TECHNICAL_ARCHITECTURE.md)
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)
- [Development Guidelines](docs/DEVELOPMENT_GUIDELINES.md)

## Quick Start (Local Development)

### Prerequisites
- Node.js `>= 20`
- npm `>= 10`
- Docker & Docker Compose

### 1. Start PostgreSQL
From the repository root:
```bash
cp .env.example .env
docker compose up -d
```

### 2. Configure and Start the Backend
```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Verify backend health and database connectivity:
```bash
curl http://localhost:4000/api/health
```

### 3. Configure and Start the Frontend
In a separate terminal:
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open the application in your browser at:
`http://localhost:5173`

## Environment Variables

### Root (`.env`)
| Variable | Default | Description |
| --- | --- | --- |
| `POSTGRES_USER` | `cloudforge` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `cloudforge_dev_password` | PostgreSQL password |
| `POSTGRES_DB` | `cloudforge` | PostgreSQL database name |
| `POSTGRES_PORT` | `5432` | Host port mapped to PostgreSQL |

### Backend (`backend/.env`)
| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | Runtime environment (`development` \| `test` \| `production`) |
| `PORT` | `4000` | Express HTTP server port |
| `DATABASE_URL` | `postgresql://cloudforge:cloudforge_dev_password@localhost:5432/cloudforge?schema=public` | PostgreSQL connection string |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin (with credentials) |
| `LOG_LEVEL` | `info` | Pino log verbosity |
| `JWT_ACCESS_SECRET` | *(required, 32+ chars)* | Signing secret for short-lived access JWTs |
| `JWT_REFRESH_SECRET` | *(required, 32+ chars)* | Signing secret for rotating refresh JWTs |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_DAYS` | `7` | Refresh session lifetime in days |
| `COOKIE_SECURE` | `false` (dev) / `true` (prod) | Sets `Secure` cookie attribute |
| `COOKIE_DOMAIN` | *(empty)* | Optional cookie domain override |

### Frontend (`frontend/.env`)
| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:4000/api` | Backend REST API base URL |
| `VITE_APP_NAME` | `CloudForge` | Application display name |

## Development Commands

### Backend (`backend/`)
- `npm run dev` — Start Express server with hot reload (`tsx watch`)
- `npm run build` — Compile TypeScript to `dist/`
- `npm run typecheck` — Run strict TypeScript type checking
- `npm test` — Run backend test suite (`vitest`)
- `npx prisma studio` — Open Prisma database GUI

### Frontend (`frontend/`)
- `npm run dev` — Start Vite dev server
- `npm run build` — Typecheck and build production bundle
- `npm run typecheck` — Run strict TypeScript type checking
- `npm test` — Run frontend test suite (`vitest`)
- `npm run preview` — Preview built production bundle locally
