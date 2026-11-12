# CloudForge — Implementation Plan

## Phase 01: Project Foundation & UI (Completed)

Established the monorepo foundation (`frontend/` + `backend/`), Docker Compose PostgreSQL setup, Prisma ORM, `/api/health`, structured Pino logging, and the initial dark-themed SaaS dashboard shell.

## Phase 02: Authentication & Functional Dashboard (Current Phase)

**Objective**: Transform CloudForge into a secure, authenticated application with real database-backed user sessions and personalized dashboard data.

### Phase 02 Deliverables
1. **Database Models & Migration**: `User`, `RefreshSession`, and user-extensible `Architecture` models in `backend/prisma/schema.prisma`.
2. **Authentication APIs**: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh` (with rotation & reuse detection), `POST /api/auth/logout`, and `GET /api/auth/me`.
3. **Dashboard API**: `GET /api/dashboard/overview` returning real architecture counts, empty states for new users, and explicit unavailable flags for Phase 03–04 engines.
4. **Frontend Auth & Session Flow**: Login, Registration (with password strength meter), Profile page, `ProtectedRoute` / `PublicOnlyRoute`, automatic `401` single-flight refresh, and User Profile Menu with logout.
5. **Automated Tests**: Backend API/auth integration tests (`vitest` + `supertest`) and frontend form/redirect/dashboard/logout tests (`vitest` + React Testing Library).

---

## Upcoming Phases (Roadmap)

### Phase 03: AWS Service Catalog & Interactive Architecture Builder
- Seed AWS service catalog metadata and implement full `Architecture` CRUD APIs.
- Implement the visual canvas using `@xyflow/react` with drag-and-drop AWS service nodes, VPC/Subnet grouping, and property inspector.

### Phase 04: Architecture Validation & Cost Estimation
- Implement graph validation rules (e.g., public subnet routing, missing IAM/security boundaries, orphaned resources).
- Display inline node warnings and a validation summary drawer.
- Implement AWS cost estimation service with per-resource monthly pricing calculators and cost breakdown view (`Cost Explorer`).

### Phase 05: Terraform Code Generation & Export
- Build deterministic HCL template engine mapping CloudForge nodes/edges into `main.tf`, `variables.tf`, `outputs.tf`, and `providers.tf`.
- Provide live syntax-highlighted Terraform preview (`Terraform` page) and `.zip` project export.

### Phase 06: AWS Account Integration & Approval-Gated Deployments
- Support read-only/explicitly scoped AWS account configuration in `Settings`.
- Run server-side `terraform plan` previews and store deployment audit logs.
- Enforce explicit user confirmation before any `terraform apply` or `destroy` operation (`Deployments` page).
