import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * Terraform HCL Generator for CloudForge
 *
 * Converts architecture canvas nodes/edges into HashiCorp Terraform HCL.
 * Supports core AWS resources: VPC, Subnet, EC2, RDS, S3, Security Group,
 * Internet Gateway, NAT Gateway, ALB, Lambda, DynamoDB, IAM Role, KMS Key.
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
      if (typeof v === 'string') return `  ${k} = ${hclString(v)}`;
      if (typeof v === 'boolean') return `  ${k} = ${v}`;
      if (typeof v === 'number') return `  ${k} = ${v}`;
      if (typeof v === 'object') {
        const obj = v as Record<string, unknown>;
        const objLines = Object.entries(obj)
          .filter(([, ov]) => ov !== undefined && ov !== null)
          .map(([ok, ov]) => {
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

function getVpcId(nodes: TerraformNodeInput[], nodeId: string): string | null {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const vpcId = node.metadata?.vpc_id as string | undefined;
  return vpcId ?? null;
}

function getSubnetId(nodes: TerraformNodeInput[], nodeId: string): string | null {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const subnetId = node.metadata?.subnet_id as string | undefined;
  return subnetId ?? null;
}

export class TerraformGenerator {
  /**
   * Generate HCL files for an architecture.
   * Returns an array of { filename, content } ready to write as .tf files.
   */
  public static generate(
    architectureName: string,
    region: string,
    nodes: TerraformNodeInput[],
    _edges: TerraformEdgeInput[],
  ): TerraformFile[] {
    const files: TerraformFile[] = [];

    // Provider block
    files.push({
      filename: 'provider.tf',
      content: `terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}
`,
    });

    // Variables
    files.push({
      filename: 'variables.tf',
      content: hclVariable('aws_region', 'string', `"${region}"`),
    });

    // Group nodes by type
    const byType = new Map<string, TerraformNodeInput[]>();
    for (const node of nodes) {
      const list = byType.get(node.resourceType) ?? [];
      list.push(node);
      byType.set(node.resourceType, list);
    }

    // 1. VPCs
    const vpcs = byType.get('aws_vpc') ?? [];
    for (const vpc of vpcs) {
      const name = safeResourceName(vpc.label, 'aws_vpc', vpc.id);
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

    // 2. Subnets
    const subnets = byType.get('aws_subnet') ?? [];
    for (const subnet of subnets) {
      const name = safeResourceName(subnet.label, 'aws_subnet', subnet.id);
      const cidr = (subnet.metadata?.cidr_block as string) || '10.0.1.0/24';
      const vpcId = getVpcId(nodes, subnet.id);

      const blocks: string[] = [];
      if (vpcId) {
        blocks.push(`  vpc_id = aws_vpc.${safeResourceName(undefined, 'aws_vpc', vpcId)}`);
      } else {
        blocks.push(`  vpc_id = var.vpc_id  // TODO: set to your VPC ID`);
      }

      const az = (subnet.metadata?.availability_zone as string) || `${region}a`;
      const mapPublicIp = subnet.metadata?.map_public_ip_on_launch === true;

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

    // 3. Internet Gateways
    const igws = byType.get('aws_internet_gateway') ?? [];
    for (const igw of igws) {
      const name = safeResourceName(igw.label, 'aws_internet_gateway', igw.id);
      const vpcId = getVpcId(nodes, igw.id);

      const blocks: string[] = [];
      if (vpcId) {
        blocks.push(`  vpc_id = aws_vpc.${safeResourceName(undefined, 'aws_vpc', vpcId)}`);
      } else {
        blocks.push(`  vpc_id = var.vpc_id  // TODO: set to your VPC ID`);
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

    // 4. NAT Gateways
    const natGateways = byType.get('aws_nat_gateway') ?? [];
    for (const nat of natGateways) {
      const name = safeResourceName(nat.label, 'aws_nat_gateway', nat.id);
      const subnetId = getSubnetId(nodes, nat.id);

      const blocks: string[] = [];
      if (subnetId) {
        blocks.push(`  subnet_id = aws_subnet.${safeResourceName(undefined, 'aws_subnet', subnetId)}`);
      } else {
        blocks.push(`  subnet_id = var.subnet_id  // TODO: set to your Subnet ID`);
      }

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
    for (const sg of securityGroups) {
      const name = safeResourceName(sg.label, 'aws_security_group', sg.id);
      const vpcId = getVpcId(nodes, sg.id);

      const blocks: string[] = [];
      if (vpcId) {
        blocks.push(`  vpc_id = aws_vpc.${safeResourceName(undefined, 'aws_vpc', vpcId)}`);
      } else {
        blocks.push(`  vpc_id = var.vpc_id  // TODO: set to your VPC ID`);
      }

      const ingressRules = sg.metadata?.ingress_rules as Array<{ cidr_blocks?: string[]; from_port?: number; to_port?: number; protocol?: string; description?: string }> | undefined;
      if (ingressRules && ingressRules.length > 0) {
        for (const rule of ingressRules) {
          blocks.push(`  ingress {`);
          blocks.push(`    description = ${hclString(rule.description || 'Ingress rule')}`);
          blocks.push(`    from_port   = ${rule.from_port ?? 0}`);
          blocks.push(`    to_port     = ${rule.to_port ?? 0}`);
          blocks.push(`    protocol    = ${hclString(rule.protocol ?? 'tcp')}`);
          blocks.push(`    cidr_blocks = ${JSON.stringify(rule.cidr_blocks ?? ['0.0.0.0/0'])}`);
          blocks.push(`  }`);
        }
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
      const name = safeResourceName(inst.label, 'aws_instance', inst.id);
      const instanceType = (inst.metadata?.instance_type as string) || 't3.micro';
      const ami = (inst.metadata?.ami as string) || 'ami-0c55b159cbfafe1f0';
      const subnetId = getSubnetId(nodes, inst.id);
      const rootSize = Number(inst.metadata?.root_volume_size || 20);

      const blocks: string[] = [];
      if (subnetId) {
        blocks.push(`  subnet_id = aws_subnet.${safeResourceName(undefined, 'aws_subnet', subnetId)}`);
      } else {
        blocks.push(`  subnet_id = var.subnet_id  // TODO: set to your Subnet ID`);
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
            ami: ami,
            instance_type: instanceType,
            tags: { Name: inst.label || name },
          },
          blocks,
        ),
      });
    }

    // 7. RDS Instances
    const rdsInstances = byType.get('aws_db_instance') ?? [];
    for (const rds of rdsInstances) {
      const name = safeResourceName(rds.label, 'aws_db_instance', rds.id);
      const engine = (rds.metadata?.engine as string) || 'postgres';
      const instanceClass = (rds.metadata?.instance_class as string) || 'db.t3.micro';
      const allocatedStorage = Number(rds.metadata?.allocated_storage || 20);
      const multiAz = rds.metadata?.multi_az === true;
      const storageEncrypted = rds.metadata?.storage_encrypted !== false;

      files.push({
        filename: `rds/${name}.tf`,
        content: hclBlock(
          'aws_db_instance',
          name,
          {
            engine: engine,
            instance_class: instanceClass,
            allocated_storage: allocatedStorage,
            multi_az: multiAz,
            storage_encrypted: storageEncrypted,
            tags: { Name: rds.label || name },
          },
        ),
      });
    }

    // 8. S3 Buckets
    const s3Buckets = byType.get('aws_s3_bucket') ?? [];
    for (const bucket of s3Buckets) {
      const name = safeResourceName(bucket.label, 'aws_s3_bucket', bucket.id);
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
          content: hclBlock(
            'aws_s3_bucket_versioning',
            `${name}-versioning`,
            {
              bucket: `aws_s3_bucket.${name}.id`,
              versioning_configuration: { status: 'Enabled' },
            },
            [`  versioning_configuration { status = "Enabled" }`],
          ),
        });
      }
    }

    // 9. DynamoDB Tables
    const dynamoTables = byType.get('aws_dynamodb_table') ?? [];
    for (const table of dynamoTables) {
      const name = safeResourceName(table.label, 'aws_dynamodb_table', table.id);
      const tableName = (table.metadata?.name as string) || name;
      const hashKey = (table.metadata?.hash_key as string) || 'id';
      const billingMode = (table.metadata?.billing_mode as string) || 'PAY_PER_REQUEST';

      files.push({
        filename: `dynamodb/${name}.tf`,
        content: hclBlock(
          'aws_dynamodb_table',
          name,
          {
            name: tableName,
            billing_mode: billingMode,
            hash_key: hashKey,
            tags: { Name: table.label || name },
          },
          [
            `  attribute {`,
            `    name = ${hclString(hashKey)}`,
            `    type = "S"`,
            `  }`,
          ],
        ),
      });
    }

    // 10. Lambda Functions
    const lambdas = byType.get('aws_lambda_function') ?? [];
    for (const lambda of lambdas) {
      const name = safeResourceName(lambda.label, 'aws_lambda_function', lambda.id);
      const functionName = (lambda.metadata?.function_name as string) || name;
      const runtime = (lambda.metadata?.runtime as string) || 'nodejs20.x';
      const handler = (lambda.metadata?.handler as string) || 'index.handler';
      const memorySize = Number(lambda.metadata?.memory_size || 128);
      const timeout = Number(lambda.metadata?.timeout || 30);

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
            `  role = aws_iam_role.lambda_exec_role.arn  // TODO: create IAM role`,
            `  filename = "lambda.zip"  // TODO: point to your deployment package`,
            `  source_code_hash = filebase64sha256("lambda.zip")`,
          ],
        ),
      });
    }

    // 11. Application Load Balancer
    const lbs = byType.get('aws_lb') ?? [];
    for (const lb of lbs) {
      const name = safeResourceName(lb.label, 'aws_lb', lb.id);
      const lbType = (lb.metadata?.load_balancer_type as string) || 'application';
      const internal = lb.metadata?.internal === true;

      files.push({
        filename: `alb/${name}.tf`,
        content: hclBlock(
          'aws_lb',
          name,
          {
            name: name,
            load_balancer_type: lbType,
            internal: internal,
            enable_deletion_protection: false,
            tags: { Name: lb.label || name },
          },
          [
            `  subnets = var.subnet_ids  // TODO: set to your subnet IDs`,
            `  security_groups = [aws_security_group.default.id]  // TODO: reference your security group`,
          ],
        ),
      });
    }

    // 12. IAM Roles
    const iamRoles = byType.get('aws_iam_role') ?? [];
    for (const role of iamRoles) {
      const name = safeResourceName(role.label, 'aws_iam_role', role.id);
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
              : hclString(JSON.stringify({
                  Version: '2012-10-17',
                  Statement: [{
                    Effect: 'Allow',
                    Principal: { Service: 'ec2.amazonaws.com' },
                    Action: 'sts:AssumeRole',
                  }],
                })),
            tags: { Name: role.label || name },
          },
        ),
      });
    }

    // 13. KMS Keys
    const kmsKeys = byType.get('aws_kms_key') ?? [];
    for (const key of kmsKeys) {
      const name = safeResourceName(key.label, 'aws_kms_key', key.id);
      const description = (key.metadata?.description as string) || `KMS key for ${key.label || name}`;

      files.push({
        filename: `kms/${name}.tf`,
        content: hclBlock(
          'aws_kms_key',
          name,
          {
            description: description,
            deletion_window_in_days: 30,
            tags: { Name: key.label || name },
          },
        ),
      });
    }

    // Outputs
    const outputLines: string[] = [];
    outputLines.push(hclOutput('architecture_name', hclString(architectureName)));
    outputLines.push(hclOutput('aws_region', 'var.aws_region'));

    if (vpcs.length > 0) {
      outputLines.push(hclOutput('vpc_ids', `[\n${vpcs.map((v) => `    aws_vpc.${safeResourceName(v.label, 'aws_vpc', v.id)}.id`).join(',\n')}\n  ]`));
    }

    files.push({
      filename: 'outputs.tf',
      content: outputLines.join('\n'),
    });

    return files;
  }

  /**
   * Generate HCL and save to database as a text blob (optional persistence).
   */
  public static async generateAndSave(
    architectureId: string,
    userId: string,
  ): Promise<{ files: TerraformFile[]; hcl: string }> {
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
      metadata: n.data?.metadata || {},
    }));

    const edges: TerraformEdgeInput[] = rawEdges.map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      relationshipType: e.data?.relationshipType || 'connects-to',
      direction: e.data?.direction || 'source-to-target',
      metadata: e.data?.metadata || {},
    }));

    const files = this.generate(arch.name, arch.region, nodes, edges);
    const hcl = files.map((f) => `// === ${f.filename} ===\n${f.content}`).join('\n');

    return { files, hcl };
  }
}
