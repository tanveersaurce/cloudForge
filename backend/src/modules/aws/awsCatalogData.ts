import type { AwsCategorySeed, AwsServiceSeed } from './awsCatalog.types.js';
import { AWS_CATEGORIES } from './data/categories.js';
import { CORE_AWS_SERVICES } from './data/coreServices.js';
import { PLATFORM_AWS_SERVICES } from './data/platformServices.js';

export { AWS_CATEGORIES };

export const AWS_SERVICES: AwsServiceSeed[] = [...CORE_AWS_SERVICES, ...PLATFORM_AWS_SERVICES];

export type { AwsCategorySeed, AwsServiceSeed };
