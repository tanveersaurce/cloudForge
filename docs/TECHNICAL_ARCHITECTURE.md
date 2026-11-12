# CloudForge — Technical Architecture

## 1. Architectural Style

CloudForge follows a **Modular Monolith** architecture with a clear physical separation between the **Frontend** SPA and the **Backend** REST API:

- **Frontend (`frontend/`)**: Feature-based React + TypeScript Single Page Application.
- **Backend (`backend/`)**: Module-based Express.js + TypeScript REST API backed by PostgreSQL via Prisma ORM.
- **Infrastructure (`docker-compose.yml`)**: Containerized PostgreSQL 16 database for consistent local development.

Microservices are intentionally avoided to keep deployment, type sharing, transactional integrity, and local iteration straightforward while maintaining strict internal module boundaries.

## 2. Technology Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend Framework | React 18 + TypeScript | Component-driven UI with strict static typing |
| Build Tool | Vite | Fast local HMR and optimized production bundles |
| Styling | Tailwind CSS | Utility-first dark-themed design system |
| Routing | React Router (`react-router-dom`) | Client-side navigation across workspace views |
| State Management | Zustand | Lightweight global UI and workspace state |
| Canvas Engine (Future) | React Flow (`@xyflow/react`) | Interactive AWS topology diagramming |
| Icons | Lucide React | Consistent vector iconography |
| Backend Runtime | Node.js + Express.js + TypeScript | REST API server with strict TypeScript |
| Validation & Config | Zod + dotenv | Runtime environment and payload validation |
| Logging | Pino + pino-http | Structured JSON logging and request tracing |
| Database | PostgreSQL 16 | Relational persistence for architectures and metadata |
| ORM | Prisma ORM | Type-safe database client and schema migrations |

## 3. Repository & Folder Structure

```text
cloudForge/
├── docker-compose.yml              # Local PostgreSQL service
├── .env.example                    # Root Docker database defaults
├── .gitignore
├── README.md
├── docs/
│   ├── PROJECT_OVERVIEW.md
│   ├── TECHNICAL_ARCHITECTURE.md
│   ├── IMPLEMENTATION_PLAN.md
│   └── DEVELOPMENT_GUIDELINES.md
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   ├── .env.example
│   └── src/
│       ├── components/             # Shared reusable UI primitives
│       ├── features/               # Feature-specific modules (dashboard, health)
│       ├── hooks/                  # Custom React hooks
│       ├── layouts/                # Shell layout, sidebar, top navbar
│       ├── pages/                  # Route-level page components
│       ├── services/               # HTTP client and API service functions
│       ├── store/                  # Zustand state stores
│       ├── types/                  # TypeScript domain and API interfaces
│       ├── utils/                  # Pure formatting and class utilities
│       ├── App.tsx                 # Route definitions
│       ├── main.tsx                # Application entrypoint
│       └── index.css               # Tailwind & theme tokens
└── backend/
    ├── package.json
    ├── tsconfig.json
    ├── .env.example
    ├── prisma/
    │   └── schema.prisma           # PostgreSQL datasource & initial schema
    └── src/
        ├── config/                 # Environment validation, logger, Prisma client
        ├── middleware/             # Error handler, 404 handler, request logger
        ├── modules/                # Feature modules (routes, controller, service)
        │   └── health/
        ├── services/               # Cross-module backend services
        ├── types/                  # Shared backend response & error types
        ├── utils/                  # ApiError, asyncHandler helpers
        ├── app.ts                  # Express app composition
        └── server.ts               # Server bootstrap & graceful shutdown
```

## 4. Authentication & Session Architecture (Phase 02)

CloudForge uses stateless short-lived JWT access tokens (`15m`) paired with stateful rotating refresh tokens stored as SHA-256 hashes in PostgreSQL (`RefreshSession`), delivered exclusively via `HttpOnly` cookies (`cf_access_token` and `cf_refresh_token`):

1. **Registration & Login (`POST /api/auth/register`, `POST /api/auth/login`)**:
   - Inputs validated with Zod (strong password policy enforced).
   - Passwords hashed with `bcryptjs` (cost factor 12); `passwordHash` is never returned in API responses.
   - Rate-limited via `express-rate-limit` (20 attempts per 15 minutes per IP).
2. **Protected Routes (`requireAuth` middleware)**:
   - Verifies `cf_access_token` using `JWT_ACCESS_SECRET` and confirms active user existence.
   - Protects `/api/auth/me` and `/api/dashboard/overview`.
3. **Refresh Token Rotation & Reuse Detection (`POST /api/auth/refresh`)**:
   - Atomically revokes the used `RefreshSession` and issues a new access + refresh cookie pair inside a Prisma transaction.
   - If a previously revoked refresh token is replayed, all active sessions for that user are immediately revoked.
4. **Logout (`POST /api/auth/logout`)**:
   - Marks the active `RefreshSession` revoked (`revokedAt = now`) and clears both authentication cookies.
5. **Database Models (`backend/prisma/schema.prisma`)**:
   - `User`: `id`, `name`, `email` (unique), `passwordHash`, `avatar`, timestamps.
   - `RefreshSession`: `id`, `userId`, `tokenHash` (unique), `expiresAt`, `revokedAt`, `userAgent`, `ipAddress`, `createdAt`.
   - `Architecture`: `id`, `userId` (nullable FK to `User`), `name`, `description`, `region`, `status`, `resourceCount`, timestamps.

## 5. Backend Request Lifecycle

1. **Security & Parsing**: `helmet` sets security headers; `cors` restricts origins to `CORS_ORIGIN` with `credentials: true`; `express.json()` parses JSON payloads (`1mb` limit); `cookieParser()` parses incoming cookies.
2. **Request Logging**: `requestLogger` attaches structured request/response logs via Pino.
3. **Module Routing**: Requests under `/api/*` route to `/api/health`, `/api/auth`, and `/api/dashboard`.
4. **Error Handling**: Unmatched routes pass to `notFoundHandler` (404 `ApiError`). All errors flow to `errorHandler`, returning a uniform JSON envelope without leaking stack traces in production.

## 6. Health, Catalog & Dashboard API Contracts

- **`GET /api/health`**: Returns overall service metadata and PostgreSQL connectivity (`200` when connected, `503` when disconnected).
- **`GET /api/health/live`**: Lightweight liveness probe (`200 OK`).
- **`GET /api/aws/*`** *(Phase 03)*: Serves 16 categories and 58 catalog services (`/categories`, `/services`, `/services/search`, `/services/:slug`) plus authenticated user favorites and exploration history (`/favorites`, `/recent`, `/:id/favorite`, `/:id/explore`).
- **`GET /api/dashboard/overview`** *(authenticated)*: Returns the user profile, live PostgreSQL counts (`totalArchitectures`, `savedProjects`, `awsServicesExplored`), explicit unavailable marker for Phase 04 cost engine (`estimatedMonthlyCost`), real persisted `recentArchitectures`, `favoriteServices`, `recentlyExploredServices`, `recentActivity`, and clearly labeled static `quickStartTemplates`.

## 7. Future Backend & Frontend Modules

Planned modules for upcoming phases include:
- **`architectures`**: Persistence and versioning of architecture graphs (nodes, edges, region, metadata).
- **`validation`**: Graph topology analyzer checking security, networking, and dependency rules.
- **`cost-estimator`**: Pricing catalog and monthly infrastructure cost breakdown engine.
- **`terraform-generator`**: Deterministic HCL generator and downloadable ZIP project exporter.
- **`deployments`**: Explicit AWS credential/role connection, Terraform plan preview, and approval-gated execution workflow.
