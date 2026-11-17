import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * Terraform HCL Generator for CloudForge
 *
 * Converts architecture canvas nodes/edges into HashiCorp Terraform HCL.
 * Uses actual architecture edges for dependency resolution instead of
 * relying solely on stored metadata IDs.
 *
 * Supported AWS resources: VPC, Subnet, EC2, RDS, S3, Security Group,
 * Internet Gateway, NAT Gateway (+ Elastic IP), ALB, Lambda, DynamoDB,
 * IAM Role, KMS Key.
 */

interface TerraformNodeInput {
  id: string;
  resourceType: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

interface TerraformEdgeInput {
  id: string;
  source: string;
  target: string;
  relationshipType?: string;
  direction?: string;
  metadata?: Record<string, unknown>;
}

interface TerraformFile {
  filename: string;
  content: string;
}

interface DependencyIssue {
  nodeId: string;
  resourceType: string;
  missing: string;
  severity: 'error' | 'warning';
}

/**
 * A Terraform expression (reference) that should NOT be quoted as a string.
 * Example: aws_vpc.main.id, var.ec2_ami, aws_security_group.web.id
 */
interface TfExpression {
  __tfExpr: true;
  value: string;
}

function tfExpr(value: string): TfExpression {
  return { __tfExpr: true, value };
}

function isTfExpression(v: unknown): v is TfExpression {
  return typeof v === 'object' && v !== null && '__tfExpr' in v;
}

function hclString(value: string): string {
  return JSON.stringify(value);
}

function hclBlock(
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
      if (typeof v === 'object') {
        const obj = v as Record<string, unknown>;
        const objLines = Object.entries(obj)
          .filter(([, ov]) => ov !== undefined && ov !== null)
          .map(([ok, ov]) => {
            if (isTfExpression(ov)) return `    ${ok} = ${ov.value}`;
            if (typeof ov === 'string') return `    ${ok} = ${hclString(ov)}`;
            if (typeof ov === 'boolean') return `    ${ok} = ${ov}`;
            return `    ${ok} = ${ov}`;
          });
        return `  ${k} = {\n${objLines.join('\n')}\n  }`;
      }
      return `  ${k} = ${String(v)}`;
    });

  const inner = [...attrLines, ...(blocks || [])].join('\n');
  return `resource "${type}" "${name}" {\n${inner}\n}\n`;
}

function hclVariable(name: string, type: string, defaultVal?: string): string {
  const def = defaultVal !== undefined ? `\n  default = ${defaultVal}` : '';
  return `variable "${name}" {\n  type = ${type}${def}\n}\n`;
}

function hclOutput(name: string, value: string): string {
  return `output "${name}" {\n  value = ${value}\n}\n`;
}

function safeResourceName(label?: string, resourceType?: string, id?: string): string {
  const base = (label || resourceType || 'resource')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return base || `resource_${id?.slice(-6) || 'unk'}`;
}

export const BOUNDARY_CONTAINER_TYPES = new Set([
  'aws_cloud',
  'aws_region',
  'aws_availability_zone',
  'aws_resource_group',
]);

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
    normalized === 'isolated_subnet'
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

