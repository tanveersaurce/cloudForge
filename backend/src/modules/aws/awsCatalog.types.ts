import type { AwsSupportLevel, TerraformSupportStatus } from '@prisma/client';

export interface AwsCategorySeed {
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  sortOrder: number;
}

export interface AwsResourceDefinition {
  name: string;
  description: string;
  terraformResourceType?: string;
}

export interface AwsConfigProperty {
  name: string;
  type: string;
  description: string;
  example?: string;
}

export interface AwsConfigurationSchema {
  requiredProperties: AwsConfigProperty[];
  optionalProperties: AwsConfigProperty[];
  dependencies: string[];
  verificationNote: string;
}

export interface AwsServiceSeed {
  slug: string;
  name: string;
  shortName: string;
  officialServiceName: string;
  categorySlug: string;
  shortDescription: string;
  detailedDescription: string;
  iconKey: string;
  awsConsoleUrl: string;
  officialDocumentationUrl: string;
  primaryUseCases: string[];
  keyFeatures: string[];
  pricingModel: string;
  supportedRegions: string;
  relatedServiceSlugs: string[];
  commonResources: AwsResourceDefinition[];
  configurationSchema: AwsConfigurationSchema;
  terraformSupport: TerraformSupportStatus;
  terraformProviderAvailable: boolean;
  terraformCloudForgeStatusNote: string;
  terraformResourceTypes: string[];
  terraformDocsUrl: string | null;
  supportLevel: AwsSupportLevel;
  tags: string[];
}
