export type TerraformSupportStatus =
  | 'SUPPORTED'
  | 'PARTIAL'
  | 'NOT_IMPLEMENTED'
  | 'NOT_APPLICABLE';

export type AwsSupportLevel = 'CORE' | 'STANDARD' | 'EXTENDED' | 'PREVIEW';

export type ServiceSortOption = 'name_asc' | 'name_desc' | 'category';

export interface AwsCategoryDto {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  sortOrder: number;
  serviceCount: number;
}

export interface AwsServiceCategorySummary {
  id: string;
  slug: string;
  name: string;
  iconKey: string;
}

export interface AwsServiceListItemDto {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  officialServiceName: string;
  shortDescription: string;
  iconKey: string;
  terraformSupport: TerraformSupportStatus | string;
  terraformProviderAvailable: boolean;
  supportLevel: AwsSupportLevel | string;
  tags: string[];
  category: AwsServiceCategorySummary;
  isFavorite: boolean;
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

export interface AwsServiceDetailDto extends AwsServiceListItemDto {
  detailedDescription: string;
  awsConsoleUrl: string;
  officialDocumentationUrl: string;
  primaryUseCases: string[];
  keyFeatures: string[];
  pricingModel: string;
  supportedRegions: string;
  commonResources: AwsResourceDefinition[];
  configurationSchema: AwsConfigurationSchema;
  terraformCloudForgeStatusNote: string;
  terraformResourceTypes: string[];
  terraformDocsUrl: string | null;
  relatedServices: AwsServiceListItemDto[];
}

export interface RecentlyExploredServiceDto extends AwsServiceListItemDto {
  viewCount: number;
  lastExploredAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedServicesResponse<T = AwsServiceListItemDto> {
  items: T[];
  pagination: PaginationMeta;
  appliedFilters?: {
    q: string | null;
    category: string | null;
    terraformSupport: string | null;
    supportLevel: string | null;
    sort: ServiceSortOption;
    favoritesOnly: boolean;
  };
}

export interface ListServicesParams {
  page?: number;
  limit?: number;
  q?: string;
  category?: string;
  terraformSupport?: TerraformSupportStatus | '';
  supportLevel?: AwsSupportLevel | '';
  sort?: ServiceSortOption;
  favoritesOnly?: boolean;
}
