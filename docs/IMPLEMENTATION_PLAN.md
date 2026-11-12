# CloudForge — Implementation Plan

## Phase 01: Project Foundation & UI (Completed)

Established the monorepo foundation (`frontend/` + `backend/`), Docker Compose PostgreSQL setup, Prisma ORM, `/api/health`, structured Pino logging, and the initial dark-themed SaaS dashboard shell.

## Phase 02: Authentication & Functional Dashboard (Completed)

Delivered database-backed authentication (`User`, `RefreshSession`), `HttpOnly` cookie JWT rotation & reuse detection, rate limiting, protected routes, profile view, and personalized dashboard overview.

## Phase 03: AWS Services Explorer (Current Phase)

**Objective**: Build a reusable, metadata-driven AWS Service Catalog and Services Explorer UI integrated with PostgreSQL and the authenticated user dashboard.

### Phase 03 Deliverables
1. **Database Models & Idempotent Seeding**: `AwsCategory`, `AwsService`, `UserFavoriteService`, `UserServiceHistory` in `backend/prisma/schema.prisma`, seeded with 16 categories and 58 AWS services via `npx prisma db seed`.
2. **Backend Catalog & User Tracking APIs**: `/api/aws/categories`, `/api/aws/services`, `/api/aws/services/search`, `/api/aws/services/:slug`, `/api/aws/services/favorites`, `/api/aws/services/:id/favorite`, `/api/aws/services/recent`, `/api/aws/services/:id/explore`.
3. **Dashboard Integration**: Live `awsServicesExplored` count, `favoriteServices`, `recentlyExploredServices`, and merged `recentActivity` in `GET /api/dashboard/overview` and `DashboardPage`.
4. **Frontend Explorer & Detail UI**: `/services` and `/services/:slug` with centralized icon mapping, category sidebar, search/filter/sort/pagination, favorites, resource/configuration/Terraform readiness views, and related service navigation.
5. **Automated Tests & Docs**: Backend API integration tests (`aws.test.ts`), frontend explorer/detail/dashboard tests (`awsServices.test.tsx`), and Phase 03 documentation (`AWS_SERVICE_CATALOG.md`, `DATABASE_SCHEMA.md`, `API_DOCUMENTATION.md`).

---

## Upcoming Phases (Roadmap)

### Phase 04: Interactive Architecture Builder, Validation & Cost Estimation
- Implement full `Architecture` CRUD APIs and interactive React Flow (`@xyflow/react`) canvas backed by Phase 03 catalog metadata.
- Implement graph validation rules and AWS monthly cost estimation (`Cost Explorer`).

### Phase 05: Terraform Code Generation & Export
- Build deterministic HCL template engine mapping CloudForge nodes/edges into `main.tf`, `variables.tf`, `outputs.tf`, and `providers.tf`.
- Provide live syntax-highlighted Terraform preview (`Terraform` page) and `.zip` project export.

### Phase 06: AWS Account Integration & Approval-Gated Deployments
- Support read-only/explicitly scoped AWS account configuration in `Settings`.
- Run server-side `terraform plan` previews and store deployment audit logs.
- Enforce explicit user confirmation before any `terraform apply` or `destroy` operation (`Deployments` page).
