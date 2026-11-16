import type { ValidationFinding, ValidationRule } from '../types/validation.types.js';

export const multiAzDatabaseRule: ValidationRule = {
  metadata: {
    id: 'REL-001',
    title: 'RDS High Availability Multi-AZ Configuration',
    category: 'reliability',
    severity: 'medium',
    description: 'Production relational databases should enable Multi-AZ deployment for synchronous standby failover.',
    remediationTemplate: 'Enable "multi_az = true" on the RDS database instance configuration.',
    documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html',
  },
  evaluate: (ctx): ValidationFinding[] => {
    const findings: ValidationFinding[] = [];
    const rdsInstances = ctx.nodes.filter((n) => n.data.resourceType === 'aws_db_instance');

    for (const rds of rdsInstances) {
      const isMultiAz = rds.data.metadata?.multi_az;
      if (isMultiAz === false) {
        findings.push({
          id: `REL-001-${rds.id}`,
          ruleId: 'REL-001',
          ruleTitle: 'RDS High Availability Multi-AZ Configuration',
          category: 'reliability',
          severity: 'medium',
          status: 'invalid',
          affectedNodeIds: [rds.id],
          message: `RDS Instance "${rds.data.label || rds.id}" is deployed in Single-AZ mode without standby failover.`,
          description: 'Single-AZ database instances are susceptible to downtime during maintenance or availability zone outages.',
          remediation: 'Enable Multi-AZ deployment for automatic failover and high availability.',
          documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html',
        });
      } else if (isMultiAz === undefined || isMultiAz === null) {
        findings.push({
          id: `REL-001-unknown-${rds.id}`,
          ruleId: 'REL-001',
          ruleTitle: 'RDS High Availability Multi-AZ Configuration',
          category: 'reliability',
          severity: 'medium',
          status: 'unknown',
          affectedNodeIds: [rds.id],
          message: `RDS Instance "${rds.data.label || rds.id}" does not specify a Multi-AZ deployment configuration.`,
          description: 'Without Multi-AZ configured, high availability standby failover across availability zones cannot be verified.',
          remediation: 'Explicitly configure "multi_az = true" in resource settings for high availability.',
          documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html',
        });
      }
    }

    return findings;
  },
};

