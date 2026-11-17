import type {
  DependencyIssue,
  TerraformEdgeInput,
  TerraformNodeInput,
  TfExpression,
} from './terraform.types.js';

export const BOUNDARY_CONTAINER_TYPES = new Set([
  'aws_cloud',
  'aws_region',
  'aws_availability_zone',
  'aws_resource_group',
]);

export function tfExpr(value: string): TfExpression {
  return { __tfExpr: true, value };
}

export function isTfExpression(v: unknown): v is TfExpression {
  return typeof v === 'object' && v !== null && '__tfExpr' in v;
}

export function hclString(value: string): string {
  return JSON.stringify(value);
}

export function hclBlock(
  type: string,
  name: string,
  attributes: Record<string, unknown>,
  blocks?: string[],
): string {
  const attrLines = Object.entries(attributes)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => {
      if (isTfExpression(v)) return `  ${k} = ${v.value}`;
      if (typeof v === 'string') return `  ${k} = ${hclString(v)}`;
      if (typeof v === 'boolean') return `  ${k} = ${v}`;
      if (typeof v === 'number') return `  ${k} = ${v}`;
      if (Array.isArray(v)) {
        const items = v.map((item) => {
          if (isTfExpression(item)) return item.value;
          if (typeof item === 'string') return hclString(item);
          return String(item);
        });
        return `  ${k} = [${items.join(', ')}]`;
      }
      if (typeof v === 'object') {
        const obj = v as Record<string, unknown>;
        const objLines = Object.entries(obj)
          .filter(([, ov]) => ov !== undefined && ov !== null)
          .map(([ok, ov]) => {
            if (isTfExpression(ov)) return `    ${ok} = ${ov.value}`;
            if (typeof ov === 'string') return `    ${ok} = ${hclString(ov)}`;
            if (typeof ov === 'boolean') return `    ${ok} = ${ov}`;
            if (typeof ov === 'number') return `    ${ok} = ${ov}`;
            return `    ${ok} = ${ov}`;
          });
        return `  ${k} = {\n${objLines.join('\n')}\n  }`;
      }
      return `  ${k} = ${String(v)}`;
    });

  const inner = [...attrLines, ...(blocks || [])].join('\n');
  return `resource "${type}" "${name}" {\n${inner}\n}\n`;
}

export function hclVariable(
  name: string,
  type: string,
  defaultVal?: string,
  description?: string,
  sensitive?: boolean,
): string {
  const lines = [`variable "${name}" {`];
  if (description) {
    lines.push(`  description = ${hclString(description)}`);
  }
  lines.push(`  type = ${type}`);
  if (defaultVal !== undefined) {
    lines.push(`  default = ${defaultVal}`);
  }
  if (sensitive) {
    lines.push(`  sensitive = true`);
  }
  lines.push('}\n');
  return lines.join('\n');
}

export function hclOutput(
  name: string,
  value: string,
  description?: string,
  sensitive?: boolean,
): string {
  const lines = [`output "${name}" {`];
  if (description) {
    lines.push(`  description = ${hclString(description)}`);
  }
  lines.push(`  value       = ${value}`);
  if (sensitive) {
    lines.push(`  sensitive   = true`);
  }
  lines.push('}\n');
  return lines.join('\n');
}

export function safeResourceName(label?: string, resourceType?: string, id?: string): string {
  const base = (label || resourceType || 'resource')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return base || `resource_${id?.slice(-6) || 'unk'}`;
}

export function sanitizeS3BucketName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
  return cleaned || 'cloudforge-bucket';
}

export function uniqueResourceName(
  usedNames: Set<string>,
  label?: string,
  resourceType?: string,
  id?: string,
): string {
  let name = safeResourceName(label, resourceType, id);
  let counter = 1;
  const original = name;
  while (usedNames.has(name)) {
    name = `${original}_${counter}`;
    counter++;
  }
  usedNames.add(name);
  return name;
}

