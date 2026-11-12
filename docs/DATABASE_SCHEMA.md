# CloudForge — Database Schema

CloudForge uses **PostgreSQL 16** managed by **Prisma ORM** (`backend/prisma/schema.prisma`).

## Enums

- **`TerraformSupportStatus`**: `SUPPORTED`, `PARTIAL`, `NOT_IMPLEMENTED`, `NOT_APPLICABLE`
- **`AwsSupportLevel`**: `CORE`, `STANDARD`, `EXTENDED`, `PREVIEW`

## Models

### `User`
- `id` (`String`, CUID primary key)
- `name` (`String`)
- `email` (`String`, unique)
- `passwordHash` (`String`)
- `avatar` (`String?`)
- `createdAt`, `updatedAt` (`DateTime`)
- Relations: `refreshSessions`, `architectures`, `favoriteServices`, `serviceHistory`

### `RefreshSession`
- `id` (`String`, CUID primary key)
- `userId` (`String`, FK -> `User.id` onDelete Cascade)
- `tokenHash` (`String`, unique SHA-256 hash)
- `expiresAt`, `revokedAt?`, `createdAt`
- `userAgent?`, `ipAddress?`
- Indexes: `userId`, `expiresAt`

### `Architecture`
- `id` (`String`, CUID primary key)
- `userId` (`String?`, FK -> `User.id` onDelete SetNull)
- `name`, `description?`, `region`, `status`, `resourceCount`
- `createdAt`, `updatedAt`
- Indexes: `userId`, `updatedAt`

### `AwsCategory`
- `id` (`String`, CUID primary key)
- `slug` (`String`, unique)
- `name` (`String`, unique)
- `description` (`String`)
- `iconKey` (`String`)
- `sortOrder` (`Int`, default `0`)
- `createdAt`, `updatedAt`
- Relation: `services` (`AwsService[]`)
- Index: `sortOrder`

### `AwsService`
- `id` (`String`, CUID primary key)
- `slug` (`String`, unique)
- `name`, `shortName`, `officialServiceName`
- `categoryId` (`String`, FK -> `AwsCategory.id` onDelete Restrict)
- `shortDescription`, `detailedDescription`, `iconKey`
- `awsConsoleUrl`, `officialDocumentationUrl`
- `primaryUseCases` (`String[]`), `keyFeatures` (`String[]`)
- `pricingModel`, `supportedRegions`
- `relatedServiceSlugs` (`String[]`)
- `commonResources` (`Json`), `configurationSchema` (`Json`)
- `terraformSupport` (`TerraformSupportStatus`), `terraformProviderAvailable` (`Boolean`), `terraformCloudForgeStatusNote`, `terraformResourceTypes` (`String[]`), `terraformDocsUrl?`
- `supportLevel` (`AwsSupportLevel`), `tags` (`String[]`), `isActive` (`Boolean`)
- `createdAt`, `updatedAt`
- Indexes: `categoryId`, `name`, `terraformSupport`, `supportLevel`

### `UserFavoriteService`
- `id` (`String`, CUID primary key)
- `userId` (`String`, FK -> `User.id` onDelete Cascade)
- `serviceId` (`String`, FK -> `AwsService.id` onDelete Cascade)
- `createdAt` (`DateTime`)
- Unique constraint: `(userId, serviceId)`
- Indexes: `userId`, `serviceId`

### `UserServiceHistory`
- `id` (`String`, CUID primary key)
- `userId` (`String`, FK -> `User.id` onDelete Cascade)
- `serviceId` (`String`, FK -> `AwsService.id` onDelete Cascade)
- `viewCount` (`Int`, default `1`)
- `lastExploredAt` (`DateTime`, default `now()`)
- `createdAt` (`DateTime`)
- Unique constraint: `(userId, serviceId)`
- Indexes: `(userId, lastExploredAt)`

## Seeding

Run idempotent catalog seeding without wiping user records:
```bash
cd backend
npx prisma db seed
```
