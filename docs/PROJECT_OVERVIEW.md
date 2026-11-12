# CloudForge — Project Overview

## 1. Product Vision

**CloudForge** is an interactive AWS Cloud Architecture Builder and Infrastructure Automation Platform designed to bridge the gap between visual cloud system design and production-ready Infrastructure as Code (IaC).

Instead of treating cloud architecture diagrams and infrastructure provisioning as separate workflows, CloudForge unifies visual design, architectural validation, cost awareness, Terraform code generation, and controlled deployment into a single platform.

## 2. Core Capabilities (Full Product Roadmap)

Over time, CloudForge will enable cloud engineers, DevOps teams, and architects to:

1. **Explore AWS Services**: Browse major AWS service categories (Compute, Networking, Storage, Databases, Security & Identity, Serverless, Messaging, Observability) with clear use-case guidance and architectural patterns.
2. **Visual Architecture Canvas**: Drag and drop AWS services onto an interactive node-and-edge canvas (`@xyflow/react`), group resources into VPCs/Subnets/Availability Zones, and connect dependencies visually.
3. **Resource Configuration**: Inspect and edit structured resource properties (e.g., instance types, CIDR blocks, storage encryption, scaling policies) through validated configuration forms.
4. **Architecture Validation**: Detect misconfigurations, circular dependencies, missing networking links, and security anti-patterns before generating IaC.
5. **Monthly Cost Estimation**: Estimate monthly AWS infrastructure costs dynamically based on selected services, sizing, and region assumptions.
6. **Terraform Generation & Export**: Deterministically compile visual architecture graphs into modular, clean HCL Terraform configurations and export complete Terraform projects.
7. **AWS Account Integration & Controlled Deployment**: Optionally connect an AWS account using explicit, least-privilege credentials/roles, run plan previews, and execute deployments only with explicit user approval.

## 3. Target Users

- **DevOps & Platform Engineers**: Rapidly prototype, validate, and scaffold standardized AWS environments.
- **Solutions Architects**: Design visual topologies with real-time cost visibility and exportable IaC artifacts.
- **Software Teams**: Understand AWS service tradeoffs using curated starter templates before committing to production infrastructure.

## 4. Current Scope — Phase 02

Phase 02 builds on the Phase 01 foundation to deliver **Authentication & Functional Dashboard**:
- Secure user registration, login, session restoration, refresh-token rotation/revocation, and logout using `HttpOnly` cookies (`bcryptjs`, `jsonwebtoken`, `cookie-parser`, `express-rate-limit`).
- PostgreSQL persistence for `User`, `RefreshSession`, and user-owned `Architecture` records via Prisma ORM.
- Protected backend routes (`GET /api/auth/me`, `GET /api/dashboard/overview`) returning real database-backed architecture counts and honest empty/unavailable states for unimplemented Phase 03+ modules.
- Protected frontend routes, login/registration/profile pages, password strength feedback, and a functional authenticated dashboard.

Actual AWS integrations, AWS service catalog, visual canvas editing, cost engines, Terraform code generation, and cloud deployments remain deferred to Phases 03–06.
