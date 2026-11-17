import type {
  DependencyIssue,
  TerraformEdgeInput,
  TerraformFile,
  TerraformNodeInput,
} from './terraform.types.js';
import {
  BOUNDARY_CONTAINER_TYPES,
  collectDependencyIssues,
  hclBlock,
  hclOutput,
  hclString,
  hclVariable,
  normalizeResourceType,
  safeResourceName,
  sanitizeS3BucketName,
  tfExpr,
  uniqueResourceName,
} from './terraform-common.js';

interface ModuleContext {
  architectureName: string;
  region: string;
  sanitizedProjectName: string;
  usedNames: Set<string>;
  nodeMap: Map<string, TerraformNodeInput>;
  edges: TerraformEdgeInput[];
  issues: DependencyIssue[];
}

export class TerraformModularGenerator {
  public static generate(
    architectureName: string,
    region: string,
    nodes: TerraformNodeInput[],
    edges: TerraformEdgeInput[],
  ): { files: TerraformFile[]; issues: DependencyIssue[] } {
    const files: TerraformFile[] = [];
    const usedNames = new Set<string>();
    const sanitizedProjectName = safeResourceName(architectureName) || 'cloudforge_project';

    // 1. Normalize nodes and filter visual boundary containers
    const deployableNodes: TerraformNodeInput[] = [];
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
        deployableNodes.push(normalizedNode);
      }
    }

    // 2. Collect dependency issues
    const issues = collectDependencyIssues(
      allNormalizedNodeMap,
      edges,
    ).filter((issue) => {
      if (issue.nodeId === 'architecture' || issue.resourceType === 'architecture') {
        return true;
      }
      const targetNode = allNormalizedNodeMap.get(issue.nodeId);
      if (!targetNode) return false;
      const isBoundary =
        BOUNDARY_CONTAINER_TYPES.has(targetNode.resourceType) ||
        (targetNode.metadata?.isBoundary === true && !['aws_vpc', 'aws_subnet'].includes(targetNode.resourceType));
      return !isBoundary;
    });

    const ctx: ModuleContext = {
      architectureName,
      region,
      sanitizedProjectName,
      usedNames,
      nodeMap: allNormalizedNodeMap,
      edges,
      issues,
    };

    // 3. Categorize deployable resources into module groups
    const moduleBuckets = this.categorizeResources(deployableNodes);

    // 4. Generate root configuration files
    files.push(this.generateVersionsFile());
    files.push(this.generateProviderFile());
    files.push(this.generateGitignoreFile());
    files.push(this.generateRootVariablesFile(ctx, moduleBuckets));
    files.push(this.generateTfvarsExampleFile(ctx, moduleBuckets));
    files.push(this.generateDevEnvTfvarsFile(ctx, moduleBuckets));
    files.push(this.generateDevEnvReadmeFile(ctx));

    // 5. Generate child modules (only if they contain resources)
    const activeModuleNames = new Set<string>();

    if (moduleBuckets.networking.length > 0) {
      activeModuleNames.add('networking');
      files.push(...this.generateNetworkingModule(ctx, moduleBuckets.networking));
    }

    if (moduleBuckets.compute.length > 0) {
      activeModuleNames.add('compute');
      files.push(...this.generateComputeModule(ctx, moduleBuckets.compute));
    }

    if (moduleBuckets.database.length > 0) {
      activeModuleNames.add('database');
      files.push(...this.generateDatabaseModule(ctx, moduleBuckets.database));
    }

    if (moduleBuckets.storage.length > 0) {
      activeModuleNames.add('storage');
      files.push(...this.generateStorageModule(ctx, moduleBuckets.storage));
    }

    if (moduleBuckets.aiAgent.length > 0) {
      activeModuleNames.add('ai-agent');
      files.push(...this.generateAiAgentModule(ctx, moduleBuckets.aiAgent));
    }

    if (moduleBuckets.chat.length > 0) {
      activeModuleNames.add('chat');
      files.push(...this.generateChatModule(ctx, moduleBuckets.chat));
    }

    if (moduleBuckets.videoProcessing.length > 0) {
      activeModuleNames.add('video-processing');
      files.push(...this.generateVideoProcessingModule(ctx, moduleBuckets.videoProcessing));
    }

    if (moduleBuckets.cdn.length > 0) {
      activeModuleNames.add('cdn');
      files.push(...this.generateCdnModule(ctx, moduleBuckets.cdn));
    }

    if (moduleBuckets.security.length > 0) {
      activeModuleNames.add('security');
      files.push(...this.generateSecurityModule(ctx, moduleBuckets.security));
    }

    if (moduleBuckets.monitoring.length > 0) {
      activeModuleNames.add('monitoring');
      files.push(...this.generateMonitoringModule(ctx, moduleBuckets.monitoring));
    }

    // 6. Generate root orchestration (main.tf) & outputs (outputs.tf)
    files.push(this.generateRootMainFile(ctx, activeModuleNames));
    files.push(this.generateRootOutputsFile(ctx, activeModuleNames));
    files.push(this.generateReadmeFile(ctx, activeModuleNames));

    return { files, issues: ctx.issues };
  }

  /**
   * Categorize nodes into modular groups
   */
  private static categorizeResources(nodes: TerraformNodeInput[]) {
    const buckets = {
      networking: [] as TerraformNodeInput[],
      compute: [] as TerraformNodeInput[],
      database: [] as TerraformNodeInput[],
      storage: [] as TerraformNodeInput[],
      aiAgent: [] as TerraformNodeInput[],
      chat: [] as TerraformNodeInput[],
      videoProcessing: [] as TerraformNodeInput[],
      cdn: [] as TerraformNodeInput[],
      security: [] as TerraformNodeInput[],
      monitoring: [] as TerraformNodeInput[],
    };

    for (const node of nodes) {
      const type = node.resourceType;
      const labelLower = (node.label || '').toLowerCase();
      const meta = node.metadata || {};

      if (type === 'aws_bedrock_agent') {
        buckets.aiAgent.push(node);
      } else if (type === 'aws_media_convert') {
        buckets.videoProcessing.push(node);
      } else if (
        type === 'aws_apigatewayv2_api' ||
        meta.protocol_type === 'WEBSOCKET' ||
        labelLower.includes('websocket') ||
        labelLower.includes('chat')
      ) {
        buckets.chat.push(node);
      } else if (
        type === 'aws_vpc' ||
        type === 'aws_subnet' ||
        type === 'aws_internet_gateway' ||
        type === 'aws_nat_gateway' ||
        type === 'aws_route_table' ||
        type === 'aws_security_group'
      ) {
        buckets.networking.push(node);
      } else if (
        type === 'aws_instance' ||
        type === 'aws_lb' ||
        type === 'aws_nlb' ||
        type === 'aws_ecs_cluster' ||
        type === 'aws_ecs_service' ||
        type === 'aws_ecs_task' ||
        type === 'aws_lambda_function' ||
        type === 'aws_api_gateway_rest_api'
      ) {
        buckets.compute.push(node);
      } else if (
        type === 'aws_db_instance' ||
        type === 'aws_dynamodb_table' ||
        type === 'aws_elasticache_cluster'
      ) {
        buckets.database.push(node);
      } else if (type === 'aws_s3_bucket') {
        buckets.storage.push(node);
      } else if (
        type === 'aws_cloudfront_distribution' ||
        type === 'aws_route53_zone' ||
        type === 'aws_acm_certificate'
      ) {
        buckets.cdn.push(node);
      } else if (
        type === 'aws_iam_role' ||
        type === 'aws_kms_key' ||
        type === 'aws_secretsmanager_secret' ||
        type === 'aws_wafv2_web_acl'
      ) {
        buckets.security.push(node);
      } else if (
        type === 'aws_cloudwatch_metric_alarm' ||
        type === 'aws_sqs_queue' ||
        type === 'aws_sns_topic'
      ) {
        // Alarms go to monitoring; SQS/SNS can go to compute or messaging/monitoring
        if (type === 'aws_cloudwatch_metric_alarm') {
          buckets.monitoring.push(node);
        } else {
          buckets.compute.push(node);
        }
      } else {
        // Fallback to compute
        buckets.compute.push(node);
      }
    }

    return buckets;
  }

  // --- Root Files Generation ---

  private static generateVersionsFile(): TerraformFile {
    return {
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
    };
  }

  private static generateProviderFile(): TerraformFile {
    return {
      filename: 'provider.tf',
      content: `provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "CloudForge"
    }
  }
}
`,
    };
  }

  private static generateGitignoreFile(): TerraformFile {
    return {
      filename: '.gitignore',
      content: `# Terraform runtime and local state files
.terraform/
.terraform.lock.hcl
*.tfstate
*.tfstate.*
crash.log
crash.*.log

# Variable definition files containing secrets
*.tfvars
!*.tfvars.example

# Override files
override.tf
override.tf.json
*_override.tf
*_override.tf.json

# CLI configuration files
.terraformrc
terraform.rc
`,
    };
  }

  private static generateRootVariablesFile(
    ctx: ModuleContext,
    buckets: ReturnType<typeof TerraformModularGenerator.categorizeResources>,
  ): TerraformFile {
    const lines: string[] = [];

    lines.push(hclVariable('aws_region', 'string', `"${ctx.region}"`, 'AWS deployment region'));
    lines.push(hclVariable('environment', 'string', '"dev"', 'Deployment environment name (e.g. dev, staging, prod)'));
    lines.push(hclVariable('project_name', 'string', `"${ctx.sanitizedProjectName}"`, 'Project name prefix for resources'));

    if (buckets.networking.length > 0) {
      lines.push(hclVariable('vpc_cidr', 'string', '"10.0.0.0/16"', 'CIDR block for the primary VPC'));
    }

    if (buckets.compute.some((n) => n.resourceType === 'aws_instance')) {
      lines.push(hclVariable('ec2_ami', 'string', '"ami-0c55b159cbfafe1f0"', 'AMI ID for EC2 instances'));
      lines.push(hclVariable('ec2_instance_type', 'string', '"t3.micro"', 'Instance type for EC2 instances'));
    }

    if (buckets.database.some((n) => n.resourceType === 'aws_db_instance')) {
      lines.push(hclVariable('db_username', 'string', '"dbadmin"', 'RDS master username'));
      lines.push(hclVariable('db_password', 'string', 'null', 'RDS master password (sensitive)', true));
    }

    if (buckets.aiAgent.length > 0) {
      lines.push(hclVariable('bedrock_model_id', 'string', '"anthropic.claude-3-sonnet-20240229-v1:0"', 'Amazon Bedrock foundation model identifier'));
    }

    return {
      filename: 'variables.tf',
      content: lines.join('\n'),
    };
  }

  private static generateTfvarsExampleFile(
    ctx: ModuleContext,
    buckets: ReturnType<typeof TerraformModularGenerator.categorizeResources>,
  ): TerraformFile {
    const lines: string[] = [
      `# Example variable assignments for CloudForge architecture: "${ctx.architectureName}"`,
      `aws_region   = "${ctx.region}"`,
      `environment  = "dev"`,
      `project_name = "${ctx.sanitizedProjectName}"`,
    ];

    if (buckets.networking.length > 0) {
      lines.push(`vpc_cidr     = "10.0.0.0/16"`);
    }

    if (buckets.compute.some((n) => n.resourceType === 'aws_instance')) {
      lines.push(`ec2_ami      = "ami-0c55b159cbfafe1f0"`);
      lines.push(`ec2_instance_type = "t3.micro"`);
    }

    if (buckets.database.some((n) => n.resourceType === 'aws_db_instance')) {
      lines.push(``);
      lines.push(`# Database credentials - DO NOT commit plaintext passwords to git`);
      lines.push(`db_username  = "dbadmin"`);
      lines.push(`db_password  = "ChangeMeSecurely123!"`);
    }

    if (buckets.aiAgent.length > 0) {
      lines.push(`bedrock_model_id = "anthropic.claude-3-sonnet-20240229-v1:0"`);
    }

    lines.push(``);
    return {
      filename: 'terraform.tfvars.example',
      content: lines.join('\n'),
    };
  }

  private static generateDevEnvTfvarsFile(
    ctx: ModuleContext,
    buckets: ReturnType<typeof TerraformModularGenerator.categorizeResources>,
  ): TerraformFile {
    const lines: string[] = [
      `# Development Environment Variables`,
      `aws_region   = "${ctx.region}"`,
      `environment  = "dev"`,
      `project_name = "${ctx.sanitizedProjectName}-dev"`,
    ];

    if (buckets.networking.length > 0) {
      lines.push(`vpc_cidr     = "10.0.0.0/16"`);
    }

    if (buckets.database.some((n) => n.resourceType === 'aws_db_instance')) {
      lines.push(``);
      lines.push(`# db_password = "SetYourDevPasswordSecurely"`);
    }

    lines.push(``);
    return {
      filename: 'environments/dev/terraform.tfvars.example',
      content: lines.join('\n'),
    };
  }

  private static generateDevEnvReadmeFile(ctx: ModuleContext): TerraformFile {
    return {
      filename: 'environments/dev/README.md',
      content: `# Dev Environment Configuration

This folder contains environment-specific configuration for deploying the "${ctx.architectureName}" stack to **dev**.

## Deployment Steps

\`\`\`bash
# 1. Copy the example variables
cp terraform.tfvars.example terraform.tfvars

# 2. Fill in required sensitive values (e.g. db_password)
# 3. Plan and apply from root:
cd ../..
terraform plan -var-file="environments/dev/terraform.tfvars"
terraform apply -var-file="environments/dev/terraform.tfvars"
\`\`\`
`,
    };
  }

  // --- Child Modules Generation ---

  /**
   * 1. Networking Module
   */
  private static generateNetworkingModule(
    ctx: ModuleContext,
    nodes: TerraformNodeInput[],
  ): TerraformFile[] {
    const mainLines: string[] = [];
    const vpcs = nodes.filter((n) => n.resourceType === 'aws_vpc');
    const subnets = nodes.filter((n) => n.resourceType === 'aws_subnet');
    const igws = nodes.filter((n) => n.resourceType === 'aws_internet_gateway');
    const nats = nodes.filter((n) => n.resourceType === 'aws_nat_gateway');
    const sgs = nodes.filter((n) => n.resourceType === 'aws_security_group');

    // VPC
    const vpcResourceName = vpcs.length > 0 ? safeResourceName(vpcs[0].label, 'aws_vpc', vpcs[0].id) : 'main';
    mainLines.push(
      hclBlock('aws_vpc', vpcResourceName, {
        cidr_block: tfExpr('var.vpc_cidr'),
        enable_dns_hostnames: true,
        enable_dns_support: true,
        tags: {
          Name: tfExpr(`"\${var.project_name}-\${var.environment}-vpc"`),
        },
      }),
    );

    // Subnets: Allocate unique, non-overlapping CIDRs and cycle Availability Zones
    const publicSubnetNames: string[] = [];
    const privateSubnetNames: string[] = [];
    const dataSubnetNames: string[] = [];

    const azSuffixes = ['a', 'b', 'c', 'd'];

    subnets.forEach((sub, idx) => {
      const subName = uniqueResourceName(ctx.usedNames, sub.label, 'aws_subnet', sub.id);
      const isPublic =
        sub.metadata?.map_public_ip_on_launch === true ||
        (sub.label || '').toLowerCase().includes('public');
      const isData =
        (sub.label || '').toLowerCase().includes('data') ||
        (sub.label || '').toLowerCase().includes('db');

      const az = (sub.metadata?.availability_zone as string) || `${ctx.region}${azSuffixes[idx % azSuffixes.length]}`;
      // Distribute non-overlapping CIDRs: 10.0.1.0/24, 10.0.2.0/24, etc.
      const cidr = (sub.metadata?.cidr_block as string) || `10.0.${idx + 1}.0/24`;

      if (isData) {
        dataSubnetNames.push(subName);
      } else if (isPublic) {
        publicSubnetNames.push(subName);
      } else {
        privateSubnetNames.push(subName);
      }

      mainLines.push(
        hclBlock(
          'aws_subnet',
          subName,
          {
            vpc_id: tfExpr(`aws_vpc.${vpcResourceName}.id`),
            cidr_block: cidr,
            availability_zone: az,
            map_public_ip_on_launch: isPublic,
            tags: {
              Name: tfExpr(`"\${var.project_name}-\${var.environment}-${subName}"`),
              Tier: isPublic ? 'public' : isData ? 'data' : 'private',
            },
          },
        ),
      );
    });

    // Fallback if no subnets were specified in architecture
    if (subnets.length === 0) {
      publicSubnetNames.push('public_1');
      privateSubnetNames.push('private_1');
      mainLines.push(
        hclBlock('aws_subnet', 'public_1', {
          vpc_id: tfExpr(`aws_vpc.${vpcResourceName}.id`),
          cidr_block: '10.0.1.0/24',
          availability_zone: `${ctx.region}a`,
          map_public_ip_on_launch: true,
          tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-public-1"`) },
        }),
      );
      mainLines.push(
        hclBlock('aws_subnet', 'private_1', {
          vpc_id: tfExpr(`aws_vpc.${vpcResourceName}.id`),
          cidr_block: '10.0.2.0/24',
          availability_zone: `${ctx.region}b`,
          map_public_ip_on_launch: false,
          tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-private-1"`) },
        }),
      );
    }

    // Internet Gateway (if present or if public subnets exist)
    const igwName = igws.length > 0 ? safeResourceName(igws[0].label, 'aws_internet_gateway', igws[0].id) : 'main';
    mainLines.push(
      hclBlock('aws_internet_gateway', igwName, {
        vpc_id: tfExpr(`aws_vpc.${vpcResourceName}.id`),
        tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-igw"`) },
      }),
    );

    // Public Route Table
    mainLines.push(
      hclBlock('aws_route_table', 'public', {
        vpc_id: tfExpr(`aws_vpc.${vpcResourceName}.id`),
        tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-public-rt"`) },
      }, [
        `  route {`,
        `    cidr_block = "0.0.0.0/0"`,
        `    gateway_id = aws_internet_gateway.${igwName}.id`,
        `  }`,
      ]),
    );

    // Associate public subnets to public route table
    publicSubnetNames.forEach((psName, idx) => {
      mainLines.push(
        `resource "aws_route_table_association" "public_${idx}" {\n  subnet_id      = aws_subnet.${psName}.id\n  route_table_id = aws_route_table.public.id\n}\n`,
      );
    });

    // NAT Gateway + EIP (if present)
    if (nats.length > 0) {
      const natTargetSubnet = publicSubnetNames[0] || 'public_1';
      mainLines.push(
        hclBlock('aws_eip', 'nat', {
          domain: 'vpc',
          tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-nat-eip"`) },
        }),
      );
      mainLines.push(
        hclBlock('aws_nat_gateway', 'main', {
          allocation_id: tfExpr('aws_eip.nat.id'),
          subnet_id: tfExpr(`aws_subnet.${natTargetSubnet}.id`),
          connectivity_type: 'public',
          tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-nat"`) },
        }),
      );
      // Private Route Table routing outbound through NAT
      mainLines.push(
        hclBlock('aws_route_table', 'private', {
          vpc_id: tfExpr(`aws_vpc.${vpcResourceName}.id`),
          tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-private-rt"`) },
        }, [
          `  route {`,
          `    cidr_block     = "0.0.0.0/0"`,
          `    nat_gateway_id = aws_nat_gateway.main.id`,
          `  }`,
        ]),
      );
      privateSubnetNames.forEach((privName, idx) => {
        mainLines.push(
          `resource "aws_route_table_association" "private_${idx}" {\n  subnet_id      = aws_subnet.${privName}.id\n  route_table_id = aws_route_table.private.id\n}\n`,
        );
      });
    }

    // Security Groups
    const sgNames: string[] = [];
    if (sgs.length > 0) {
      for (const sg of sgs) {
        const sgName = uniqueResourceName(ctx.usedNames, sg.label, 'aws_security_group', sg.id);
        sgNames.push(sgName);

        const ingressBlocks: string[] = [];
        const ingressRules = sg.metadata?.ingress_rules as Array<any> | undefined;
        if (ingressRules && ingressRules.length > 0) {
          for (const rule of ingressRules) {
            ingressBlocks.push(`  ingress {`);
            ingressBlocks.push(`    description = ${hclString(rule.description || 'Allow traffic')}`);
            ingressBlocks.push(`    from_port   = ${rule.from_port ?? 80}`);
            ingressBlocks.push(`    to_port     = ${rule.to_port ?? 80}`);
            ingressBlocks.push(`    protocol    = ${hclString(rule.protocol ?? 'tcp')}`);
            ingressBlocks.push(`    cidr_blocks = ${JSON.stringify(rule.cidr_blocks ?? ['0.0.0.0/0'])}`);
            ingressBlocks.push(`  }`);
          }
        } else {
          ingressBlocks.push(`  ingress {`);
          ingressBlocks.push(`    description = "Allow inbound HTTP"`);
          ingressBlocks.push(`    from_port   = 80`);
          ingressBlocks.push(`    to_port     = 80`);
          ingressBlocks.push(`    protocol    = "tcp"`);
          ingressBlocks.push(`    cidr_blocks = ["0.0.0.0/0"]`);
          ingressBlocks.push(`  }`);
        }

        const egressBlock = [
          `  egress {`,
          `    description = "All outbound traffic"`,
          `    from_port   = 0`,
          `    to_port     = 0`,
          `    protocol    = "-1"`,
          `    cidr_blocks = ["0.0.0.0/0"]`,
          `  }`,
        ];

        mainLines.push(
          hclBlock(
            'aws_security_group',
            sgName,
            {
              name: tfExpr(`"\${var.project_name}-\${var.environment}-${sgName}"`),
              description: sg.label || 'Security group managed by CloudForge',
              vpc_id: tfExpr(`aws_vpc.${vpcResourceName}.id`),
              tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-${sgName}"`) },
            },
            [...ingressBlocks, ...egressBlock],
          ),
        );
      }
    } else {
      // Default security group
      sgNames.push('default');
      mainLines.push(
        hclBlock(
          'aws_security_group',
          'default',
          {
            name: tfExpr(`"\${var.project_name}-\${var.environment}-default-sg"`),
            description: 'Default security group created by CloudForge',
            vpc_id: tfExpr(`aws_vpc.${vpcResourceName}.id`),
            tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-default-sg"`) },
          },
          [
            `  ingress {`,
            `    description = "Allow TLS from VPC"`,
            `    from_port   = 443`,
            `    to_port     = 443`,
            `    protocol    = "tcp"`,
            `    cidr_blocks = [aws_vpc.${vpcResourceName}.cidr_block]`,
            `  }`,
            `  egress {`,
            `    description = "Allow all outbound"`,
            `    from_port   = 0`,
            `    to_port     = 0`,
            `    protocol    = "-1"`,
            `    cidr_blocks = ["0.0.0.0/0"]`,
            `  }`,
          ],
        ),
      );
    }

    // Networking variables.tf
    const varLines: string[] = [
      hclVariable('aws_region', 'string', undefined, 'AWS region for deployment'),
      hclVariable('vpc_cidr', 'string', '"10.0.0.0/16"', 'CIDR block for VPC'),
      hclVariable('environment', 'string', '"dev"', 'Environment name'),
      hclVariable('project_name', 'string', '"cloudforge"', 'Project prefix'),
    ];

    // Networking outputs.tf
    const outLines: string[] = [
      hclOutput('vpc_id', `aws_vpc.${vpcResourceName}.id`, 'The ID of the VPC'),
      hclOutput('vpc_cidr_block', `aws_vpc.${vpcResourceName}.cidr_block`, 'The CIDR block of the VPC'),
      hclOutput(
        'public_subnet_ids',
        `[\n${publicSubnetNames.map((n) => `    aws_subnet.${n}.id`).join(',\n')}\n  ]`,
        'List of IDs of public subnets',
      ),
      hclOutput(
        'private_subnet_ids',
        `[\n${(privateSubnetNames.length > 0 ? privateSubnetNames : publicSubnetNames)
          .map((n) => `    aws_subnet.${n}.id`)
          .join(',\n')}\n  ]`,
        'List of IDs of private subnets',
      ),
      hclOutput(
        'data_subnet_ids',
        `[\n${(dataSubnetNames.length > 0
          ? dataSubnetNames
          : privateSubnetNames.length > 0
          ? privateSubnetNames
          : publicSubnetNames
        )
          .map((n) => `    aws_subnet.${n}.id`)
          .join(',\n')}\n  ]`,
        'List of IDs of database/data subnets',
      ),
      hclOutput(
        'security_group_ids',
        `{\n${sgNames.map((n) => `    "${n}" = aws_security_group.${n}.id`).join(',\n')}\n  }`,
        'Map of security group names to their IDs',
      ),
    ];

    return [
      { filename: 'modules/networking/main.tf', content: mainLines.join('\n') },
      { filename: 'modules/networking/variables.tf', content: varLines.join('\n') },
      { filename: 'modules/networking/outputs.tf', content: outLines.join('\n') },
    ];
  }

  /**
   * 2. Compute Module
   */
  private static generateComputeModule(
    ctx: ModuleContext,
    nodes: TerraformNodeInput[],
  ): TerraformFile[] {
    const mainLines: string[] = [];
    const instances = nodes.filter((n) => n.resourceType === 'aws_instance');
    const lbs = nodes.filter((n) => n.resourceType === 'aws_lb' || n.resourceType === 'aws_nlb');
    const ecsClusters = nodes.filter((n) => n.resourceType === 'aws_ecs_cluster');
    const ecsServices = nodes.filter((n) => n.resourceType === 'aws_ecs_service');
    const lambdas = nodes.filter((n) => n.resourceType === 'aws_lambda_function');
    const sqsQueues = nodes.filter((n) => n.resourceType === 'aws_sqs_queue');

    const ec2Names: string[] = [];
    const lbNames: string[] = [];
    const lambdaNames: string[] = [];

    // EC2 Instances
    for (const inst of instances) {
      const instName = uniqueResourceName(ctx.usedNames, inst.label, 'aws_instance', inst.id);
      ec2Names.push(instName);

      if (!inst.metadata?.ami) {
        ctx.issues.push({
          nodeId: inst.id,
          resourceType: 'aws_instance',
          missing: 'AMI ID not configured — using var.ec2_ami placeholder',
          severity: 'warning',
        });
      }

      mainLines.push(
        hclBlock(
          'aws_instance',
          instName,
          {
            ami: tfExpr('var.ec2_ami'),
            instance_type: tfExpr('var.ec2_instance_type'),
            subnet_id: tfExpr('length(var.subnet_ids) > 0 ? var.subnet_ids[0] : null'),
            vpc_security_group_ids: tfExpr('var.security_group_ids'),
            tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-${instName}"`) },
          },
          [
            `  root_block_device {`,
            `    volume_size = ${Number(inst.metadata?.root_volume_size || 20)}`,
            `    volume_type = "gp3"`,
            `    encrypted   = true`,
            `  }`,
          ],
        ),
      );
    }

    // Load Balancers (ALB/NLB with target group & listener)
    for (const lb of lbs) {
      const lbName = uniqueResourceName(ctx.usedNames, lb.label, 'aws_lb', lb.id);
      lbNames.push(lbName);
      const isInternal = lb.metadata?.internal === true;
      const lbType = lb.resourceType === 'aws_nlb' ? 'network' : 'application';

      // 1. Target Group
      const tgName = `${lbName}_tg`;
      mainLines.push(
        hclBlock(
          'aws_lb_target_group',
          tgName,
          {
            name: tfExpr(`substr("\${var.project_name}-\${var.environment}-${tgName}", 0, 32)`),
            port: 80,
            protocol: lbType === 'application' ? 'HTTP' : 'TCP',
            vpc_id: tfExpr('var.vpc_id != "" ? var.vpc_id : null'),
            target_type: 'instance',
            tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-${tgName}"`) },
          },
          [
            `  health_check {`,
            `    enabled             = true`,
            `    path                = "/"`,
            `    port                = "traffic-port"`,
            `    protocol            = "${lbType === 'application' ? 'HTTP' : 'TCP'}"`,
            `    interval            = 30`,
            `    healthy_threshold   = 3`,
            `    unhealthy_threshold = 3`,
            `  }`,
          ],
        ),
      );

      // 2. Load Balancer Resource
      mainLines.push(
        hclBlock(
          'aws_lb',
          lbName,
          {
            name: tfExpr(`substr("\${var.project_name}-\${var.environment}-${lbName}", 0, 32)`),
            internal: isInternal,
            load_balancer_type: lbType,
            security_groups: tfExpr('var.security_group_ids'),
            subnets: tfExpr('var.subnet_ids'),
            enable_deletion_protection: false,
            tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-${lbName}"`) },
          },
        ),
      );

      // 3. Listener
      mainLines.push(
        hclBlock(
          'aws_lb_listener',
          `${lbName}_http`,
          {
            load_balancer_arn: tfExpr(`aws_lb.${lbName}.arn`),
            port: 80,
            protocol: lbType === 'application' ? 'HTTP' : 'TCP',
          },
          [
            `  default_action {`,
            `    type             = "forward"`,
            `    target_group_arn = aws_lb_target_group.${tgName}.arn`,
            `  }`,
          ],
        ),
      );
    }

    // ECS Cluster & Task Definition & Service
    if (ecsClusters.length > 0 || ecsServices.length > 0) {
      const clusterName = ecsClusters.length > 0
        ? uniqueResourceName(ctx.usedNames, ecsClusters[0].label, 'aws_ecs_cluster', ecsClusters[0].id)
        : 'main';

      mainLines.push(
        hclBlock('aws_ecs_cluster', clusterName, {
          name: tfExpr(`"\${var.project_name}-\${var.environment}-ecs-cluster"`),
          tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-ecs-cluster"`) },
        }),
      );

      // Task Execution IAM Role
      mainLines.push(
        hclBlock(
          'aws_iam_role',
          'ecs_execution_role',
          {
            name: tfExpr(`"\${var.project_name}-\${var.environment}-ecs-exec-role"`),
            assume_role_policy: tfExpr(`jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })`),
            tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-ecs-exec-role"`) },
          },
        ),
      );

      mainLines.push(
        `resource "aws_iam_role_policy_attachment" "ecs_execution" {\n  role       = aws_iam_role.ecs_execution_role.name\n  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"\n}\n`,
      );

      // ECS Task Definition
      mainLines.push(
        hclBlock(
          'aws_ecs_task_definition',
          'app_task',
          {
            family: tfExpr(`"\${var.project_name}-\${var.environment}-app"`),
            network_mode: 'awsvpc',
            requires_compatibilities: ['FARGATE'],
            cpu: '256',
            memory: '512',
            execution_role_arn: tfExpr('aws_iam_role.ecs_execution_role.arn'),
            container_definitions: tfExpr(`jsonencode([
    {
      name      = "app"
      image     = "public.ecr.aws/nginx/nginx:latest"
      essential = true
      portMappings = [
        {
          containerPort = 80
          hostPort      = 80
        }
      ]
    }
  ])`),
            tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-task"`) },
          },
        ),
      );

      // ECS Service
      mainLines.push(
        hclBlock(
          'aws_ecs_service',
          'app_service',
          {
            name: tfExpr(`"\${var.project_name}-\${var.environment}-service"`),
            cluster: tfExpr(`aws_ecs_cluster.${clusterName}.id`),
            task_definition: tfExpr('aws_ecs_task_definition.app_task.arn'),
            desired_count: 1,
            launch_type: 'FARGATE',
            tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-service"`) },
          },
          [
            `  network_configuration {`,
            `    subnets          = var.subnet_ids`,
            `    security_groups  = var.security_group_ids`,
            `    assign_public_ip = false`,
            `  }`,
          ],
        ),
      );
    }

    // Lambda Functions
    if (lambdas.length > 0) {
      // Default execution role for Lambda
      mainLines.push(
        hclBlock(
          'aws_iam_role',
          'lambda_exec_role',
          {
            name: tfExpr(`"\${var.project_name}-\${var.environment}-lambda-exec"`),
            assume_role_policy: tfExpr(`jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })`),
            tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-lambda-exec"`) },
          },
        ),
      );

      mainLines.push(
        `resource "aws_iam_role_policy_attachment" "lambda_basic" {\n  role       = aws_iam_role.lambda_exec_role.name\n  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRolePolicy"\n}\n`,
      );

      for (const lam of lambdas) {
        const lamName = uniqueResourceName(ctx.usedNames, lam.label, 'aws_lambda_function', lam.id);
        lambdaNames.push(lamName);

        ctx.issues.push({
          nodeId: lam.id,
          resourceType: 'aws_lambda_function',
          missing: 'Lambda source package "lambda.zip" required before deploy',
          severity: 'warning',
        });

        mainLines.push(
          hclBlock(
            'aws_lambda_function',
            lamName,
            {
              function_name: tfExpr(`"\${var.project_name}-\${var.environment}-${lamName}"`),
              runtime: (lam.metadata?.runtime as string) || 'nodejs20.x',
              handler: (lam.metadata?.handler as string) || 'index.handler',
              role: tfExpr('var.lambda_role_arn != "" ? var.lambda_role_arn : aws_iam_role.lambda_exec_role.arn'),
              tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-${lamName}"`) },
            },
            [
              `  filename         = "lambda.zip"  # Provide deployment zip package`,
              `  source_code_hash = fileexists("lambda.zip") ? filebase64sha256("lambda.zip") : null`,
            ],
          ),
        );
      }
    }

    // SQS Queues
    for (const q of sqsQueues) {
      const qName = uniqueResourceName(ctx.usedNames, q.label, 'aws_sqs_queue', q.id);
      mainLines.push(
        hclBlock('aws_sqs_queue', qName, {
          name: tfExpr(`"\${var.project_name}-\${var.environment}-${qName}"`),
          tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-${qName}"`) },
        }),
      );
    }

    // Compute variables.tf
    const varLines: string[] = [
      hclVariable('environment', 'string', '"dev"', 'Environment name'),
      hclVariable('project_name', 'string', '"cloudforge"', 'Project prefix'),
      hclVariable('vpc_id', 'string', '""', 'VPC ID for resources'),
      hclVariable('subnet_ids', 'list(string)', '[]', 'List of subnet IDs for compute resources'),
      hclVariable('security_group_ids', 'list(string)', '[]', 'List of security group IDs'),
      hclVariable('ec2_ami', 'string', '"ami-0c55b159cbfafe1f0"', 'AMI ID for EC2'),
      hclVariable('ec2_instance_type', 'string', '"t3.micro"', 'Instance type for EC2'),
      hclVariable('lambda_role_arn', 'string', '""', 'Custom IAM role ARN for Lambda functions (optional)'),
    ];

    // Compute outputs.tf
    const outLines: string[] = [
      hclOutput(
        'instance_ids',
        `[\n${ec2Names.map((n) => `    aws_instance.${n}.id`).join(',\n')}\n  ]`,
        'List of EC2 instance IDs',
      ),
      hclOutput(
        'alb_dns_name',
        lbNames.length > 0 ? `aws_lb.${lbNames[0]}.dns_name` : '""',
        'Application Load Balancer DNS name',
      ),
      hclOutput(
        'alb_arn',
        lbNames.length > 0 ? `aws_lb.${lbNames[0]}.arn` : '""',
        'Application Load Balancer ARN',
      ),
      hclOutput(
        'ecs_cluster_arn',
        ecsClusters.length > 0 || ecsServices.length > 0 ? `aws_ecs_cluster.main.arn` : '""',
        'ECS Cluster ARN',
      ),
      hclOutput(
        'lambda_function_arns',
        `[\n${lambdaNames.map((n) => `    aws_lambda_function.${n}.arn`).join(',\n')}\n  ]`,
        'List of Lambda function ARNs',
      ),
    ];

    return [
      { filename: 'modules/compute/main.tf', content: mainLines.join('\n') },
      { filename: 'modules/compute/variables.tf', content: varLines.join('\n') },
      { filename: 'modules/compute/outputs.tf', content: outLines.join('\n') },
    ];
  }

  /**
   * 3. Database Module
   */
  private static generateDatabaseModule(
    ctx: ModuleContext,
    nodes: TerraformNodeInput[],
  ): TerraformFile[] {
    const mainLines: string[] = [];
    const rdsInstances = nodes.filter((n) => n.resourceType === 'aws_db_instance');
    const dynamoTables = nodes.filter((n) => n.resourceType === 'aws_dynamodb_table');
    const elasticaches = nodes.filter((n) => n.resourceType === 'aws_elasticache_cluster');

    let hasRds = false;
    let rdsResourceName = '';

    // RDS Instances: Create DB Subnet Group first!
    if (rdsInstances.length > 0) {
      hasRds = true;
      mainLines.push(
        hclBlock('aws_db_subnet_group', 'main', {
          name: tfExpr(`"\${var.project_name}-\${var.environment}-db-subnet-group"`),
          subnet_ids: tfExpr('var.subnet_ids'),
          tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-db-subnet-group"`) },
        }),
      );

      for (const rds of rdsInstances) {
        rdsResourceName = uniqueResourceName(ctx.usedNames, rds.label, 'aws_db_instance', rds.id);
        const engine = (rds.metadata?.engine as string) || 'postgres';
        const instanceClass = (rds.metadata?.instance_class as string) || 'db.t3.micro';
        const allocatedStorage = Number(rds.metadata?.allocated_storage || 20);
        const multiAz = rds.metadata?.multi_az === true;

        mainLines.push(
          hclBlock(
            'aws_db_instance',
            rdsResourceName,
            {
              identifier: tfExpr(`"\${var.project_name}-\${var.environment}-${rdsResourceName}"`),
              engine,
              instance_class: instanceClass,
              allocated_storage: allocatedStorage,
              multi_az: multiAz,
              storage_encrypted: true,
              db_subnet_group_name: tfExpr('aws_db_subnet_group.main.name'),
              username: tfExpr('var.db_username'),
              password: tfExpr('var.db_password'),
              skip_final_snapshot: true,
              tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-${rdsResourceName}"`) },
            },
          ),
        );
      }
    }

    // DynamoDB Tables
    const dynamoNames: string[] = [];
    for (const table of dynamoTables) {
      const tName = uniqueResourceName(ctx.usedNames, table.label, 'aws_dynamodb_table', table.id);
      dynamoNames.push(tName);
      const hashKey = (table.metadata?.hash_key as string) || 'id';
      const rangeKey = (table.metadata?.range_key as string) || null;

      const attrBlocks = [
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

      const keySchemaBlocks = [
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

      mainLines.push(
        hclBlock(
          'aws_dynamodb_table',
          tName,
          {
            name: tfExpr(`"\${var.project_name}-\${var.environment}-${tName}"`),
            billing_mode: 'PAY_PER_REQUEST',
            tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-${tName}"`) },
          },
          [...attrBlocks, ...keySchemaBlocks],
        ),
      );
    }

    // ElastiCache Cluster
    for (const ec of elasticaches) {
      const ecName = uniqueResourceName(ctx.usedNames, ec.label, 'aws_elasticache_cluster', ec.id);
      mainLines.push(
        hclBlock('aws_elasticache_subnet_group', `${ecName}_subnets`, {
          name: tfExpr(`"\${var.project_name}-\${var.environment}-${ecName}-subnet-group"`),
          subnet_ids: tfExpr('var.subnet_ids'),
        }),
      );
      mainLines.push(
        hclBlock('aws_elasticache_cluster', ecName, {
          cluster_id: tfExpr(`substr("\${var.project_name}-\${var.environment}-${ecName}", 0, 40)`),
          engine: 'redis',
          node_type: (ec.metadata?.node_type as string) || 'cache.t3.micro',
          num_cache_nodes: 1,
          subnet_group_name: tfExpr(`aws_elasticache_subnet_group.${ecName}_subnets.name`),
          tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-${ecName}"`) },
        }),
      );
    }

    // Database variables.tf
    const varLines: string[] = [
      hclVariable('environment', 'string', '"dev"', 'Environment name'),
      hclVariable('project_name', 'string', '"cloudforge"', 'Project prefix'),
      hclVariable('vpc_id', 'string', '""', 'VPC ID for database subnets'),
      hclVariable('subnet_ids', 'list(string)', '[]', 'List of database subnet IDs'),
      hclVariable('db_username', 'string', '"dbadmin"', 'Database administrator username'),
      hclVariable('db_password', 'string', 'null', 'Database administrator password', true),
    ];

    // Database outputs.tf
    const outLines: string[] = [
      hclOutput(
        'rds_endpoint',
        hasRds ? `aws_db_instance.${rdsResourceName}.endpoint` : '""',
        'RDS instance connection endpoint',
      ),
      hclOutput(
        'rds_identifier',
        hasRds ? `aws_db_instance.${rdsResourceName}.identifier` : '""',
        'RDS instance identifier',
      ),
      hclOutput(
        'dynamodb_table_names',
        `[\n${dynamoNames.map((n) => `    aws_dynamodb_table.${n}.name`).join(',\n')}\n  ]`,
        'List of DynamoDB table names',
      ),
    ];

    return [
      { filename: 'modules/database/main.tf', content: mainLines.join('\n') },
      { filename: 'modules/database/variables.tf', content: varLines.join('\n') },
      { filename: 'modules/database/outputs.tf', content: outLines.join('\n') },
    ];
  }

  /**
   * 4. Storage Module (S3)
   */
  private static generateStorageModule(
    ctx: ModuleContext,
    nodes: TerraformNodeInput[],
  ): TerraformFile[] {
    const mainLines: string[] = [];
    const buckets = nodes.filter((n) => n.resourceType === 'aws_s3_bucket');
    const bucketResourceNames: string[] = [];

    for (const b of buckets) {
      const bResName = uniqueResourceName(ctx.usedNames, b.label, 'aws_s3_bucket', b.id);
      bucketResourceNames.push(bResName);
      // AWS S3 bucket name sanitization: no underscores, lowercased, hyphens only
      const rawBucket = (b.metadata?.bucket as string) || bResName;
      const sanitized = sanitizeS3BucketName(rawBucket.replace(/_/g, '-'));

      // S3 Bucket
      mainLines.push(
        hclBlock('aws_s3_bucket', bResName, {
          bucket: tfExpr(`"\${var.project_name}-\${var.environment}-${sanitized}"`),
          force_destroy: true,
          tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-${sanitized}"`) },
        }),
      );

      // Versioning
      mainLines.push(
        `resource "aws_s3_bucket_versioning" "${bResName}_versioning" {\n  bucket = aws_s3_bucket.${bResName}.id\n  versioning_configuration {\n    status = "Enabled"\n  }\n}\n`,
      );

      // Server-side Encryption
      mainLines.push(
        `resource "aws_s3_bucket_server_side_encryption_configuration" "${bResName}_crypto" {\n  bucket = aws_s3_bucket.${bResName}.id\n  rule {\n    apply_server_side_encryption_by_default {\n      sse_algorithm = "AES256"\n    }\n  }\n}\n`,
      );

      // Public Access Block
      mainLines.push(
        `resource "aws_s3_bucket_public_access_block" "${bResName}_pab" {\n  bucket                  = aws_s3_bucket.${bResName}.id\n  block_public_acls       = true\n  block_public_policy     = true\n  ignore_public_acls      = true\n  restrict_public_buckets = true\n}\n`,
      );
    }

    // Storage variables.tf
    const varLines: string[] = [
      hclVariable('environment', 'string', '"dev"', 'Environment name'),
      hclVariable('project_name', 'string', '"cloudforge"', 'Project prefix'),
    ];

    // Storage outputs.tf
    const outLines: string[] = [
      hclOutput(
        'bucket_names',
        `[\n${bucketResourceNames.map((n) => `    aws_s3_bucket.${n}.id`).join(',\n')}\n  ]`,
        'List of S3 bucket names',
      ),
      hclOutput(
        'bucket_arns',
        `[\n${bucketResourceNames.map((n) => `    aws_s3_bucket.${n}.arn`).join(',\n')}\n  ]`,
        'List of S3 bucket ARNs',
      ),
      hclOutput(
        'bucket_domain_names',
        `[\n${bucketResourceNames.map((n) => `    aws_s3_bucket.${n}.bucket_regional_domain_name`).join(',\n')}\n  ]`,
        'List of S3 regional domain names',
      ),
    ];

    return [
      { filename: 'modules/storage/main.tf', content: mainLines.join('\n') },
      { filename: 'modules/storage/variables.tf', content: varLines.join('\n') },
      { filename: 'modules/storage/outputs.tf', content: outLines.join('\n') },
    ];
  }

  /**
   * 5. AI Agent Module (Amazon Bedrock)
   */
  private static generateAiAgentModule(
    ctx: ModuleContext,
    nodes: TerraformNodeInput[],
  ): TerraformFile[] {
    const mainLines: string[] = [];
    const agents = nodes.filter((n) => n.resourceType === 'aws_bedrock_agent');
    const agentNames: string[] = [];

    // IAM Role for Bedrock Agent
    mainLines.push(
      hclBlock(
        'aws_iam_role',
        'bedrock_agent_role',
        {
          name: tfExpr(`"\${var.project_name}-\${var.environment}-bedrock-agent-role"`),
          assume_role_policy: tfExpr(`jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "bedrock.amazonaws.com"
        }
      }
    ]
  })`),
          tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-bedrock-agent-role"`) },
        },
      ),
    );

    mainLines.push(
      `resource "aws_iam_role_policy" "bedrock_agent_policy" {\n  name = "bedrock-invoke-model"\n  role = aws_iam_role.bedrock_agent_role.id\n  policy = jsonencode({\n    Version = "2012-10-17"\n    Statement = [\n      {\n        Action   = ["bedrock:InvokeModel*"]\n        Effect   = "Allow"\n        Resource = "*"\n      }\n    ]\n  })\n}\n`,
    );

    for (const ag of agents) {
      const agName = uniqueResourceName(ctx.usedNames, ag.label, 'aws_bedrock_agent', ag.id);
      agentNames.push(agName);

      mainLines.push(
        hclBlock(
          'aws_bedrockagent_agent',
          agName,
          {
            agent_name: tfExpr(`"\${var.project_name}-\${var.environment}-${agName}"`),
            agent_resource_role_arn: tfExpr('aws_iam_role.bedrock_agent_role.arn'),
            foundation_model: tfExpr('var.bedrock_model_id'),
            instruction: 'You are an autonomous AI cloud assistant built and deployed with CloudForge.',
            tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-${agName}"`) },
          },
        ),
      );
    }

    const varLines: string[] = [
      hclVariable('environment', 'string', '"dev"', 'Environment name'),
      hclVariable('project_name', 'string', '"cloudforge"', 'Project prefix'),
      hclVariable('bedrock_model_id', 'string', '"anthropic.claude-3-sonnet-20240229-v1:0"', 'Bedrock foundation model ID'),
    ];

    const outLines: string[] = [
      hclOutput(
        'bedrock_agent_id',
        agentNames.length > 0 ? `aws_bedrockagent_agent.${agentNames[0]}.id` : '""',
        'Bedrock Agent ID',
      ),
      hclOutput(
        'bedrock_agent_arn',
        agentNames.length > 0 ? `aws_bedrockagent_agent.${agentNames[0]}.agent_arn` : '""',
        'Bedrock Agent ARN',
      ),
    ];

    return [
      { filename: 'modules/ai-agent/main.tf', content: mainLines.join('\n') },
      { filename: 'modules/ai-agent/variables.tf', content: varLines.join('\n') },
      { filename: 'modules/ai-agent/outputs.tf', content: outLines.join('\n') },
    ];
  }

  /**
   * 6. Chat Module (API Gateway WebSocket)
   */
  private static generateChatModule(
    _ctx: ModuleContext,
    _nodes: TerraformNodeInput[],
  ): TerraformFile[] {
    const mainLines: string[] = [];

    mainLines.push(
      hclBlock('aws_apigatewayv2_api', 'chat_websocket', {
        name: tfExpr(`"\${var.project_name}-\${var.environment}-chat-ws"`),
        protocol_type: 'WEBSOCKET',
        route_selection_expression: '\\$request.body.action',
        tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-chat-ws"`) },
      }),
    );

    mainLines.push(
      hclBlock('aws_apigatewayv2_stage', 'chat_stage', {
        api_id: tfExpr('aws_apigatewayv2_api.chat_websocket.id'),
        name: tfExpr('var.environment'),
        auto_deploy: true,
        tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-chat-stage"`) },
      }),
    );

    const varLines: string[] = [
      hclVariable('environment', 'string', '"dev"', 'Environment name'),
      hclVariable('project_name', 'string', '"cloudforge"', 'Project prefix'),
    ];

    const outLines: string[] = [
      hclOutput('websocket_endpoint', 'aws_apigatewayv2_stage.chat_stage.invoke_url', 'WebSocket API gateway invoke URL'),
      hclOutput('websocket_api_id', 'aws_apigatewayv2_api.chat_websocket.id', 'WebSocket API ID'),
    ];

    return [
      { filename: 'modules/chat/main.tf', content: mainLines.join('\n') },
      { filename: 'modules/chat/variables.tf', content: varLines.join('\n') },
      { filename: 'modules/chat/outputs.tf', content: outLines.join('\n') },
    ];
  }

  /**
   * 7. Video Processing Module (MediaConvert & Queue)
   */
  private static generateVideoProcessingModule(
    _ctx: ModuleContext,
    _nodes: TerraformNodeInput[],
  ): TerraformFile[] {
    const mainLines: string[] = [];

    mainLines.push(
      hclBlock('aws_media_convert_queue', 'transcode_queue', {
        name: tfExpr(`"\${var.project_name}-\${var.environment}-transcode-queue"`),
        tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-transcode-queue"`) },
      }),
    );

    mainLines.push(
      hclBlock('aws_sqs_queue', 'video_jobs', {
        name: tfExpr(`"\${var.project_name}-\${var.environment}-video-jobs.fifo"`),
        fifo_queue: true,
        content_based_deduplication: true,
        tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-video-jobs"`) },
      }),
    );

    const varLines: string[] = [
      hclVariable('environment', 'string', '"dev"', 'Environment name'),
      hclVariable('project_name', 'string', '"cloudforge"', 'Project prefix'),
    ];

    const outLines: string[] = [
      hclOutput('mediaconvert_queue_arn', 'aws_media_convert_queue.transcode_queue.arn', 'MediaConvert Queue ARN'),
      hclOutput('video_jobs_queue_url', 'aws_sqs_queue.video_jobs.id', 'Video jobs SQS queue URL'),
    ];

    return [
      { filename: 'modules/video-processing/main.tf', content: mainLines.join('\n') },
      { filename: 'modules/video-processing/variables.tf', content: varLines.join('\n') },
      { filename: 'modules/video-processing/outputs.tf', content: outLines.join('\n') },
    ];
  }

  /**
   * 8. CDN Module (CloudFront, Route53, ACM)
   */
  private static generateCdnModule(
    ctx: ModuleContext,
    nodes: TerraformNodeInput[],
  ): TerraformFile[] {
    const mainLines: string[] = [];
    const dists = nodes.filter((n) => n.resourceType === 'aws_cloudfront_distribution');
    const zones = nodes.filter((n) => n.resourceType === 'aws_route53_zone');
    const certs = nodes.filter((n) => n.resourceType === 'aws_acm_certificate');

    for (const dist of dists) {
      const dName = uniqueResourceName(ctx.usedNames, dist.label, 'aws_cloudfront_distribution', dist.id);

      // Complete, compliant CloudFront distribution block with origin, cache behavior, restrictions, and certificate
      mainLines.push(
        hclBlock(
          'aws_cloudfront_distribution',
          dName,
          {
            enabled: true,
            comment: tfExpr(`"\${var.project_name}-\${var.environment}-distribution"`),
            tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-${dName}"`) },
          },
          [
            `  origin {`,
            `    domain_name = var.origin_domain_name != "" ? var.origin_domain_name : "example.com"`,
            `    origin_id   = "primary-origin"`,
            `    custom_origin_config {`,
            `      http_port              = 80`,
            `      https_port             = 443`,
            `      origin_protocol_policy = "match-viewer"`,
            `      origin_ssl_protocols   = ["TLSv1.2"]`,
            `    }`,
            `  }`,
            `  default_cache_behavior {`,
            `    allowed_methods  = ["GET", "HEAD", "OPTIONS"]`,
            `    cached_methods   = ["GET", "HEAD"]`,
            `    target_origin_id = "primary-origin"`,
            `    viewer_protocol_policy = "redirect-to-https"`,
            `    forwarded_values {`,
            `      query_string = false`,
            `      cookies {`,
            `        forward = "none"`,
            `      }`,
            `    }`,
            `    min_ttl     = 0`,
            `    default_ttl = 3600`,
            `    max_ttl     = 86400`,
            `  }`,
            `  restrictions {`,
            `    geo_restriction {`,
            `      restriction_type = "none"`,
            `    }`,
            `  }`,
            `  viewer_certificate {`,
            `    cloudfront_default_certificate = true`,
            `  }`,
          ],
        ),
      );
    }

    for (const z of zones) {
      const zName = uniqueResourceName(ctx.usedNames, z.label, 'aws_route53_zone', z.id);
      mainLines.push(
        hclBlock('aws_route53_zone', zName, {
          name: (z.metadata?.name as string) || 'example.com',
          tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-${zName}"`) },
        }),
      );
    }

    for (const cert of certs) {
      const cName = uniqueResourceName(ctx.usedNames, cert.label, 'aws_acm_certificate', cert.id);
      mainLines.push(
        hclBlock('aws_acm_certificate', cName, {
          domain_name: (cert.metadata?.domain_name as string) || 'example.com',
          validation_method: 'DNS',
          tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-${cName}"`) },
        }),
      );
    }

    const varLines: string[] = [
      hclVariable('environment', 'string', '"dev"', 'Environment name'),
      hclVariable('project_name', 'string', '"cloudforge"', 'Project prefix'),
      hclVariable('origin_domain_name', 'string', '""', 'Domain name of the upstream origin (e.g. ALB DNS or S3 bucket domain)'),
    ];

    const outLines: string[] = [
      hclOutput(
        'cloudfront_domain_name',
        dists.length > 0 ? `aws_cloudfront_distribution.${dists[0].id ? safeResourceName(dists[0].label) : 'main'}.domain_name` : '""',
        'CloudFront distribution domain name',
      ),
      hclOutput(
        'cloudfront_distribution_id',
        dists.length > 0 ? `aws_cloudfront_distribution.${dists[0].id ? safeResourceName(dists[0].label) : 'main'}.id` : '""',
        'CloudFront distribution ID',
      ),
    ];

    return [
      { filename: 'modules/cdn/main.tf', content: mainLines.join('\n') },
      { filename: 'modules/cdn/variables.tf', content: varLines.join('\n') },
      { filename: 'modules/cdn/outputs.tf', content: outLines.join('\n') },
    ];
  }

  /**
   * 9. Security Module (KMS, WAF, Standalone IAM)
   */
  private static generateSecurityModule(
    ctx: ModuleContext,
    nodes: TerraformNodeInput[],
  ): TerraformFile[] {
    const mainLines: string[] = [];
    const kmsKeys = nodes.filter((n) => n.resourceType === 'aws_kms_key');
    const secrets = nodes.filter((n) => n.resourceType === 'aws_secretsmanager_secret');
    const wafs = nodes.filter((n) => n.resourceType === 'aws_wafv2_web_acl');

    for (const k of kmsKeys) {
      const kName = uniqueResourceName(ctx.usedNames, k.label, 'aws_kms_key', k.id);
      mainLines.push(
        hclBlock('aws_kms_key', kName, {
          description: tfExpr(`"KMS key for \${var.project_name}-\${var.environment}"`),
          deletion_window_in_days: 30,
          enable_key_rotation: true,
          tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-${kName}"`) },
        }),
      );
    }

    for (const s of secrets) {
      const sName = uniqueResourceName(ctx.usedNames, s.label, 'aws_secretsmanager_secret', s.id);
      mainLines.push(
        hclBlock('aws_secretsmanager_secret', sName, {
          name: tfExpr(`"\${var.project_name}-\${var.environment}-${sName}"`),
          tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-${sName}"`) },
        }),
      );
    }

    for (const w of wafs) {
      const wName = uniqueResourceName(ctx.usedNames, w.label, 'aws_wafv2_web_acl', w.id);
      mainLines.push(
        hclBlock(
          'aws_wafv2_web_acl',
          wName,
          {
            name: tfExpr(`"\${var.project_name}-\${var.environment}-${wName}"`),
            scope: 'REGIONAL',
            tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-${wName}"`) },
          },
          [
            `  default_action {`,
            `    allow {}`,
            `  }`,
            `  visibility_config {`,
            `    cloudwatch_metrics_enabled = true`,
            `    metric_name                = "${wName}Metrics"`,
            `    sampled_requests_enabled   = true`,
            `  }`,
          ],
        ),
      );
    }

    const varLines: string[] = [
      hclVariable('environment', 'string', '"dev"', 'Environment name'),
      hclVariable('project_name', 'string', '"cloudforge"', 'Project prefix'),
    ];

    const outLines: string[] = [
      hclOutput(
        'kms_key_arn',
        kmsKeys.length > 0 ? `aws_kms_key.${safeResourceName(kmsKeys[0].label, 'aws_kms_key', kmsKeys[0].id)}.arn` : '""',
        'KMS Master Key ARN',
      ),
    ];

    return [
      { filename: 'modules/security/main.tf', content: mainLines.join('\n') },
      { filename: 'modules/security/variables.tf', content: varLines.join('\n') },
      { filename: 'modules/security/outputs.tf', content: outLines.join('\n') },
    ];
  }

  /**
   * 10. Monitoring Module (CloudWatch Alarms, Logs)
   */
  private static generateMonitoringModule(
    ctx: ModuleContext,
    nodes: TerraformNodeInput[],
  ): TerraformFile[] {
    const mainLines: string[] = [];
    const alarms = nodes.filter((n) => n.resourceType === 'aws_cloudwatch_metric_alarm');

    mainLines.push(
      hclBlock('aws_cloudwatch_log_group', 'app_logs', {
        name: tfExpr(`"/aws/\${var.project_name}/\${var.environment}"`),
        retention_in_days: 30,
        tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-logs"`) },
      }),
    );

    for (const a of alarms) {
      const aName = uniqueResourceName(ctx.usedNames, a.label, 'aws_cloudwatch_metric_alarm', a.id);
      mainLines.push(
        hclBlock('aws_cloudwatch_metric_alarm', aName, {
          alarm_name: tfExpr(`"\${var.project_name}-\${var.environment}-${aName}"`),
          comparison_operator: 'GreaterThanOrEqualToThreshold',
          evaluation_periods: 2,
          metric_name: 'CPUUtilization',
          namespace: 'AWS/EC2',
          period: 120,
          statistic: 'Average',
          threshold: 80,
          tags: { Name: tfExpr(`"\${var.project_name}-\${var.environment}-${aName}"`) },
        }),
      );
    }

    const varLines: string[] = [
      hclVariable('environment', 'string', '"dev"', 'Environment name'),
      hclVariable('project_name', 'string', '"cloudforge"', 'Project prefix'),
    ];

    const outLines: string[] = [
      hclOutput('log_group_arn', 'aws_cloudwatch_log_group.app_logs.arn', 'CloudWatch log group ARN'),
    ];

    return [
      { filename: 'modules/monitoring/main.tf', content: mainLines.join('\n') },
      { filename: 'modules/monitoring/variables.tf', content: varLines.join('\n') },
      { filename: 'modules/monitoring/outputs.tf', content: outLines.join('\n') },
    ];
  }

  // --- Root Module Orchestration ---

  /**
   * Generates root main.tf invoking each child module with module blocks
   */
  private static generateRootMainFile(
    ctx: ModuleContext,
    activeModules: Set<string>,
  ): TerraformFile {
    const lines: string[] = [
      `# Root Module Orchestration`,
      `# Project: "${ctx.architectureName}"`,
      `# Generated by CloudForge Modular Terraform Generator`,
      ``,
    ];

    if (activeModules.size === 0) {
      lines.push(`# No cloud resources found in this architecture.`);
      lines.push(`# Add resources in the CloudForge canvas to generate modular components.`);
      return {
        filename: 'main.tf',
        content: lines.join('\n'),
      };
    }

    // 1. Networking module
    if (activeModules.has('networking')) {
      lines.push(`module "networking" {`);
      lines.push(`  source = "./modules/networking"`);
      lines.push(``);
      lines.push(`  aws_region   = var.aws_region`);
      lines.push(`  vpc_cidr     = var.vpc_cidr`);
      lines.push(`  environment  = var.environment`);
      lines.push(`  project_name = var.project_name`);
      lines.push(`}`);
      lines.push(``);
    }

    // 2. Storage module
    if (activeModules.has('storage')) {
      lines.push(`module "storage" {`);
      lines.push(`  source = "./modules/storage"`);
      lines.push(``);
      lines.push(`  environment  = var.environment`);
      lines.push(`  project_name = var.project_name`);
      lines.push(`}`);
      lines.push(``);
    }

    // 3. Database module
    if (activeModules.has('database')) {
      lines.push(`module "database" {`);
      lines.push(`  source = "./modules/database"`);
      lines.push(``);
      lines.push(`  environment  = var.environment`);
      lines.push(`  project_name = var.project_name`);
      if (activeModules.has('networking')) {
        lines.push(`  vpc_id       = module.networking.vpc_id`);
        lines.push(`  subnet_ids   = module.networking.data_subnet_ids`);
      }
      lines.push(`  db_username  = var.db_username`);
      lines.push(`  db_password  = var.db_password`);
      if (activeModules.has('networking')) {
        lines.push(``);
        lines.push(`  depends_on = [module.networking]`);
      }
      lines.push(`}`);
      lines.push(``);
    }

    // 4. Compute module
    if (activeModules.has('compute')) {
      lines.push(`module "compute" {`);
      lines.push(`  source = "./modules/compute"`);
      lines.push(``);
      lines.push(`  environment  = var.environment`);
      lines.push(`  project_name = var.project_name`);
      if (activeModules.has('networking')) {
        lines.push(`  vpc_id       = module.networking.vpc_id`);
        lines.push(`  subnet_ids   = module.networking.public_subnet_ids`);
        lines.push(`  security_group_ids = values(module.networking.security_group_ids)`);
      }
      lines.push(`  ec2_ami      = var.ec2_ami`);
      if (activeModules.has('networking')) {
        lines.push(``);
        lines.push(`  depends_on = [module.networking]`);
      }
      lines.push(`}`);
      lines.push(``);
    }

    // 5. CDN module
    if (activeModules.has('cdn')) {
      lines.push(`module "cdn" {`);
      lines.push(`  source = "./modules/cdn"`);
      lines.push(``);
      lines.push(`  environment  = var.environment`);
      lines.push(`  project_name = var.project_name`);
      if (activeModules.has('compute')) {
        lines.push(`  origin_domain_name = module.compute.alb_dns_name != "" ? module.compute.alb_dns_name : "example.com"`);
      } else if (activeModules.has('storage')) {
        lines.push(`  origin_domain_name = length(module.storage.bucket_domain_names) > 0 ? module.storage.bucket_domain_names[0] : "example.com"`);
      }
      lines.push(`}`);
      lines.push(``);
    }

    // 6. AI Agent module
    if (activeModules.has('ai-agent')) {
      lines.push(`module "ai_agent" {`);
      lines.push(`  source = "./modules/ai-agent"`);
      lines.push(``);
      lines.push(`  environment      = var.environment`);
      lines.push(`  project_name     = var.project_name`);
      lines.push(`  bedrock_model_id = var.bedrock_model_id`);
      lines.push(`}`);
      lines.push(``);
    }

    // 7. Chat module
    if (activeModules.has('chat')) {
      lines.push(`module "chat" {`);
      lines.push(`  source = "./modules/chat"`);
      lines.push(``);
      lines.push(`  environment  = var.environment`);
      lines.push(`  project_name = var.project_name`);
      lines.push(`}`);
      lines.push(``);
    }

    // 8. Video processing module
    if (activeModules.has('video-processing')) {
      lines.push(`module "video_processing" {`);
      lines.push(`  source = "./modules/video-processing"`);
      lines.push(``);
      lines.push(`  environment  = var.environment`);
      lines.push(`  project_name = var.project_name`);
      lines.push(`}`);
      lines.push(``);
    }

    // 9. Security module
    if (activeModules.has('security')) {
      lines.push(`module "security" {`);
      lines.push(`  source = "./modules/security"`);
      lines.push(``);
      lines.push(`  environment  = var.environment`);
      lines.push(`  project_name = var.project_name`);
      lines.push(`}`);
      lines.push(``);
    }

    // 10. Monitoring module
    if (activeModules.has('monitoring')) {
      lines.push(`module "monitoring" {`);
      lines.push(`  source = "./modules/monitoring"`);
      lines.push(``);
      lines.push(`  environment  = var.environment`);
      lines.push(`  project_name = var.project_name`);
      lines.push(`}`);
      lines.push(``);
    }

    return {
      filename: 'main.tf',
      content: lines.join('\n'),
    };
  }

  /**
   * Generates root outputs.tf forwarding outputs from child modules
   */
  private static generateRootOutputsFile(
    ctx: ModuleContext,
    activeModules: Set<string>,
  ): TerraformFile {
    const lines: string[] = [
      hclOutput('architecture_name', hclString(ctx.architectureName), 'Architecture name'),
      hclOutput('aws_region', 'var.aws_region', 'AWS Region'),
    ];

    if (activeModules.has('networking')) {
      lines.push(hclOutput('vpc_id', 'module.networking.vpc_id', 'Primary VPC ID'));
      lines.push(hclOutput('public_subnet_ids', 'module.networking.public_subnet_ids', 'Public Subnet IDs'));
      lines.push(hclOutput('private_subnet_ids', 'module.networking.private_subnet_ids', 'Private Subnet IDs'));
    }

    if (activeModules.has('compute')) {
      lines.push(hclOutput('alb_dns_name', 'module.compute.alb_dns_name', 'ALB DNS Name'));
    }

    if (activeModules.has('database')) {
      lines.push(hclOutput('rds_endpoint', 'module.database.rds_endpoint', 'RDS Database Endpoint'));
      lines.push(hclOutput('dynamodb_tables', 'module.database.dynamodb_table_names', 'DynamoDB Tables'));
    }

    if (activeModules.has('storage')) {
      lines.push(hclOutput('s3_bucket_names', 'module.storage.bucket_names', 'S3 Bucket Names'));
    }

    if (activeModules.has('cdn')) {
      lines.push(hclOutput('cloudfront_domain_name', 'module.cdn.cloudfront_domain_name', 'CloudFront Domain'));
    }

    if (activeModules.has('ai-agent')) {
      lines.push(hclOutput('bedrock_agent_id', 'module.ai_agent.bedrock_agent_id', 'Bedrock Agent ID'));
    }

    return {
      filename: 'outputs.tf',
      content: lines.join('\n'),
    };
  }

  private static generateReadmeFile(
    ctx: ModuleContext,
    activeModules: Set<string>,
  ): TerraformFile {
    const modulesList = Array.from(activeModules)
      .map((m) => `- \`modules/${m}/\` — ${m.charAt(0).toUpperCase() + m.slice(1)} resources`)
      .join('\n');

    return {
      filename: 'README.md',
      content: `# ${ctx.architectureName} — Modular Terraform Project

Generated by **CloudForge** Production-Grade Modular Terraform Generator.

## Architecture Modules

${modulesList || '- No child modules generated (empty architecture).'}

## Directory Layout

\`\`\`text
.
├── main.tf                 # Root orchestration calling child modules
├── provider.tf             # AWS provider configuration with default tags
├── versions.tf             # Terraform & provider version constraints
├── variables.tf            # Root input variables
├── outputs.tf              # Aggregated root outputs
├── terraform.tfvars.example# Example input variable values
├── .gitignore              # Ignores local state and sensitive credentials
├── README.md               # Project documentation
├── modules/                # Child modules (networking, compute, database, etc.)
└── environments/
    └── dev/
        ├── terraform.tfvars.example
        └── README.md
\`\`\`

## Getting Started

1. **Initialize Terraform:**
   \`\`\`bash
   terraform init
   \`\`\`

2. **Configure Variables:**
   \`\`\`bash
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars to supply required credentials
   \`\`\`

3. **Validate Code:**
   \`\`\`bash
   terraform fmt -check -recursive
   terraform validate
   \`\`\`

4. **Plan & Apply:**
   \`\`\`bash
   terraform plan
   terraform apply
   \`\`\`

## Security Best Practices

- Master passwords and sensitive credentials use \`sensitive = true\` and are excluded from outputs.
- Never commit \`terraform.tfvars\` or \`.tfstate\` files to version control.
`,
    };
  }
}
