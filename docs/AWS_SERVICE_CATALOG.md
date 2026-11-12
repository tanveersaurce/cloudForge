# CloudForge — AWS Service Catalog (Phase 03)

## Overview

CloudForge's AWS Service Catalog is a centralized, metadata-driven registry designed to power:
- **Phase 03**: AWS Services Explorer (`/services`, `/services/:slug`), favorites, and exploration tracking.
- **Phase 04**: Interactive Architecture Builder node palette, property inspector defaults, and validation dependencies.
- **Phase 05**: Deterministic Terraform HCL generation (`terraformResourceTypes`).

The source of truth lives in `backend/src/modules/aws/`:
- `awsCatalog.types.ts` — TypeScript contracts (`AwsCategorySeed`, `AwsServiceSeed`, `AwsResourceDefinition`, `AwsConfigurationSchema`)
- `data/categories.ts` — 16 official AWS service categories
- `data/coreServices.ts` — 33 Compute, Containers, Storage, Networking, Database, and Security services
- `data/platformServices.ts` — 25 Serverless, Application Integration, Management, Developer Tools, Analytics, ML/AI, Migration, IoT, Media, and Business services
- `awsCatalogData.ts` — Combined catalog (`AWS_CATEGORIES`, `AWS_SERVICES`)
- `backend/prisma/seed.ts` — Idempotent upsert script (`npx prisma db seed`) that preserves existing user accounts, sessions, favorites, history, and architectures

## Catalog Coverage

- **16 AWS Categories**: Compute, Storage, Networking & Content Delivery, Database, Security Identity & Compliance, Containers, Serverless, Application Integration, Management & Governance, Developer Tools, Analytics, Machine Learning & AI, Migration & Transfer, Internet of Things, Media Services, Business Applications.
- **58 Seeded AWS Services**: Each entry includes `slug`, `name`, `shortName`, `officialServiceName`, `shortDescription`, `detailedDescription`, `iconKey`, `awsConsoleUrl`, `officialDocumentationUrl`, `primaryUseCases`, `keyFeatures`, `pricingModel`, `supportedRegions`, `relatedServiceSlugs`, `commonResources`, `configurationSchema`, `terraformSupport`, `terraformProviderAvailable`, `terraformCloudForgeStatusNote`, `terraformResourceTypes`, `terraformDocsUrl`, `supportLevel`, and `tags`.

## Services vs. Resources Distinction

CloudForge explicitly separates an **AWS Service** from the **AWS Resources** provisioned inside it:
- **Service**: `Amazon VPC` (`slug: amazon-vpc`) — the AWS networking product/service.
- **Resources (`commonResources`)**: `VPC` (`aws_vpc`), `Subnet` (`aws_subnet`), `Route Table` (`aws_route_table`), `Internet Gateway` (`aws_internet_gateway`), `Security Group` (`aws_security_group`).

## Terraform Support Semantics

CloudForge distinguishes **HashiCorp AWS Provider availability** from **CloudForge's Phase 05 HCL generator status**:
- `terraformProviderAvailable` (`boolean`): Whether HashiCorp's official `hashicorp/aws` provider exposes Terraform resource types for the service.
- `terraformSupport` (`TerraformSupportStatus`):
  - `SUPPORTED`: Core resource mapping planned/ready for Phase 05 generator.
  - `PARTIAL`: Subset of resources mapped; advanced/manual HCL customization may be required.
  - `NOT_IMPLEMENTED`: Supported by `hashicorp/aws`, generator template pending in a future phase.
  - `NOT_APPLICABLE`: Service/resource outside standard Terraform provisioning scope.
