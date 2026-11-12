-- CreateEnum
CREATE TYPE "TerraformSupportStatus" AS ENUM ('SUPPORTED', 'PARTIAL', 'NOT_IMPLEMENTED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "AwsSupportLevel" AS ENUM ('CORE', 'STANDARD', 'EXTENDED', 'PREVIEW');

-- CreateTable
CREATE TABLE "aws_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aws_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aws_services" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "officialServiceName" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "detailedDescription" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL,
    "awsConsoleUrl" TEXT NOT NULL,
    "officialDocumentationUrl" TEXT NOT NULL,
    "primaryUseCases" TEXT[],
    "keyFeatures" TEXT[],
    "pricingModel" TEXT NOT NULL,
    "supportedRegions" TEXT NOT NULL,
    "relatedServiceSlugs" TEXT[],
    "commonResources" JSONB NOT NULL,
    "configurationSchema" JSONB NOT NULL,
    "terraformSupport" "TerraformSupportStatus" NOT NULL,
    "terraformProviderAvailable" BOOLEAN NOT NULL DEFAULT true,
    "terraformCloudForgeStatusNote" TEXT NOT NULL,
    "terraformResourceTypes" TEXT[],
    "terraformDocsUrl" TEXT,
    "supportLevel" "AwsSupportLevel" NOT NULL DEFAULT 'STANDARD',
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aws_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_favorite_services" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_favorite_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_service_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 1,
    "firstExploredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastExploredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_service_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aws_categories_slug_key" ON "aws_categories"("slug");

-- CreateIndex
CREATE INDEX "aws_categories_sortOrder_idx" ON "aws_categories"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "aws_services_slug_key" ON "aws_services"("slug");

-- CreateIndex
CREATE INDEX "aws_services_categoryId_idx" ON "aws_services"("categoryId");

-- CreateIndex
CREATE INDEX "aws_services_terraformSupport_idx" ON "aws_services"("terraformSupport");

-- CreateIndex
CREATE INDEX "aws_services_supportLevel_idx" ON "aws_services"("supportLevel");

-- CreateIndex
CREATE INDEX "aws_services_name_idx" ON "aws_services"("name");

-- CreateIndex
CREATE INDEX "user_favorite_services_userId_createdAt_idx" ON "user_favorite_services"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_favorite_services_userId_serviceId_key" ON "user_favorite_services"("userId", "serviceId");

-- CreateIndex
CREATE INDEX "user_service_history_userId_lastExploredAt_idx" ON "user_service_history"("userId", "lastExploredAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_service_history_userId_serviceId_key" ON "user_service_history"("userId", "serviceId");

-- AddForeignKey
ALTER TABLE "aws_services" ADD CONSTRAINT "aws_services_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "aws_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorite_services" ADD CONSTRAINT "user_favorite_services_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorite_services" ADD CONSTRAINT "user_favorite_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "aws_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_service_history" ADD CONSTRAINT "user_service_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_service_history" ADD CONSTRAINT "user_service_history_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "aws_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