export const automatedBackupRetentionRule: ValidationRule = {
  metadata: {
    id: 'REL-002',
    title: 'RDS Automated Backups Enabled',
    category: 'reliability',
    severity: 'high',
    description: 'RDS databases must configure automated backup retention (between 7 and 35 days) to prevent permanent data loss.',
    remediationTemplate: 'Set backup_retention_period to an integer between 7 and 35 days.',
    documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html',
  },
  evaluate: (ctx): ValidationFinding[] => {
    const findings: ValidationFinding[] = [];
    const rdsInstances = ctx.nodes.filter((n) => n.data.resourceType === 'aws_db_instance');

    for (const rds of rdsInstances) {
      const retention = rds.data.metadata?.backup_retention_period;

      // 1. Missing / null / undefined / empty string -> UNKNOWN
      if (retention === undefined || retention === null || retention === '') {
        findings.push({
          id: `REL-002-unknown-${rds.id}`,
          ruleId: 'REL-002',
          ruleTitle: 'RDS Automated Backups Enabled',
          category: 'reliability',
          severity: 'medium',
          status: 'unknown',
          affectedNodeIds: [rds.id],
          message: `RDS Instance "${rds.data.label || rds.id}" has no backup retention period specified.`,
          description: 'Automated backup retention is not configured, risking data loss in disaster recovery scenarios.',
          remediation: 'Configure a backup retention period of between 7 and 35 days in resource properties.',
          documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html',
        });
        continue;
      }

      // 2. Parse number and validate non-numeric
      const numRetention =
        typeof retention === 'number'
          ? retention
          : typeof retention === 'string' && retention.trim() !== ''
            ? Number(retention)
            : NaN;

      if (isNaN(numRetention)) {
        findings.push({
          id: `REL-002-invalid-${rds.id}`,
          ruleId: 'REL-002',
          ruleTitle: 'RDS Automated Backups Enabled',
          category: 'reliability',
          severity: 'high',
          status: 'invalid',
          affectedNodeIds: [rds.id],
          message: `RDS Instance "${rds.data.label || rds.id}" has invalid non-numeric backup retention "${retention}".`,
          description: 'Backup retention period must be an integer between 7 and 35 days representing snapshot retention in days.',
          remediation: 'Set backup_retention_period to an integer between 7 and 35 days.',
          documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html',
        });
        continue;
      }

      // 3. Fractional number check
      if (!Number.isInteger(numRetention)) {
        findings.push({
          id: `REL-002-invalid-${rds.id}`,
          ruleId: 'REL-002',
          ruleTitle: 'RDS Automated Backups Enabled',
          category: 'reliability',
          severity: 'high',
          status: 'invalid',
          affectedNodeIds: [rds.id],
          message: `RDS Instance "${rds.data.label || rds.id}" has fractional backup retention "${retention}". Retention must be a whole number of days.`,
          description: 'Backup retention period must be an integer representing snapshot retention in whole days.',
          remediation: 'Set backup_retention_period to a whole integer between 7 and 35 days.',
          documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html',
        });
        continue;
      }

      // 4. Negative number check
      if (numRetention < 0) {
        findings.push({
          id: `REL-002-invalid-${rds.id}`,
          ruleId: 'REL-002',
          ruleTitle: 'RDS Automated Backups Enabled',
          category: 'reliability',
          severity: 'high',
          status: 'invalid',
          affectedNodeIds: [rds.id],
          message: `RDS Instance "${rds.data.label || rds.id}" has negative backup retention (${numRetention} days).`,
          description: 'Backup retention period cannot be negative.',
          remediation: 'Set backup_retention_period to an integer between 7 and 35 days.',
          documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html',
        });
        continue;
      }

      // 5. Explicitly disabled (0 days)
      if (numRetention === 0) {
        findings.push({
          id: `REL-002-${rds.id}`,
          ruleId: 'REL-002',
          ruleTitle: 'RDS Automated Backups Enabled',
          category: 'reliability',
          severity: 'high',
          status: 'invalid',
          affectedNodeIds: [rds.id],
          message: `RDS Instance "${rds.data.label || rds.id}" has automated backups disabled (retention = 0).`,
          description: 'A backup retention of 0 disables automated point-in-time recovery snapshots entirely.',
          remediation: 'Configure a backup retention period of between 7 and 35 days.',
          documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html',
        });
        continue;
      }

      // 6. Exceeds AWS maximum of 35 days
      if (numRetention > 35) {
        findings.push({
          id: `REL-002-invalid-${rds.id}`,
          ruleId: 'REL-002',
          ruleTitle: 'RDS Automated Backups Enabled',
          category: 'reliability',
          severity: 'high',
          status: 'invalid',
          affectedNodeIds: [rds.id],
          message: `RDS Instance "${rds.data.label || rds.id}" specifies ${numRetention} days retention, exceeding AWS maximum limit of 35 days.`,
          description: 'Amazon RDS supports a maximum automated backup retention period of 35 days.',
          remediation: 'Reduce backup_retention_period to 35 days or fewer, or use AWS Backup for longer retention.',
          documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html',
        });
        continue;
      }

      // 7. Below production policy recommendation (1-6 days) -> status: 'unknown', severity: 'medium'
      if (numRetention >= 1 && numRetention < 7) {
        findings.push({
          id: `REL-002-policy-${rds.id}`,
          ruleId: 'REL-002',
          ruleTitle: 'RDS Automated Backups Enabled',
          category: 'reliability',
          severity: 'medium',
          status: 'unknown',
          affectedNodeIds: [rds.id],
          message: `RDS Instance "${rds.data.label || rds.id}" has backup retention period of ${numRetention} day(s), which is below the recommended 7 days for production workloads.`,
          description: 'While AWS allows retention periods from 1 to 35 days, CloudForge best practices recommend at least 7 days for production recovery.',
          remediation: 'Increase backup_retention_period to at least 7 days for production environments.',
          documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html',
        });
        continue;
      }

      // 8. 7 to 35 days: fully compliant, no finding generated.
    }

    return findings;
  },
};

export const albMultiAzSubnetsRule: ValidationRule = {
  metadata: {
    id: 'REL-003',
    title: 'Application Load Balancers Must Span Multiple AZs',
    category: 'reliability',
    severity: 'high',
    description: 'ALBs require subnets in at least two distinct Availability Zones for load balancing redundancy.',
    remediationTemplate: 'Attach the ALB to at least two subnets located in different Availability Zones.',
    documentationUrl: 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/application-load-balancers.html#subnets-for-your-load-balancer',
  },
  evaluate: (ctx): ValidationFinding[] => {
    const findings: ValidationFinding[] = [];
    const albs = ctx.nodes.filter((n) => n.data.resourceType === 'aws_lb');

    for (const alb of albs) {
      // Find connected subnets
      const connectedSubnets = ctx.nodes.filter((n) => {
        if (n.data.resourceType !== 'aws_subnet') return false;
        return ctx.edges.some(
          (e) =>
            (e.source === alb.id && e.target === n.id) ||
            (e.target === alb.id && e.source === n.id),
        );
      });

      if (connectedSubnets.length < 2) {
        findings.push({
          id: `REL-003-${alb.id}`,
          ruleId: 'REL-003',
          ruleTitle: 'Application Load Balancers Must Span Multiple AZs',
          category: 'reliability',
          severity: 'high',
          status: 'invalid',
          affectedNodeIds: [alb.id],
          message: `Load Balancer "${alb.data.label || alb.id}" is connected to ${connectedSubnets.length} subnet(s); at least 2 in distinct AZs are required.`,
          description: 'AWS Application Load Balancers require at least two subnets in separate availability zones for traffic routing resilience.',
          remediation: 'Connect this Load Balancer to a second subnet in an alternative Availability Zone.',
          documentationUrl: 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/application-load-balancers.html#subnets-for-your-load-balancer',
        });
      }
    }

    return findings;
  },
};

export const reliabilityRules: ValidationRule[] = [
  multiAzDatabaseRule,
  automatedBackupRetentionRule,
  albMultiAzSubnetsRule,
];
