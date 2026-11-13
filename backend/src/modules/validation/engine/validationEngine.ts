import type {
  RuleExecutionContext,
  ValidationEngineResult,
  ValidationFinding,
  ValidationStatus,
  ValidationSummary,
} from '../types/validation.types.js';
import { validationRegistry } from './validationRegistry.js';

export class ArchitectureValidationEngine {
  public static validate(context: RuleExecutionContext): ValidationEngineResult {
    const rules = validationRegistry.getAllRules();
    const findings: ValidationFinding[] = [];

    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let infoCount = 0;
    let passedRulesCount = 0;

    for (const rule of rules) {
      try {
        const ruleFindings = rule.evaluate(context);
        if (ruleFindings.length === 0) {
          passedRulesCount++;
        } else {
          for (const finding of ruleFindings) {
            findings.push(finding);
            switch (finding.severity) {
              case 'critical':
                criticalCount++;
                break;
              case 'high':
                highCount++;
                break;
              case 'medium':
                mediumCount++;
                break;
              case 'low':
                lowCount++;
                break;
              case 'info':
                infoCount++;
                break;
            }
          }
        }
      } catch (err) {
        findings.push({
          id: `ERR-${rule.metadata.id}`,
          ruleId: rule.metadata.id,
          ruleTitle: rule.metadata.title,
          category: rule.metadata.category,
          severity: 'medium',
          status: 'unknown',
          affectedNodeIds: [],
          message: `Evaluation error during rule execution: ${err instanceof Error ? err.message : String(err)}`,
          description: 'The validation engine encountered an unhandled exception while evaluating this rule.',
        });
      }
    }

    let overallStatus: ValidationStatus = 'valid';
    if (criticalCount > 0 || highCount > 0) {
      overallStatus = 'invalid';
    } else if (mediumCount > 0 || findings.some((f) => f.status === 'unknown')) {
      overallStatus = 'unknown';
    }

    const summary: ValidationSummary = {
      totalFindings: findings.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      infoCount,
      passedRulesCount,
      totalRulesEvaluated: rules.length,
      status: overallStatus,
      evaluatedAt: new Date().toISOString(),
    };

    return {
      architectureId: context.architectureId,
      summary,
      findings,
      evaluatedAt: summary.evaluatedAt,
    };
  }
}