export function normalizeResourceType(raw: string): string {
  const trimmed = (raw || '').toLowerCase().trim();
  const normalized = trimmed
    .replace(/^aws[_-]/, '')
    .replace(/^amazon[_-]/, '')
    .replace(/[- ]/g, '_');

  if (normalized === 'cloud' || normalized === 'aws_cloud') return 'aws_cloud';
  if (normalized === 'region' || normalized === 'aws_region') return 'aws_region';
  if (normalized === 'availability_zone' || normalized === 'az') return 'aws_availability_zone';
  if (normalized === 'vpc') return 'aws_vpc';
  if (
    normalized === 'subnet' ||
    normalized === 'public_subnet' ||
    normalized === 'private_subnet' ||
    normalized === 'isolated_subnet' ||
    normalized === 'data_subnet'
  )
    return 'aws_subnet';
  if (normalized === 'ec2' || normalized === 'instance' || normalized === 'ec2_instance') return 'aws_instance';
  if (
    normalized === 'rds' ||
    normalized === 'db_instance' ||
    normalized === 'rds_instance' ||
    normalized === 'database'
  )
    return 'aws_db_instance';
  if (normalized === 's3' || normalized === 's3_bucket' || normalized === 'bucket') return 'aws_s3_bucket';
  if (normalized === 'lambda' || normalized === 'lambda_function' || normalized === 'function') return 'aws_lambda_function';
  if (normalized === 'iam' || normalized === 'iam_role' || normalized === 'role') return 'aws_iam_role';
  if (normalized === 'kms' || normalized === 'kms_key' || normalized === 'key') return 'aws_kms_key';
  if (normalized === 'sqs' || normalized === 'sqs_queue' || normalized === 'queue') return 'aws_sqs_queue';
  if (normalized === 'sns' || normalized === 'sns_topic' || normalized === 'topic') return 'aws_sns_topic';
  if (normalized === 'dynamodb' || normalized === 'dynamodb_table' || normalized === 'dynamo_table' || normalized === 'table') return 'aws_dynamodb_table';
  if (
    normalized === 'alb' ||
    normalized === 'elb' ||
    normalized === 'load_balancer' ||
    normalized === 'application_load_balancer'
  )
    return 'aws_lb';
  if (normalized === 'nlb' || normalized === 'network_load_balancer') return 'aws_nlb';
  if (normalized === 'nat' || normalized === 'nat_gateway') return 'aws_nat_gateway';
  if (normalized === 'igw' || normalized === 'internet_gateway') return 'aws_internet_gateway';
  if (normalized === 'route_table') return 'aws_route_table';
  if (normalized === 'security_group') return 'aws_security_group';
  if (normalized === 'cloudfront' || normalized === 'cloudfront_distribution' || normalized === 'cdn') return 'aws_cloudfront_distribution';
  if (
    normalized === 'api_gateway' ||
    normalized === 'apigateway' ||
    normalized === 'api_gateway_rest_api' ||
    normalized === 'rest_api' ||
    normalized === 'api'
  )
    return 'aws_api_gateway_rest_api';
  if (normalized === 'api_gateway_websocket' || normalized === 'websocket_api') return 'aws_apigatewayv2_api';
  if (normalized === 'ecs_cluster' || normalized === 'cluster') return 'aws_ecs_cluster';
  if (normalized === 'ecs_service' || normalized === 'service') return 'aws_ecs_service';
  if (normalized === 'ecs_task' || normalized === 'task') return 'aws_ecs_task';
  if (normalized === 'elasticache' || normalized === 'elasticache_cluster' || normalized === 'redis' || normalized === 'memcached')
    return 'aws_elasticache_cluster';
  if (normalized === 'cloudwatch' || normalized === 'cloudwatch_metric_alarm' || normalized === 'alarm') return 'aws_cloudwatch_metric_alarm';
  if (normalized === 'route53' || normalized === 'route53_zone' || normalized === 'dns') return 'aws_route53_zone';
  if (normalized === 'secrets_manager' || normalized === 'secretsmanager_secret' || normalized === 'secretsmanager') return 'aws_secretsmanager_secret';
  if (normalized === 'waf' || normalized === 'wafv2_web_acl' || normalized === 'web_acl') return 'aws_wafv2_web_acl';
  if (normalized === 'bedrock' || normalized === 'bedrock_agent') return 'aws_bedrock_agent';
  if (normalized === 'mediaconvert' || normalized === 'media_convert') return 'aws_media_convert';
  if (normalized === 'acm' || normalized === 'acm_certificate' || normalized === 'certificate') return 'aws_acm_certificate';

  return trimmed;
}

