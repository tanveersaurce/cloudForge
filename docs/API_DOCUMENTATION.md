# CloudForge — API Documentation

Base URL (local development): `http://localhost:4000/api`

All responses follow a uniform JSON envelope:
- Success: `{ "success": true, "data": ... }`
- Error: `{ "success": false, "error": { "code": "...", "message": "...", "details"?: ... } }`

---

## Health Endpoints

- `GET /api/health` — Returns backend metadata and PostgreSQL connectivity (`200` connected, `503` disconnected).
- `GET /api/health/live` — Liveness probe (`200`).

---

## Authentication Endpoints (`/api/auth`)

Uses `HttpOnly` cookies (`cf_access_token`, `cf_refresh_token`) with rotating refresh sessions and rate limiting (20 requests / 15 min on auth endpoints).

- `POST /api/auth/register` — Register user (`name`, `email`, `password`) and set auth cookies.
- `POST /api/auth/login` — Authenticate credentials and set auth cookies.
- `POST /api/auth/refresh` — Rotate refresh token, revoke old session, detect token reuse, and issue new cookies.
- `POST /api/auth/logout` — Revoke current refresh session and clear cookies.
- `GET /api/auth/me` *(Authenticated)* — Return current user profile.

---

## Dashboard Endpoint (`/api/dashboard`)

- `GET /api/dashboard/overview` *(Authenticated)*
  Returns:
  - `user`
  - `metrics`: `totalArchitectures`, `savedProjects`, `awsServicesExplored` (`available: true`, `value`, `totalCatalogServices`, `statusLabel`), `estimatedMonthlyCost` (`available: false`, Phase 04)
  - `recentArchitectures`
  - `favoriteServices` (up to 4 pinned services)
  - `recentlyExploredServices` (up to 4 recently viewed services)
  - `quickStartTemplates`
  - `recentActivity` (merged account, architecture, and service exploration events)

---

## AWS Services Explorer Endpoints (`/api/aws`)

### Public / Optional-Auth Catalog Read Endpoints
When authenticated via cookies, `isFavorite` reflects the signed-in user's bookmarks.

- `GET /api/aws/categories`
  Returns all 16 AWS categories ordered by `sortOrder` with active `serviceCount`.
- `GET /api/aws/services`
  Query parameters: `page` (default `1`), `limit` (default `12`, max `100`), `q`, `category` (slug or `all`), `terraformSupport`, `supportLevel`, `sort` (`name_asc | name_desc | category`), `favoritesOnly` (`true | false`).
- `GET /api/aws/services/search`
  Requires `q` and supports the same filter/pagination parameters as `/api/aws/services`.
- `GET /api/aws/services/:slug`
  Returns full `AwsServiceDetailDto` including `commonResources`, `configurationSchema`, Terraform readiness metadata, and resolved `relatedServices`.

### User-Scoped Favorites & Exploration Endpoints *(Authenticated)*

- `GET /api/aws/services/favorites` — Paginated list of the user's favorited AWS services.
- `POST /api/aws/services/:id/favorite` — Idempotently add an AWS service to favorites.
- `DELETE /api/aws/services/:id/favorite` — Remove an AWS service from favorites.
- `GET /api/aws/services/recent` — Paginated list of recently explored AWS services ordered by `lastExploredAt DESC`.
- `POST /api/aws/services/:id/explore` — Upsert `UserServiceHistory` (`viewCount` incremented, `lastExploredAt` updated).