function uniqueResourceName(
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

/**
 * Validate that an edge direction value is one of the allowed Terraform-style directions.
 */
function isValidDirection(direction?: string): boolean {
  return (
    direction === 'source-to-target' ||
    direction === 'target-to-source' ||
    direction === 'bidirectional' ||
    direction === undefined
  );
}

/**
 * Resolve which VPC a resource belongs to by walking edges.
 * Follows 'contains' relationships from VPC -> Subnet -> Resource.
 * Validates edge direction: for 'contains', source-to-target means source contains target.
 * Prevents infinite recursion on cyclic graphs.
 */
function resolveVpcId(
  nodes: Map<string, TerraformNodeInput>,
  edges: TerraformEdgeInput[],
  nodeId: string,
): string | null {
  const node = nodes.get(nodeId);
  if (!node) return null;

  // Direct VPC node
  if (node.resourceType === 'aws_vpc') return nodeId;

  const visited = new Set<string>();

  function dfs(currentId: string): string | null {
    if (visited.has(currentId)) return null; // cycle guard
    visited.add(currentId);

    for (const edge of edges) {
      if (edge.relationshipType !== 'contains') continue;
      if (!isValidDirection(edge.direction)) continue;

      // source-to-target (or bidirectional): source contains target
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
      // target-to-source (or bidirectional): target contains source
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

/**
 * Resolve which Subnet a resource is placed in via edges.
 * Validates edge direction the same way as resolveVpcId.
 */
function resolveSubnetId(
  nodes: Map<string, TerraformNodeInput>,
  edges: TerraformEdgeInput[],
  nodeId: string,
): string | null {
  const node = nodes.get(nodeId);
  if (!node) return null;

  // Direct subnet node
  if (node.resourceType === 'aws_subnet') return nodeId;

  const visited = new Set<string>();

  function dfs(currentId: string): string | null {
    if (visited.has(currentId)) return null; // cycle guard
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

/**
 * Detect circular "contains" relationships using DFS.
 * Returns true if any cycle exists among nodes connected by 'contains' edges.
 */
function hasCircularContains(
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
      if (c === GRAY) return true; // back edge → cycle
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

/**
 * Detect ambiguous parent relationships: a node with more than one incoming
 * 'contains' edge from valid parent types.
 * Only flags ambiguity where a resource should have exactly one parent of that type.
 * ALBs can legitimately be in multiple subnets, so they're excluded.
 */
function collectAmbiguousRelationshipIssues(
  nodes: Map<string, TerraformNodeInput>,
  edges: TerraformEdgeInput[],
): DependencyIssue[] {
  const issues: DependencyIssue[] = [];
  const incomingContains = new Map<string, string[]>(); // targetId -> [sourceIds]

  for (const edge of edges) {
    if (edge.relationshipType !== 'contains') continue;
    const list = incomingContains.get(edge.target) ?? [];
    list.push(edge.source);
    incomingContains.set(edge.target, list);
  }

  // Resources that must have exactly one parent of the given type
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
    if (!rule) continue; // e.g. aws_lb can have multiple subnet parents — normal

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

/**
 * Collect dependency issues for missing/unresolved relationships.
 */
function collectDependencyIssues(
  nodes: Map<string, TerraformNodeInput>,
  edges: TerraformEdgeInput[],
): DependencyIssue[] {
  const issues: DependencyIssue[] = [];

  // Circular dependency check
  if (hasCircularContains(nodes, edges)) {
    issues.push({
      nodeId: 'architecture',
      resourceType: 'architecture',
      missing: 'Circular "contains" relationship detected in architecture graph',
      severity: 'error',
    });
  }

  // Ambiguous parent check
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

export class TerraformGenerator {
  /**
   * Generate HCL files for an architecture.
   * Uses edges for dependency resolution. Reports missing dependencies
   * as HCL comments instead of silently generating invalid references.
   */
  public static generate(
    architectureName: string,
    region: string,
    nodes: TerraformNodeInput[],
    edges: TerraformEdgeInput[],
  ): { files: TerraformFile[]; issues: DependencyIssue[] } {
    const files: TerraformFile[] = [];
    const usedNames = new Set<string>();

    // Normalize all nodes and partition out visual boundary containers.
    // Boundary containers (aws_cloud, aws_region, aws_availability_zone, aws_resource_group,
    // or metadata.isBoundary===true) are visual layout scopes, not deployable Terraform resources.
    const normalizedNodes: TerraformNodeInput[] = [];
    const allNormalizedNodeMap = new Map<string, TerraformNodeInput>();

    for (const node of nodes) {
      const normType = normalizeResourceType(node.resourceType);
      const isBoundary =
        BOUNDARY_CONTAINER_TYPES.has(normType) ||
        (node.metadata?.isBoundary === true && !['aws_vpc', 'aws_subnet'].includes(normType));

      const normalizedNode = {
        ...node,
        resourceType: normType,
      };
      allNormalizedNodeMap.set(node.id, normalizedNode);

      if (!isBoundary) {
        normalizedNodes.push(normalizedNode);
      }
    }

    const issues = collectDependencyIssues(
      allNormalizedNodeMap,
      edges,
    ).filter((issue) => {
      // Keep architecture-level issues (e.g. cycle / circular contains)
      if (issue.nodeId === 'architecture' || issue.resourceType === 'architecture') {
        return true;
      }
      // Don't report dependency issues on filtered-out boundary containers
      const targetNode = allNormalizedNodeMap.get(issue.nodeId);
      if (!targetNode) return false;
      const isBoundary =
        BOUNDARY_CONTAINER_TYPES.has(targetNode.resourceType) ||
        (targetNode.metadata?.isBoundary === true && !['aws_vpc', 'aws_subnet'].includes(targetNode.resourceType));
      return !isBoundary;
    });

    const nodeMap = allNormalizedNodeMap;

    // Provider block
    files.push({
      filename: 'versions.tf',
      content: `terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
`,
    });

    files.push({
      filename: 'provider.tf',
      content: `provider "aws" {
  region = var.aws_region
}
`,
    });

    // Variables
    let variablesContent = hclVariable('aws_region', 'string', `"${region}"`);

    // Group deployable nodes by type
    const byType = new Map<string, TerraformNodeInput[]>();
    for (const node of normalizedNodes) {
      const list = byType.get(node.resourceType) ?? [];
      list.push(node);
      byType.set(node.resourceType, list);
    }

    // Pre-compute IAM role names so Lambda can reference them correctly.
    // IAM role blocks are generated later (section 12), but names must be
    // stable and unique across the whole architecture.
    const iamRolesPre = byType.get('aws_iam_role') ?? [];
    const iamRefs = new Map<string, string>(); // nodeId -> terraform resource name
    for (const role of iamRolesPre) {
      const name = uniqueResourceName(
        usedNames,
        role.label,
        'aws_iam_role',
        role.id,
      );
      iamRefs.set(role.id, name);
    }

    // 1. VPCs
    const vpcs = byType.get('aws_vpc') ?? [];
    const vpcRefs = new Map<string, string>(); // nodeId -> terraform resource name
    for (const vpc of vpcs) {
      const name = uniqueResourceName(
        usedNames,
        vpc.label,
        'aws_vpc',
        vpc.id,
      );
      vpcRefs.set(vpc.id, name);
      const cidr = (vpc.metadata?.cidr_block as string) || '10.0.0.0/16';
      const dnsHostnames = vpc.metadata?.enable_dns_hostnames === true;
      const dnsSupport = vpc.metadata?.enable_dns_support !== false;

      files.push({
        filename: `vpc/${name}.tf`,
        content: hclBlock(
          'aws_vpc',
          name,
          {
            cidr_block: cidr,
            enable_dns_hostnames: dnsHostnames,
            enable_dns_support: dnsSupport,
            tags: { Name: vpc.label || name },
          },
        ),
      });
    }

    if (vpcs.length > 0) {
      variablesContent += hclVariable(
        'vpc_id',
        'string',
        '""',
      );
    }

    // 2. Subnets
    const subnets = byType.get('aws_subnet') ?? [];
    const subnetRefs = new Map<string, string>(); // nodeId -> terraform resource name
    for (const subnet of subnets) {
      const name = uniqueResourceName(
        usedNames,
        subnet.label,
        'aws_subnet',
        subnet.id,
      );
      subnetRefs.set(subnet.id, name);
      const cidr = (subnet.metadata?.cidr_block as string) || '10.0.1.0/24';
      const vpcNodeId = resolveVpcId(nodeMap, edges, subnet.id);
      const az = (subnet.metadata?.availability_zone as string) || `${region}a`;
      const mapPublicIp = subnet.metadata?.map_public_ip_on_launch === true;

      const blocks: string[] = [];
      if (vpcNodeId && vpcRefs.has(vpcNodeId)) {
        blocks.push(`  vpc_id = aws_vpc.${vpcRefs.get(vpcNodeId)}.id`);
      } else if (vpcs.length > 0) {
        blocks.push(`  vpc_id = var.vpc_id  // TODO: associate with correct VPC`);
      }

      files.push({
        filename: `subnet/${name}.tf`,
        content: hclBlock(
          'aws_subnet',
          name,
          {
            cidr_block: cidr,
            availability_zone: az,
            map_public_ip_on_launch: mapPublicIp,
            tags: { Name: subnet.label || name },
          },
          blocks,
        ),
      });
    }

    if (subnets.length > 0) {
      variablesContent += hclVariable('subnet_ids', 'list(string)', '[]');
    }

    // 3. Internet Gateways
    const igws = byType.get('aws_internet_gateway') ?? [];
    const igwRefs = new Map<string, string>();
    for (const igw of igws) {
      const name = uniqueResourceName(
        usedNames,
        igw.label,
        'aws_internet_gateway',
        igw.id,
      );
      igwRefs.set(igw.id, name);
      const vpcNodeId = resolveVpcId(nodeMap, edges, igw.id);

      const blocks: string[] = [];
      if (vpcNodeId && vpcRefs.has(vpcNodeId)) {
        blocks.push(`  vpc_id = aws_vpc.${vpcRefs.get(vpcNodeId)}.id`);
      } else if (vpcs.length > 0) {
        blocks.push(`  vpc_id = var.vpc_id  // TODO: attach to correct VPC`);
      }

      files.push({
        filename: `internet-gateway/${name}.tf`,
        content: hclBlock(
          'aws_internet_gateway',
          name,
          { tags: { Name: igw.label || name } },
          blocks,
        ),
      });
    }

    // 4. NAT Gateways + Elastic IPs
    const natGateways = byType.get('aws_nat_gateway') ?? [];
    for (const nat of natGateways) {
      const name = uniqueResourceName(
        usedNames,
        nat.label,
        'aws_nat_gateway',
        nat.id,
      );
      const subnetNodeId = resolveSubnetId(nodeMap, edges, nat.id);

      // Generate Elastic IP for public NAT Gateway
      const eipName = uniqueResourceName(
        usedNames,
        `${nat.label || nat.id}-eip`,
        'aws_eip',
        `${nat.id}-eip`,
      );
      files.push({
        filename: `nat-gateway/${name}-eip.tf`,
        content: hclBlock(
          'aws_eip',
          eipName,
          {
            domain: 'vpc',
            tags: { Name: `${nat.label || nat.id} Elastic IP` },
          },
        ),
      });

      const blocks: string[] = [];
      if (subnetNodeId && subnetRefs.has(subnetNodeId)) {
        blocks.push(`  subnet_id = aws_subnet.${subnetRefs.get(subnetNodeId)}.id`);
      } else if (subnets.length > 0) {
        blocks.push(`  subnet_id = var.subnet_ids[0]  // TODO: specify public subnet`);
      }
      blocks.push(`  allocation_id = aws_eip.${eipName}.id`);

      files.push({
        filename: `nat-gateway/${name}.tf`,
        content: hclBlock(
          'aws_nat_gateway',
          name,
          {
            connectivity_type: 'public',
            tags: { Name: nat.label || name },
          },
          blocks,
        ),
      });
    }

    // 5. Security Groups
    const securityGroups = byType.get('aws_security_group') ?? [];
    const sgRefs = new Map<string, string>();
    for (const sg of securityGroups) {
      const name = uniqueResourceName(
        usedNames,
        sg.label,
        'aws_security_group',
        sg.id,
      );
      sgRefs.set(sg.id, name);
      const vpcNodeId = resolveVpcId(nodeMap, edges, sg.id);

      const blocks: string[] = [];
      if (vpcNodeId && vpcRefs.has(vpcNodeId)) {
        blocks.push(`  vpc_id = aws_vpc.${vpcRefs.get(vpcNodeId)}.id`);
      } else if (vpcs.length > 0) {
        blocks.push(`  vpc_id = var.vpc_id  // TODO: associate with correct VPC`);
      }

      const ingressRules =
        sg.metadata?.ingress_rules as
          | Array<{
              cidr_blocks?: string[];
              from_port?: number;
              to_port?: number;
              protocol?: string;
              description?: string;
            }>
          | undefined;

      if (ingressRules && ingressRules.length > 0) {
        for (const rule of ingressRules) {
          blocks.push(`  ingress {`);
          blocks.push(
            `    description = ${hclString(rule.description || 'Ingress rule')}`,
          );
          blocks.push(`    from_port   = ${rule.from_port ?? 0}`);
          blocks.push(`    to_port     = ${rule.to_port ?? 0}`);
          blocks.push(`    protocol    = ${hclString(rule.protocol ?? 'tcp')}`);
          blocks.push(
            `    cidr_blocks = ${JSON.stringify(
              rule.cidr_blocks ?? ['0.0.0.0/0'],
            )}`,
          );
          blocks.push(`  }`);
        }
      } else {
        // No ingress rules defined — explicitly note it (no unrestricted default)
        blocks.push(`  # No ingress rules defined. Add ingress rules as needed.`);
      }

      const egressRules =
        sg.metadata?.egress_rules as
          | Array<{
              cidr_blocks?: string[];
              from_port?: number;
              to_port?: number;
              protocol?: string;
              description?: string;
            }>
          | undefined;

      if (egressRules && egressRules.length > 0) {
        for (const rule of egressRules) {
          blocks.push(`  egress {`);
          blocks.push(
            `    description = ${hclString(rule.description || 'Egress rule')}`,
          );
          blocks.push(`    from_port   = ${rule.from_port ?? 0}`);
          blocks.push(`    to_port     = ${rule.to_port ?? 0}`);
          blocks.push(`    protocol    = ${hclString(rule.protocol ?? 'tcp')}`);
          blocks.push(
            `    cidr_blocks = ${JSON.stringify(
              rule.cidr_blocks ?? ['0.0.0.0/0'],
            )}`,
          );
          blocks.push(`  }`);
        }
      } else {
        blocks.push(`  egress {`);
        blocks.push(`    description = "All outbound traffic"`);
        blocks.push(`    from_port   = 0`);
        blocks.push(`    to_port     = 0`);
        blocks.push(`    protocol    = "-1"`);
        blocks.push(`    cidr_blocks = ["0.0.0.0/0"]`);
        blocks.push(`  }`);
      }

      files.push({
        filename: `security-group/${name}.tf`,
        content: hclBlock(
          'aws_security_group',
          name,
          {
            name: sg.label || name,
            description: `Security group for ${sg.label || name}`,
          },
          blocks,
        ),
      });
    }

    // 6. EC2 Instances
    const instances = byType.get('aws_instance') ?? [];
    for (const inst of instances) {
      const name = uniqueResourceName(
        usedNames,
        inst.label,
        'aws_instance',
        inst.id,
      );
      const instanceType = (inst.metadata?.instance_type as string) || 't3.micro';
      const subnetNodeId = resolveSubnetId(nodeMap, edges, inst.id);
      const rootSize = Number(inst.metadata?.root_volume_size || 20);

      // AMI: do NOT hardcode. Use variable placeholder with clear warning.
      const ami = (inst.metadata?.ami as string) || tfExpr('var.ec2_ami');
      if (!inst.metadata?.ami) {
        issues.push({
          nodeId: inst.id,
          resourceType: 'aws_instance',
          missing: 'AMI ID (not configured — using var.ec2_ami placeholder)',
          severity: 'warning',
        });
      }

      const blocks: string[] = [];
      if (subnetNodeId && subnetRefs.has(subnetNodeId)) {
        blocks.push(`  subnet_id = aws_subnet.${subnetRefs.get(subnetNodeId)}.id`);
      } else if (subnets.length > 0) {
        blocks.push(`  subnet_id = var.subnet_ids[0]  // TODO: specify subnet`);
      }

      // Attach security groups from edges (security group applied to instance)
      const instanceSgs: string[] = [];
      for (const edge of edges) {
        if (edge.target === inst.id && edge.relationshipType === 'accesses') {
          const sgNode = nodeMap.get(edge.source);
          if (sgNode?.resourceType === 'aws_security_group' && sgRefs.has(edge.source)) {
            instanceSgs.push(`aws_security_group.${sgRefs.get(edge.source)}.id`);
          }
        }
      }
      if (instanceSgs.length > 0) {
        blocks.push(`  vpc_security_group_ids = [${instanceSgs.join(', ')}]`);
      }

      blocks.push(`  root_block_device {`);
      blocks.push(`    volume_size = ${rootSize}`);
      blocks.push(`    volume_type = "gp3"`);
      blocks.push(`    encrypted   = true`);
      blocks.push(`  }`);

      files.push({
        filename: `ec2/${name}.tf`,
        content: hclBlock(
          'aws_instance',
          name,
          {
            ami,
            instance_type: instanceType,
            tags: { Name: inst.label || name },
          },
          blocks,
        ),
      });
    }

    if (instances.length > 0) {
      variablesContent += hclVariable('ec2_ami', 'string');
    }

    // 7. RDS Instances
    const rdsInstances = byType.get('aws_db_instance') ?? [];
    for (const rds of rdsInstances) {
      const name = uniqueResourceName(
        usedNames,
        rds.label,
        'aws_db_instance',
        rds.id,
      );
      const engine = (rds.metadata?.engine as string) || 'postgres';
      const instanceClass = (rds.metadata?.instance_class as string) || 'db.t3.micro';
      const allocatedStorage = Number(rds.metadata?.allocated_storage || 20);
      const multiAz = rds.metadata?.multi_az === true;
      const storageEncrypted = rds.metadata?.storage_encrypted !== false;

      const blocks: string[] = [];
      // RDS credentials: never hardcode, use variable
      blocks.push(`  username = var.db_username`);
      blocks.push(`  password = var.db_password`);

      const subnetNodeId = resolveSubnetId(nodeMap, edges, rds.id);
      if (subnetNodeId && subnetRefs.has(subnetNodeId)) {
        blocks.push(`  subnet_id = aws_subnet.${subnetRefs.get(subnetNodeId)}.id`);
      } else if (subnets.length > 0) {
        blocks.push(`  subnet_id = var.subnet_ids[0]  // TODO: specify subnet`);
      }

      files.push({
        filename: `rds/${name}.tf`,
        content: hclBlock(
          'aws_db_instance',
          name,
          {
            engine,
            instance_class: instanceClass,
            allocated_storage: allocatedStorage,
            multi_az: multiAz,
            storage_encrypted: storageEncrypted,
            tags: { Name: rds.label || name },
          },
          blocks,
        ),
      });
    }

    if (rdsInstances.length > 0) {
      variablesContent += hclVariable('db_username', 'string');
      variablesContent += hclVariable('db_password', 'string');
    }

    // 8. S3 Buckets
    const s3Buckets = byType.get('aws_s3_bucket') ?? [];
    for (const bucket of s3Buckets) {
      const name = uniqueResourceName(
        usedNames,
        bucket.label,
        'aws_s3_bucket',
        bucket.id,
      );
      const bucketName = (bucket.metadata?.bucket as string) || name;
      const versioning = bucket.metadata?.versioning_enabled === true;

      files.push({
        filename: `s3/${name}.tf`,
        content: hclBlock(
          'aws_s3_bucket',
          name,
          {
            bucket: bucketName,
            tags: { Name: bucket.label || name },
          },
        ),
      });

      if (versioning) {
        files.push({
          filename: `s3/${name}-versioning.tf`,
          content: `resource "aws_s3_bucket_versioning" "${name}-versioning" {\n  bucket = aws_s3_bucket.${name}.id\n  versioning_configuration {\n    status = "Enabled"\n  }\n}\n`,
        });
      }
    }

    // 9. DynamoDB Tables
    const dynamoTables = byType.get('aws_dynamodb_table') ?? [];
    for (const table of dynamoTables) {
      const name = uniqueResourceName(
        usedNames,
        table.label,
        'aws_dynamodb_table',
        table.id,
      );
      const tableName = (table.metadata?.name as string) || name;
      const hashKey = (table.metadata?.hash_key as string) || 'id';
      const rangeKey = (table.metadata?.range_key as string) || null;
      const billingMode = (table.metadata?.billing_mode as string) || 'PAY_PER_REQUEST';

      const attrBlocks: string[] = [
        `  attribute {`,
        `    name = ${hclString(hashKey)}`,
        `    type = "S"`,
        `  }`,
      ];
      if (rangeKey) {
        attrBlocks.push(`  attribute {`);
        attrBlocks.push(`    name = ${hclString(rangeKey)}`);
        attrBlocks.push(`    type = "S"`);
        attrBlocks.push(`  }`);
      }

      const keySchemaBlocks: string[] = [
        `  key_schema {`,
        `    attribute_name = ${hclString(hashKey)}`,
        `    key_type       = "HASH"`,
        `  }`,
      ];
      if (rangeKey) {
        keySchemaBlocks.push(`  key_schema {`);
        keySchemaBlocks.push(`    attribute_name = ${hclString(rangeKey)}`);
        keySchemaBlocks.push(`    key_type       = "RANGE"`);
        keySchemaBlocks.push(`  }`);
      }

      files.push({
        filename: `dynamodb/${name}.tf`,
        content: hclBlock(
          'aws_dynamodb_table',
          name,
          {
            name: tableName,
            billing_mode: billingMode,
            tags: { Name: table.label || name },
          },
          [...attrBlocks, ...keySchemaBlocks],
        ),
      });
    }

    // 10. Lambda Functions
    const lambdas = byType.get('aws_lambda_function') ?? [];
    for (const lambda of lambdas) {
      const name = uniqueResourceName(
        usedNames,
        lambda.label,
        'aws_lambda_function',
        lambda.id,
      );
      const functionName = (lambda.metadata?.function_name as string) || name;
      const runtime = (lambda.metadata?.runtime as string) || 'nodejs20.x';
      const handler = (lambda.metadata?.handler as string) || 'index.handler';
      const memorySize = Number(lambda.metadata?.memory_size || 128);
      const timeout = Number(lambda.metadata?.timeout || 30);

      // Find IAM role for Lambda via edges.
      // Only follow 'accesses' edges where Lambda is the source (it accesses the role).
      let lambdaRoleRef: string | TfExpression = tfExpr('var.lambda_role_arn');
      for (const edge of edges) {
        if (
          edge.source === lambda.id &&
          edge.target !== lambda.id &&
          edge.relationshipType === 'accesses' &&
          (edge.direction === 'source-to-target' || edge.direction === 'bidirectional')
        ) {
          const roleNode = nodeMap.get(edge.target);
          if (roleNode?.resourceType === 'aws_iam_role' && iamRefs.has(edge.target)) {
            lambdaRoleRef = tfExpr(`aws_iam_role.${iamRefs.get(edge.target)}.arn`);
            break;
          }
        }
      }

      if (typeof lambdaRoleRef === 'string' && iamRolesPre.length > 0) {
        issues.push({
          nodeId: lambda.id,
          resourceType: 'aws_lambda_function',
          missing: 'IAM role (Lambda must access an IAM role via an "accesses" edge)',
          severity: 'warning',
        });
      }

      files.push({
        filename: `lambda/${name}.tf`,
        content: hclBlock(
          'aws_lambda_function',
          name,
          {
            function_name: functionName,
            runtime: runtime,
            handler: handler,
            memory_size: memorySize,
            timeout: timeout,
            tags: { Name: lambda.label || name },
          },
          [
            `  role = ${typeof lambdaRoleRef === 'string' ? lambdaRoleRef : lambdaRoleRef.value}`,
            `  filename = "lambda.zip"  // TODO: point to your deployment package`,
            `  source_code_hash = filebase64sha256("lambda.zip")`,
          ],
        ),
      });
    }

    if (lambdas.length > 0) {
      variablesContent += hclVariable('lambda_role_arn', 'string');
    }

    // 11. Application Load Balancer
    const lbs = byType.get('aws_lb') ?? [];
    for (const lb of lbs) {
      const name = uniqueResourceName(
        usedNames,
        lb.label,
        'aws_lb',
        lb.id,
      );
      const lbType = (lb.metadata?.load_balancer_type as string) || 'application';
      const internal = lb.metadata?.internal === true;

      const blocks: string[] = [];
      const lbSubnets: string[] = [];
      for (const edge of edges) {
        // Subnet contains LB: edge.source = subnet, edge.target = lb, relationshipType = 'contains'
        if (
          edge.target === lb.id &&
          edge.relationshipType === 'contains' &&
          (edge.direction === 'source-to-target' || edge.direction === 'bidirectional')
        ) {
          const subnetNode = nodeMap.get(edge.source);
          if (subnetNode?.resourceType === 'aws_subnet' && subnetRefs.has(edge.source)) {
            lbSubnets.push(`aws_subnet.${subnetRefs.get(edge.source)}.id`);
          }
        }
      }
      if (lbSubnets.length > 0) {
        blocks.push(`  subnets = [${lbSubnets.join(', ')}]`);
      } else if (subnets.length > 0) {
        blocks.push(`  subnets = var.subnet_ids  // TODO: specify ALB subnets`);
      }

      const lbSgs: string[] = [];
      for (const edge of edges) {
        // LB uses SG: edge.source = lb, edge.target = sg, relationshipType = 'accesses'
        // OR SG is attached to LB: edge.source = sg, edge.target = lb, relationshipType = 'accesses'
        // Accept either direction but validate the endpoint types.
        if (edge.relationshipType !== 'accesses') continue;
        const isLbSource = edge.source === lb.id;
        const isLbTarget = edge.target === lb.id;
        if (!isLbSource && !isLbTarget) continue;
        if (edge.direction !== 'source-to-target' && edge.direction !== 'bidirectional') continue;

        const otherNodeId = isLbSource ? edge.target : edge.source;
        const sgNode = nodeMap.get(otherNodeId);
        if (sgNode?.resourceType === 'aws_security_group' && sgRefs.has(otherNodeId)) {
          lbSgs.push(`aws_security_group.${sgRefs.get(otherNodeId)}.id`);
        }
      }
      if (lbSgs.length > 0) {
        blocks.push(`  security_groups = [${lbSgs.join(', ')}]`);
      } else if (securityGroups.length > 0) {
        blocks.push(`  security_groups = var.security_group_ids  // TODO: specify ALB security groups`);
      }

      if (lbSubnets.length === 0 && subnets.length === 0) {
        issues.push({
          nodeId: lb.id,
          resourceType: 'aws_lb',
          missing: 'Subnets (ALB must be placed in at least one subnet)',
          severity: 'error',
        });
      }

      files.push({
        filename: `alb/${name}.tf`,
        content: hclBlock(
          'aws_lb',
          name,
          {
            name,
            load_balancer_type: lbType,
            internal: internal,
            enable_deletion_protection: false,
            tags: { Name: lb.label || name },
          },
          blocks,
        ),
      });
    }

    if (lbs.length > 0) {
      variablesContent += hclVariable('security_group_ids', 'list(string)', '[]');
    }

    // 12. IAM Roles
    const iamRoles = byType.get('aws_iam_role') ?? [];
    for (const role of iamRoles) {
      const name = uniqueResourceName(
        usedNames,
        role.label,
        'aws_iam_role',
        role.id,
      );
      const roleName = (role.metadata?.name as string) || name;
      const assumeRolePolicy = role.metadata?.assume_role_policy as string | undefined;

      files.push({
        filename: `iam/${name}.tf`,
        content: hclBlock(
          'aws_iam_role',
          name,
          {
            name: roleName,
            assume_role_policy: assumeRolePolicy
              ? hclString(assumeRolePolicy)
              : hclString(
                  JSON.stringify({
                    Version: '2012-10-17',
                    Statement: [
                      {
                        Effect: 'Allow',
                        Principal: { Service: 'ec2.amazonaws.com' },
                        Action: 'sts:AssumeRole',
                      },
                    ],
                  }),
                ),
            tags: { Name: role.label || name },
          },
        ),
      });
    }

    // 13. KMS Keys
    const kmsKeys = byType.get('aws_kms_key') ?? [];
    for (const key of kmsKeys) {
      const name = uniqueResourceName(
        usedNames,
        key.label,
        'aws_kms_key',
        key.id,
      );
      const description = (key.metadata?.description as string) || `KMS key for ${key.label || name}`;

      files.push({
        filename: `kms/${name}.tf`,
        content: hclBlock(
          'aws_kms_key',
          name,
          {
            description,
            deletion_window_in_days: 30,
            tags: { Name: key.label || name },
          },
        ),
      });
    }

    // 14. SQS Queues
    const sqsQueues = byType.get('aws_sqs_queue') ?? [];
    for (const queue of sqsQueues) {
      const name = uniqueResourceName(usedNames, queue.label, 'aws_sqs_queue', queue.id);
      files.push({
        filename: `sqs/${name}.tf`,
        content: hclBlock('aws_sqs_queue', name, {
          name: (queue.metadata?.name as string) || name,
          tags: { Name: queue.label || name },
        }),
      });
    }

    // 15. SNS Topics
    const snsTopics = byType.get('aws_sns_topic') ?? [];
    for (const topic of snsTopics) {
      const name = uniqueResourceName(usedNames, topic.label, 'aws_sns_topic', topic.id);
      files.push({
        filename: `sns/${name}.tf`,
        content: hclBlock('aws_sns_topic', name, {
          name: (topic.metadata?.name as string) || name,
          tags: { Name: topic.label || name },
        }),
      });
    }

    // 16. CloudFront Distributions
    const cfDistributions = byType.get('aws_cloudfront_distribution') ?? [];
    for (const dist of cfDistributions) {
      const name = uniqueResourceName(usedNames, dist.label, 'aws_cloudfront_distribution', dist.id);
      files.push({
        filename: `cloudfront/${name}.tf`,
        content: hclBlock('aws_cloudfront_distribution', name, {
          enabled: true,
          comment: dist.label || name,
          tags: { Name: dist.label || name },
        }),
      });
    }

    // 17. API Gateway REST APIs
    const apiGateways = byType.get('aws_api_gateway_rest_api') ?? [];
    for (const api of apiGateways) {
      const name = uniqueResourceName(usedNames, api.label, 'aws_api_gateway_rest_api', api.id);
      files.push({
        filename: `api_gateway/${name}.tf`,
        content: hclBlock('aws_api_gateway_rest_api', name, {
          name: (api.metadata?.name as string) || name,
          description: api.label || name,
          tags: { Name: api.label || name },
        }),
      });
    }

    // 18. ECS Clusters & Services
    const ecsClusters = byType.get('aws_ecs_cluster') ?? [];
    for (const cluster of ecsClusters) {
      const name = uniqueResourceName(usedNames, cluster.label, 'aws_ecs_cluster', cluster.id);
      files.push({
        filename: `ecs/${name}_cluster.tf`,
        content: hclBlock('aws_ecs_cluster', name, {
          name: (cluster.metadata?.name as string) || name,
          tags: { Name: cluster.label || name },
        }),
      });
    }

    const ecsServices = byType.get('aws_ecs_service') ?? [];
    for (const service of ecsServices) {
      const name = uniqueResourceName(usedNames, service.label, 'aws_ecs_service', service.id);
      files.push({
        filename: `ecs/${name}.tf`,
        content: hclBlock('aws_ecs_service', name, {
          name: (service.metadata?.name as string) || name,
          desired_count: (service.metadata?.desired_count as number) || 1,
          tags: { Name: service.label || name },
        }),
      });
    }

    // 19. ElastiCache Clusters
    const elasticaches = byType.get('aws_elasticache_cluster') ?? [];
    for (const ec of elasticaches) {
      const name = uniqueResourceName(usedNames, ec.label, 'aws_elasticache_cluster', ec.id);
      files.push({
        filename: `elasticache/${name}.tf`,
        content: hclBlock('aws_elasticache_cluster', name, {
          cluster_id: name,
          engine: (ec.metadata?.engine as string) || 'redis',
          node_type: (ec.metadata?.node_type as string) || 'cache.t3.micro',
          num_cache_nodes: 1,
          tags: { Name: ec.label || name },
        }),
      });
    }

    // 20. CloudWatch Metric Alarms
    const cwAlarms = byType.get('aws_cloudwatch_metric_alarm') ?? [];
    for (const alarm of cwAlarms) {
      const name = uniqueResourceName(usedNames, alarm.label, 'aws_cloudwatch_metric_alarm', alarm.id);
      files.push({
        filename: `cloudwatch/${name}.tf`,
        content: hclBlock('aws_cloudwatch_metric_alarm', name, {
          alarm_name: (alarm.metadata?.alarm_name as string) || name,
          comparison_operator: 'GreaterThanOrEqualToThreshold',
          evaluation_periods: 2,
          metric_name: 'CPUUtilization',
          namespace: 'AWS/EC2',
          period: 120,
          statistic: 'Average',
          threshold: 80,
          tags: { Name: alarm.label || name },
        }),
      });
    }

    // 21. Route53 Zones
    const r53Zones = byType.get('aws_route53_zone') ?? [];
    for (const zone of r53Zones) {
      const name = uniqueResourceName(usedNames, zone.label, 'aws_route53_zone', zone.id);
      files.push({
        filename: `route53/${name}.tf`,
        content: hclBlock('aws_route53_zone', name, {
          name: (zone.metadata?.name as string) || `${name}.example.com`,
          tags: { Name: zone.label || name },
        }),
      });
    }

    // 22. Secrets Manager Secrets
    const smSecrets = byType.get('aws_secretsmanager_secret') ?? [];
    for (const sec of smSecrets) {
      const name = uniqueResourceName(usedNames, sec.label, 'aws_secretsmanager_secret', sec.id);
      files.push({
        filename: `secrets/${name}.tf`,
        content: hclBlock('aws_secretsmanager_secret', name, {
          name: (sec.metadata?.name as string) || name,
          tags: { Name: sec.label || name },
        }),
      });
    }

    // 23. WAFv2 Web ACL
    const wafAcls = byType.get('aws_wafv2_web_acl') ?? [];
    for (const waf of wafAcls) {
      const name = uniqueResourceName(usedNames, waf.label, 'aws_wafv2_web_acl', waf.id);
      files.push({
        filename: `waf/${name}.tf`,
        content: hclBlock('aws_wafv2_web_acl', name, {
          name: (waf.metadata?.name as string) || name,
          scope: 'REGIONAL',
          tags: { Name: waf.label || name },
        }),
      });
    }

    // 24. Bedrock Agents & MediaConvert
    const bedrockAgents = byType.get('aws_bedrock_agent') ?? [];
    for (const agent of bedrockAgents) {
      const name = uniqueResourceName(usedNames, agent.label, 'aws_bedrock_agent', agent.id);
      files.push({
        filename: `bedrock/${name}.tf`,
        content: hclBlock('aws_bedrockagent_agent', name, {
          agent_name: (agent.metadata?.name as string) || name,
          tags: { Name: agent.label || name },
        }),
      });
    }

    const mediaConverts = byType.get('aws_media_convert') ?? [];
    for (const mc of mediaConverts) {
      const name = uniqueResourceName(usedNames, mc.label, 'aws_media_convert', mc.id);
      files.push({
        filename: `mediaconvert/${name}.tf`,
        content: hclBlock('aws_media_convert_queue', name, {
          name: (mc.metadata?.name as string) || name,
          tags: { Name: mc.label || name },
        }),
      });
    }

    // 25. ACM Certificates
    const acmCerts = byType.get('aws_acm_certificate') ?? [];
    for (const cert of acmCerts) {
      const name = uniqueResourceName(usedNames, cert.label, 'aws_acm_certificate', cert.id);
      files.push({
        filename: `acm/${name}.tf`,
        content: hclBlock('aws_acm_certificate', name, {
          domain_name: (cert.metadata?.domain_name as string) || 'example.com',
          validation_method: 'DNS',
          tags: { Name: cert.label || name },
        }),
      });
    }

    // Report unsupported resource types explicitly
    const supportedTypes = new Set([
      'aws_vpc',
      'aws_subnet',
      'aws_internet_gateway',
      'aws_nat_gateway',
      'aws_security_group',
      'aws_instance',
      'aws_db_instance',
      'aws_s3_bucket',
      'aws_dynamodb_table',
      'aws_lambda_function',
      'aws_lb',
      'aws_nlb',
      'aws_iam_role',
      'aws_kms_key',
      'aws_route_table',
      'aws_sqs_queue',
      'aws_sns_topic',
      'aws_cloudfront_distribution',
      'aws_api_gateway_rest_api',
      'aws_ecs_cluster',
      'aws_ecs_service',
      'aws_ecs_task',
      'aws_elasticache_cluster',
      'aws_cloudwatch_metric_alarm',
      'aws_route53_zone',
      'aws_secretsmanager_secret',
      'aws_wafv2_web_acl',
      'aws_bedrock_agent',
      'aws_media_convert',
      'aws_acm_certificate',
    ]);
    for (const node of normalizedNodes) {
      if (!supportedTypes.has(node.resourceType)) {
        issues.push({
          nodeId: node.id,
          resourceType: node.resourceType,
          missing: `Unsupported resource type "${node.resourceType}" — no Terraform generator implemented`,
          severity: 'error',
        });
      }
    }

    // Variables file
    files.push({
      filename: 'variables.tf',
      content: variablesContent,
    });

    // Outputs
    const outputLines: string[] = [];
    outputLines.push(hclOutput('architecture_name', hclString(architectureName)));
    outputLines.push(hclOutput('aws_region', 'var.aws_region'));

    if (vpcs.length > 0) {
      outputLines.push(
        hclOutput(
          'vpc_ids',
          `[\n${vpcs
            .map((v) => `    aws_vpc.${vpcRefs.get(v.id)}.id`)
            .join(',\n')}\n  ]`,
        ),
      );
    }

    if (subnets.length > 0) {
      outputLines.push(
        hclOutput(
          'subnet_ids',
          `[\n${subnets
            .map((s) => `    aws_subnet.${subnetRefs.get(s.id)}.id`)
            .join(',\n')}\n  ]`,
        ),
      );
    }

    files.push({
      filename: 'outputs.tf',
      content: outputLines.join('\n'),
    });

    // README
    files.push({
      filename: 'README.md',
      content: `# CloudForge Terraform Export

Generated from architecture: "${architectureName}"
Region: ${region}

## Files

- \`versions.tf\` — Terraform version and AWS provider requirements
- \`provider.tf\` — AWS provider configuration
- \`variables.tf\` — Input variables (region, AMI, DB credentials, etc.)
- \`outputs.tf\` — Output values (VPC IDs, subnet IDs, etc.)
- \`vpc/\`, \`subnet/\`, \`security-group/\`, \`ec2/\`, \`rds/\`, \`s3/\`, \`dynamodb/\`, \`lambda/\`, \`alb/\`, \`iam/\`, \`kms/\`, \`nat-gateway/\`, \`internet-gateway/\` — Resource modules

## Usage

\`\`\`bash
terraform init
terraform validate
terraform plan
terraform apply
\`\`\`

## Notes

- Review \`variables.tf\` and set required values (AMI ID, DB credentials, etc.) before applying.
- Resources with missing dependencies are flagged in the generation issues.
- Do not commit plaintext secrets to version control.
`,
    });

    return { files, issues };
  }

  /**
   * Generate HCL and return files + issues.
   */
  public static async generateAndSave(
    architectureId: string,
    userId: string,
  ): Promise<{ files: TerraformFile[]; hcl: string; issues: DependencyIssue[] }> {
    const arch = await prisma.architecture.findUnique({
      where: { id: architectureId },
    });

    if (!arch) throw ApiError.notFound('Architecture not found');
    if (!arch.userId || arch.userId !== userId) {
      throw new ApiError(403, 'You do not have access to this architecture', 'FORBIDDEN');
    }

    const rawNodes = Array.isArray(arch.nodes) ? arch.nodes : [];
    const rawEdges = Array.isArray(arch.edges) ? arch.edges : [];

    const nodes: TerraformNodeInput[] = rawNodes.map((n: any) => ({
      id: n.id,
      resourceType: n.data?.resourceType || n.type || 'unknown',
      label: n.data?.label || n.data?.resourceName || n.id,
      metadata: {
        ...(n.data?.metadata || {}),
        isBoundary: n.data?.metadata?.isBoundary ?? n.metadata?.isBoundary ?? (n.type === 'boundary' || n.data?.isBoundary),
      },
    }));

    const edges: TerraformEdgeInput[] = rawEdges.map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      relationshipType: e.data?.relationshipType || 'connects-to',
      direction: e.data?.direction || 'source-to-target',
      metadata: e.data?.metadata || {},
    }));

    const { files, issues } = this.generate(arch.name, arch.region, nodes, edges);
    const hcl = files.map((f) => `// === ${f.filename} ===\n${f.content}`).join('\n');

    return { files, hcl, issues };
  }
}