export function isValidDirection(direction?: string): boolean {
  return (
    direction === 'source-to-target' ||
    direction === 'target-to-source' ||
    direction === 'bidirectional' ||
    direction === undefined
  );
}

export function resolveVpcId(
  nodes: Map<string, TerraformNodeInput>,
  edges: TerraformEdgeInput[],
  nodeId: string,
): string | null {
  const node = nodes.get(nodeId);
  if (!node) return null;

  if (node.resourceType === 'aws_vpc') return nodeId;

  const visited = new Set<string>();

  function dfs(currentId: string): string | null {
    if (visited.has(currentId)) return null;
    visited.add(currentId);

    for (const edge of edges) {
      if (edge.relationshipType !== 'contains') continue;
      if (!isValidDirection(edge.direction)) continue;

      if (
        edge.direction === 'source-to-target' ||
        edge.direction === 'bidirectional' ||
        edge.direction === undefined
      ) {
        if (edge.target === currentId) {
          const source = nodes.get(edge.source);
          if (source?.resourceType === 'aws_vpc') return edge.source;
          const vpc = dfs(edge.source);
          if (vpc) return vpc;
        }
      }
      if (
        edge.direction === 'target-to-source' ||
        edge.direction === 'bidirectional'
      ) {
        if (edge.source === currentId) {
          const target = nodes.get(edge.target);
          if (target?.resourceType === 'aws_vpc') return edge.target;
          const vpc = dfs(edge.target);
          if (vpc) return vpc;
        }
      }
    }
    return null;
  }

  return dfs(nodeId);
}

export function resolveSubnetId(
  nodes: Map<string, TerraformNodeInput>,
  edges: TerraformEdgeInput[],
  nodeId: string,
): string | null {
  const node = nodes.get(nodeId);
  if (!node) return null;

  if (node.resourceType === 'aws_subnet') return nodeId;

  const visited = new Set<string>();

  function dfs(currentId: string): string | null {
    if (visited.has(currentId)) return null;
    visited.add(currentId);

    for (const edge of edges) {
      if (edge.relationshipType !== 'contains') continue;
      if (!isValidDirection(edge.direction)) continue;

      if (
        edge.direction === 'source-to-target' ||
        edge.direction === 'bidirectional' ||
        edge.direction === undefined
      ) {
        if (edge.target === currentId) {
          const source = nodes.get(edge.source);
          if (source?.resourceType === 'aws_subnet') return edge.source;
          const subnet = dfs(edge.source);
          if (subnet) return subnet;
        }
      }
      if (
        edge.direction === 'target-to-source' ||
        edge.direction === 'bidirectional'
      ) {
        if (edge.source === currentId) {
          const target = nodes.get(edge.target);
          if (target?.resourceType === 'aws_subnet') return edge.target;
          const subnet = dfs(edge.target);
          if (subnet) return subnet;
        }
      }
    }
    return null;
  }

  return dfs(nodeId);
}

export function hasCircularContains(
  nodes: Map<string, TerraformNodeInput>,
  edges: TerraformEdgeInput[],
): boolean {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const id of nodes.keys()) color.set(id, WHITE);

  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.relationshipType !== 'contains') continue;
    const list = adj.get(edge.source) ?? [];
    list.push(edge.target);
    adj.set(edge.source, list);
  }

  function dfs(u: string): boolean {
    color.set(u, GRAY);
    const neighbors = adj.get(u) ?? [];
    for (const v of neighbors) {
      const c = color.get(v);
      if (c === GRAY) return true;
      if (c === WHITE && dfs(v)) return true;
    }
    color.set(u, BLACK);
    return false;
  }

  for (const id of nodes.keys()) {
    if (color.get(id) === WHITE && dfs(id)) return true;
  }
  return false;
}

