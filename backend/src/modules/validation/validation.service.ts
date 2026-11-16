import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { ArchitectureValidationEngine } from './engine/validationEngine.js';
import { validationRegistry } from './engine/validationRegistry.js';
import type {
  RuleExecutionContext,
  ValidationEngineResult,
  ValidationRuleMetadata,
} from './types/validation.types.js';

// Cache for in-memory validation results indexed by architectureId
interface CachedValidationEntry {
  result: ValidationEngineResult;
  architectureUpdatedAt: string;
}

const validationCache = new Map<string, CachedValidationEntry>();

export class ValidationService {
  /**
   * Invalidates cached validation results for a specific architecture,
   * or clears the entire validation cache if no architectureId is provided.
   */
  public static invalidateCache(architectureId?: string): void {
    if (architectureId) {
      validationCache.delete(architectureId);
    } else {
      validationCache.clear();
    }
  }

  /**
   * Alias to invalidate entire cache (useful for testing or full resets).
   */
  public static clearCache(): void {
    validationCache.clear();
  }

  /**
   * Returns whether a valid, fresh cache entry exists for the given architecture.
   */
  public static hasFreshCache(architectureId: string, currentUpdatedAt: Date): boolean {
    const entry = validationCache.get(architectureId);
    if (!entry) return false;
    return entry.architectureUpdatedAt === currentUpdatedAt.toISOString();
  }

  public static async validateArchitecture(
    architectureId: string,
    userId: string,
  ): Promise<ValidationEngineResult> {
    const architecture = await prisma.architecture.findUnique({
      where: { id: architectureId },
    });

    if (!architecture) {
      throw ApiError.notFound('Architecture not found');
    }

    if (architecture.userId !== userId) {
      throw new ApiError(403, 'You do not have access to this architecture', 'FORBIDDEN');
    }

    const nodes = (architecture.nodes as unknown as RuleExecutionContext['nodes']) || [];
    const edges = (architecture.edges as unknown as RuleExecutionContext['edges']) || [];

    const context: RuleExecutionContext = {
      architectureId,
      nodes,
      edges,
    };

    const result = ArchitectureValidationEngine.validate(context);

    // Concurrency protection: Store with the architecture's timestamp at time of validation
    validationCache.set(architectureId, {
      result,
      architectureUpdatedAt: architecture.updatedAt.toISOString(),
    });

    return result;
  }

  public static async getValidationResults(
    architectureId: string,
    userId: string,
  ): Promise<ValidationEngineResult> {
    const architecture = await prisma.architecture.findUnique({
      where: { id: architectureId },
    });

    if (!architecture) {
      throw ApiError.notFound('Architecture not found');
    }

    if (architecture.userId !== userId) {
      throw new ApiError(403, 'You do not have access to this architecture', 'FORBIDDEN');
    }

    const cached = validationCache.get(architectureId);
    // If cache exists and architecture has not been modified since validation, return cached result
    if (cached && cached.architectureUpdatedAt === architecture.updatedAt.toISOString()) {
      return cached.result;
    }

    // If cache is missing or stale because architecture changed, re-run validation
    if (cached) {
      validationCache.delete(architectureId);
    }

    const nodes = (architecture.nodes as unknown as RuleExecutionContext['nodes']) || [];
    const edges = (architecture.edges as unknown as RuleExecutionContext['edges']) || [];

    const context: RuleExecutionContext = {
      architectureId,
      nodes,
      edges,
    };

    const freshResult = ArchitectureValidationEngine.validate(context);
    validationCache.set(architectureId, {
      result: freshResult,
      architectureUpdatedAt: architecture.updatedAt.toISOString(),
    });

    return freshResult;
  }

  public static listRules(): ValidationRuleMetadata[] {
    return validationRegistry.getAllMetadata();
  }

  public static getRule(ruleId: string): ValidationRuleMetadata {
    const rule = validationRegistry.getRule(ruleId);
    if (!rule) {
      throw ApiError.notFound(`Validation rule "${ruleId}" not found`);
    }
    return rule.metadata;
  }
}
