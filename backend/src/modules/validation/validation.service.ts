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
const validationCache = new Map<string, ValidationEngineResult>();

export class ValidationService {
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
    validationCache.set(architectureId, result);

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
    if (cached) {
      return cached;
    }

    // If not cached yet, run validation on current state
    return this.validateArchitecture(architectureId, userId);
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