export function collectAmbiguousRelationshipIssues(
  nodes: Map<string, TerraformNodeInput>,
  edges: TerraformEdgeInput[],
): DependencyIssue[] {
  const issues: DependencyIssue[] = [];
  const incomingContains = new Map<string, string[]>();

  for (const edge of edges) {
    if (edge.relationshipType !== 'contains') continue;
    const list = incomingContains.get(edge.target) ?? [];
    list.push(edge.source);
    incomingContains.set(edge.target, list);
  }

  const singleParentRules: Record<string, string[]> = {
    aws_subnet: ['aws_vpc'],
    aws_instance: ['aws_subnet'],
    aws_db_instance: ['aws_subnet'],
    aws_nat_gateway: ['aws_subnet'],
    aws_security_group: ['aws_vpc'],
    aws_internet_gateway: ['aws_vpc'],
  };

  for (const [targetId, sourceIds] of incomingContains) {
    const target = nodes.get(targetId);
    if (!target) continue;

    const rule = singleParentRules[target.resourceType];
    if (!rule) continue;

    const validParents = sourceIds.filter((sid) => {
      const n = nodes.get(sid);
      return n ? rule.includes(n.resourceType) : false;
    });

    if (validParents.length > 1) {
      issues.push({
        nodeId: targetId,
        resourceType: target.resourceType,
        missing: `Ambiguous parent: ${targetId} is contained by multiple ${rule.join(' or ')} resources (${validParents.join(', ')})`,
        severity: 'error',
      });
    }
  }

  return issues;
}

export function collectDependencyIssues(
  nodes: Map<string, TerraformNodeInput>,
  edges: TerraformEdgeInput[],
): DependencyIssue[] {
  const issues: DependencyIssue[] = [];

  if (hasCircularContains(nodes, edges)) {
    issues.push({
      nodeId: 'architecture',
      resourceType: 'architecture',
      missing: 'Circular "contains" relationship detected in architecture graph',
      severity: 'error',
    });
  }

  issues.push(...collectAmbiguousRelationshipIssues(nodes, edges));

  for (const [nodeId, node] of nodes) {
    if (node.resourceType === 'aws_subnet') {
      const vpc = resolveVpcId(nodes, edges, nodeId);
      if (!vpc) {
        issues.push({
          nodeId,
          resourceType: 'aws_subnet',
          missing: 'VPC (subnet must be contained in a VPC)',
          severity: 'error',
        });
      }
    }

    if (
      node.resourceType === 'aws_instance' ||
      node.resourceType === 'aws_db_instance' ||
      node.resourceType === 'aws_nat_gateway'
    ) {
      const subnet = resolveSubnetId(nodes, edges, nodeId);
      if (!subnet) {
        issues.push({
          nodeId,
          resourceType: node.resourceType,
          missing: 'Subnet (resource must be placed in a subnet)',
          severity: 'error',
        });
      }
    }

    if (node.resourceType === 'aws_internet_gateway') {
      const vpc = resolveVpcId(nodes, edges, nodeId);
      if (!vpc) {
        issues.push({
          nodeId,
          resourceType: 'aws_internet_gateway',
          missing: 'VPC (internet gateway must attach to a VPC)',
          severity: 'error',
        });
      }
    }

    if (node.resourceType === 'aws_security_group') {
      const vpc = resolveVpcId(nodes, edges, nodeId);
      if (!vpc) {
        issues.push({
          nodeId,
          resourceType: 'aws_security_group',
          missing: 'VPC (security group must belong to a VPC)',
          severity: 'error',
        });
      }
    }

    if (node.resourceType === 'aws_nat_gateway') {
      const subnet = resolveSubnetId(nodes, edges, nodeId);
      if (!subnet) {
        issues.push({
          nodeId,
          resourceType: 'aws_nat_gateway',
          missing: 'Subnet (NAT gateway must be in a public subnet)',
          severity: 'error',
        });
      }
    }

    if (node.resourceType === 'aws_db_instance') {
      const vpc = resolveVpcId(nodes, edges, nodeId);
      if (!vpc) {
        issues.push({
          nodeId,
          resourceType: 'aws_db_instance',
          missing: 'VPC (database must be in a VPC)',
          severity: 'warning',
        });
      }
    }
  }

  return issues;
}
