import { networkRules } from '../rules/networkRules.js';
import { reliabilityRules } from '../rules/reliabilityRules.js';
import { securityRules } from '../rules/securityRules.js';
import { structuralRules } from '../rules/structuralRules.js';
import type { ValidationRule, ValidationRuleMetadata } from '../types/validation.types.js';

class ValidationRuleRegistry {
  private readonly rules: Map<string, ValidationRule> = new Map();

  constructor() {
    this.registerAll([
      ...structuralRules,
      ...networkRules,
      ...securityRules,
      ...reliabilityRules,
    ]);
  }

  public register(rule: ValidationRule): void {
    this.rules.set(rule.metadata.id, rule);
  }

  public registerAll(rules: ValidationRule[]): void {
    for (const rule of rules) {
      this.register(rule);
    }
  }

  public getRule(id: string): ValidationRule | undefined {
    return this.rules.get(id);
  }

  public getAllRules(): ValidationRule[] {
    return Array.from(this.rules.values());
  }

  public getAllMetadata(): ValidationRuleMetadata[] {
    return Array.from(this.rules.values()).map((r) => r.metadata);
  }
}

export const validationRegistry = new ValidationRuleRegistry();
