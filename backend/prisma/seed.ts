import { Prisma, PrismaClient } from '@prisma/client';
import { AWS_CATEGORIES, AWS_SERVICES } from '../src/modules/aws/awsCatalogData.js';

const prisma = new PrismaClient();

export async function seedAwsCatalog(client: PrismaClient = prisma): Promise<{
  categoriesCount: number;
  servicesCount: number;
}> {
  const categoryIdBySlug = new Map<string, string>();

  for (const cat of AWS_CATEGORIES) {
    const upserted = await client.awsCategory.upsert({
      where: { slug: cat.slug },
      create: {
        slug: cat.slug,
        name: cat.name,
        description: cat.description,
        iconKey: cat.iconKey,
        sortOrder: cat.sortOrder,
      },
      update: {
        name: cat.name,
        description: cat.description,
        iconKey: cat.iconKey,
        sortOrder: cat.sortOrder,
      },
    });
    categoryIdBySlug.set(cat.slug, upserted.id);
  }

  for (const svc of AWS_SERVICES) {
    const categoryId = categoryIdBySlug.get(svc.categorySlug);
    if (!categoryId) {
      throw new Error(`Unknown categorySlug "${svc.categorySlug}" for service "${svc.slug}"`);
    }

    const commonResourcesJson = svc.commonResources as unknown as Prisma.InputJsonValue;
    const configurationSchemaJson = svc.configurationSchema as unknown as Prisma.InputJsonValue;

    await client.awsService.upsert({
      where: { slug: svc.slug },
      create: {
        slug: svc.slug,
        name: svc.name,
        shortName: svc.shortName,
        officialServiceName: svc.officialServiceName,
        categoryId,
        shortDescription: svc.shortDescription,
        detailedDescription: svc.detailedDescription,
        iconKey: svc.iconKey,
        awsConsoleUrl: svc.awsConsoleUrl,
        officialDocumentationUrl: svc.officialDocumentationUrl,
        primaryUseCases: svc.primaryUseCases,
        keyFeatures: svc.keyFeatures,
        pricingModel: svc.pricingModel,
        supportedRegions: svc.supportedRegions,
        relatedServiceSlugs: svc.relatedServiceSlugs,
        commonResources: commonResourcesJson,
        configurationSchema: configurationSchemaJson,
        terraformSupport: svc.terraformSupport,
        terraformProviderAvailable: svc.terraformProviderAvailable,
        terraformCloudForgeStatusNote: svc.terraformCloudForgeStatusNote,
        terraformResourceTypes: svc.terraformResourceTypes,
        terraformDocsUrl: svc.terraformDocsUrl,
        supportLevel: svc.supportLevel,
        tags: svc.tags,
      },
      update: {
        name: svc.name,
        shortName: svc.shortName,
        officialServiceName: svc.officialServiceName,
        categoryId,
        shortDescription: svc.shortDescription,
        detailedDescription: svc.detailedDescription,
        iconKey: svc.iconKey,
        awsConsoleUrl: svc.awsConsoleUrl,
        officialDocumentationUrl: svc.officialDocumentationUrl,
        primaryUseCases: svc.primaryUseCases,
        keyFeatures: svc.keyFeatures,
        pricingModel: svc.pricingModel,
        supportedRegions: svc.supportedRegions,
        relatedServiceSlugs: svc.relatedServiceSlugs,
        commonResources: commonResourcesJson,
        configurationSchema: configurationSchemaJson,
        terraformSupport: svc.terraformSupport,
        terraformProviderAvailable: svc.terraformProviderAvailable,
        terraformCloudForgeStatusNote: svc.terraformCloudForgeStatusNote,
        terraformResourceTypes: svc.terraformResourceTypes,
        terraformDocsUrl: svc.terraformDocsUrl,
        supportLevel: svc.supportLevel,
        tags: svc.tags,
      },
    });
  }

  return {
    categoriesCount: AWS_CATEGORIES.length,
    servicesCount: AWS_SERVICES.length,
  };
}

async function main() {
  const result = await seedAwsCatalog();
  console.log(
    `Seeded ${result.categoriesCount} AWS categories and ${result.servicesCount} AWS services.`,
  );
}

main()
  .catch((err) => {
    console.error('Failed to seed AWS catalog:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
