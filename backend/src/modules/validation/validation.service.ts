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
export interface CachedValidationEntry {
  result: ValidationEngineResult;
  architectureUpdatedAt: string;
  cachedAt: number;
}

const validationCache = new Map<string, CachedValidationEntry>();
const inFlightValidations = new Map<string, Promise<ValidationEngineResult>>();
const cacheInvalidationTimestamps = new Map<string, number>();
let globalInvalidatedAt = 0;

export class ValidationService {
  /**
   * Invalidates cached validation results for a specific architecture,
   * or clears the entire validation cache if no architectureId is provided.
   */
  public static invalidateCache(architectureId?: string): void {
    const now = Date.now();
    if (architectureId) {
      validationCache.delete(architectureId);
      for (const key of inFlightValidations.keys()) {
        if (key.startsWith(`${architectureId}:`)) {
          inFlightValidations.delete(key);
        }
      }
      cacheInvalidationTimestamps.set(architectureId, now);
    } else {
      validationCache.clear();
      inFlightValidations.clear();
      cacheInvalidationTimestamps.clear();
      globalInvalidatedAt = now;
    }
  }

  /**
   * Alias to invalidate entire cache (useful for testing or full resets).
   */
  public static clearCache(): void {
    ValidationService.invalidateCache();
  }

  /**
   * Returns whether a valid, fresh cache entry exists for the given architecture.
   */
  public static hasFreshCache(architectureId: string, currentUpdatedAt: Date): boolean {
    const entry = validationCache.get(architectureId);
    if (!entry) return false;
    return entry.architectureUpdatedAt === currentUpdatedAt.toISOString();
  }

  /**
   * Diagnostic helper: returns whether a validation is currently in flight for architectureId.
   */
  public static isValidationInFlight(architectureId: string): boolean {
    for (const key of inFlightValidations.keys()) {
      if (key.startsWith(`${architectureId}:`)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Diagnostic helper: returns the cached entry for testing inspection.
   */
  public static getCachedEntry(architectureId: string): CachedValidationEntry | undefined {
    return validationCache.get(architectureId);
  }

  private static async runValidation(
    architectureId: string,
    architectureUpdatedAt: Date,
    nodes: RuleExecutionContext['nodes'],
    edges: RuleExecutionContext['edges'],
    startTime: number,
  ): Promise<ValidationEngineResult> {
    const context: RuleExecutionContext = {
      architectureId,
      nodes,
      edges,
    };

    const result = ArchitectureValidationEngine.validate(context);

    // Stale write prevention: check if invalidated or updated while in flight
    const lastInvalidated = Math.max(
      cacheInvalidationTimestamps.get(architectureId) || 0,
      globalInvalidatedAt,
    );

    if (lastInvalidated > startTime) {
      // Invalidation occurred while validation was executing; discard from cache
      return result;
    }

    const existing = validationCache.get(architectureId);
    if (existing && new Date(existing.architectureUpdatedAt).getTime() > architectureUpdatedAt.getTime()) {
      // Existing cache entry is newer than this result's snapshot; do not overwrite
      return result;
    }

    // Cache the fresh result with execution metadata
    validationCache.set(architectureId, {
      result,
      architectureUpdatedAt: architectureUpdatedAt.toISOString(),
      cachedAt: Date.now(),
    });

    return result;
  }

  public static validateArchitecture(
    architectureId: string,
    userId: string,
  ): Promise<ValidationEngineResult> {
    const inFlightKey = `${architectureId}:${userId}`;

    // In-flight deduplication: return active promise if already executing for this user
    const active = inFlightValidations.get(inFlightKey);
    if (active) {
      return active;
    }

    let activePromise: Promise<ValidationEngineResult>;
    const validationPromise = (async () => {
      const architecture = await prisma.architecture.findUnique({
        where: { id: architectureId },
      });

      if (!architecture) {
        throw ApiError.notFound('Architecture not found');
      }

      if (architecture.userId !== userId) {
        throw new ApiError(403, 'You do not have access to this architecture', 'FORBIDDEN');
      }

      const startTime = Date.now();
      const nodes = (architecture.nodes as unknown as RuleExecutionContext['nodes']) || [];
      const edges = (architecture.edges as unknown as RuleExecutionContext['edges']) || [];

      return await ValidationService.runValidation(
        architectureId,
        architecture.updatedAt,
        nodes,
        edges,
        startTime,
      );
    })().finally(() => {
      if (inFlightValidations.get(inFlightKey) === activePromise) {
        inFlightValidations.delete(inFlightKey);
      }
    });

    activePromise = validationPromise;
    inFlightValidations.set(inFlightKey, validationPromise);
    return validationPromise;
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

    // Return cached result if fresh and not invalidated
    if (ValidationService.hasFreshCache(architectureId, architecture.updatedAt)) {
      const cached = validationCache.get(architectureId);
      if (cached) {
        return cached.result;
      }
    }

    return ValidationService.validateArchitecture(architectureId, userId);
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
