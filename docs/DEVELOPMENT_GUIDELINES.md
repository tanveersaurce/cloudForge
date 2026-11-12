# CloudForge — Development Guidelines

## 1. Engineering Principles

- **Strict TypeScript**: Both `frontend` and `backend` enforce `"strict": true`. Avoid `any`; prefer explicit interfaces, discriminated unions, and `unknown` with type guards or Zod schemas.
- **Modular Monolith Boundaries**:
  - Backend logic belongs in `backend/src/modules/<domain>/` split into `*.routes.ts`, `*.controller.ts`, and `*.service.ts`.
  - Controllers handle HTTP request/response mapping only; business logic and Prisma queries belong in services.
  - Frontend features belong in `frontend/src/features/<feature>/`, while generic UI primitives belong in `frontend/src/components/`.
- **No Hardcoded Secrets**: Never commit `.env` files, database passwords, or AWS credentials. Always update `.env.example` when introducing new environment variables.
- **Explicit Error Handling**:
  - Backend: Throw `ApiError` for expected operational errors and wrap async route handlers with `asyncHandler`.
  - Frontend: Handle loading, empty, and error states explicitly in UI components.

## 2. Naming Conventions

- **Files**:
  - React components and pages: `PascalCase.tsx` (e.g., `StatCardsRow.tsx`, `DashboardPage.tsx`).
  - Hooks: `camelCase.ts` prefixed with `use` (e.g., `useBackendHealth.ts`).
  - Backend modules & utilities: `kebab-case` or `camelCase` with role suffix (e.g., `health.routes.ts`, `health.controller.ts`, `errorHandler.ts`).
- **Variables & Types**:
  - Types/Interfaces: `PascalCase`.
  - Functions/Variables: `camelCase`.
  - Constants/Env keys: `SCREAMING_SNAKE_CASE`.

## 3. UI & UX Standards

- **Theme**: Dark navy/charcoal surfaces (`#0b1120`, `#111827`, `#162032`) with subtle `1px` borders (`#1e293b`) and restrained cyan/sky/emerald accents.
- **Interactive Integrity**: Every visible button, link, and menu item must trigger a real action, navigate to a route, open a drawer/modal, or display an explicit `Coming Soon` / phase state. Never render dead buttons.
- **Mock Data Transparency**: Any mock data used prior to backend integration must live in dedicated `mock*.ts` files and be clearly marked as sample/preview data in both code and UI where appropriate.

## 4. Git & Verification Workflow

- Run `npm run typecheck`, `npm run build`, and `npm test` in both `frontend` and `backend` before committing changes.
- Never store JWTs or session tokens in `localStorage` or `sessionStorage`; use `HttpOnly` cookies with `credentials: 'include'`.
- Never claim a check or test passed without running it after the final edit.
