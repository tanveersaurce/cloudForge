import { describe, expect, it } from 'vitest';
import { TerraformGenerator } from './terraform-generator.service.js';

interface TestNode {
  id: string;
  resourceType: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

interface TestEdge {
  id: string;
  source: string;
  target: string;
  relationshipType?: string;
  direction?: string;
  metadata?: Record<string, unknown>;
}

function hclContains(content: string, snippet: string): boolean {
  return content.includes(snippet);
}

describe('Terraform Generator', () => {
  describe('VPC → Subnet → EC2 references', () => {
    it('generates correct references for VPC, Subnet, and EC2 chain', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'Main VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 's1', resourceType: 'aws_subnet', label: 'App Subnet', metadata: { cidr_block: '10.0.1.0/24', availability_zone: 'us-east-1a' } },
        { id: 'i1', resourceType: 'aws_instance', label: 'App Server', metadata: { instance_type: 't3.micro', ami: 'ami-0c55b159cbfafe1f0', root_volume_size: 20 } },
      ];
      const edges: TestEdge[] = [
        { id: 'e1', source: 'v1', target: 's1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e2', source: 's1', target: 'i1', relationshipType: 'contains', direction: 'source-to-target' },
      ];

      const { files, issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);

      const allContent = files.map((f) => f.content).join('\n');

      // VPC resource exists
      expect(hclContains(allContent, 'resource "aws_vpc"')).toBe(true);
      // Subnet references VPC
      expect(hclContains(allContent, 'vpc_id = aws_vpc.')).toBe(true);
      // EC2 references Subnet
      expect(hclContains(allContent, 'subnet_id = aws_subnet.')).toBe(true);
      // No errors for this valid chain
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('Security Group → EC2 references', () => {
    it('generates correct security group reference on EC2 via accesses edge', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'Main VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 's1', resourceType: 'aws_subnet', label: 'App Subnet', metadata: { cidr_block: '10.0.1.0/24', availability_zone: 'us-east-1a' } },
        { id: 'sg1', resourceType: 'aws_security_group', label: 'Web SG', metadata: { ingress_rules: [{ cidr_blocks: ['0.0.0.0/0'], from_port: 80, to_port: 80, protocol: 'tcp' }] } },
        { id: 'i1', resourceType: 'aws_instance', label: 'App Server', metadata: { instance_type: 't3.micro', ami: 'ami-0c55b159cbfafe1f0', root_volume_size: 20 } },
      ];
      const edges: TestEdge[] = [
        { id: 'e1', source: 'v1', target: 's1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e2', source: 'v1', target: 'sg1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e3', source: 's1', target: 'i1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e4', source: 'sg1', target: 'i1', relationshipType: 'accesses', direction: 'source-to-target' },
      ];

      const { files, issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);

      const allContent = files.map((f) => f.content).join('\n');

      // Security group references VPC
      expect(hclContains(allContent, 'vpc_id = aws_vpc.')).toBe(true);
      // EC2 references security group
      expect(hclContains(allContent, 'vpc_security_group_ids = [aws_security_group.')).toBe(true);
      // No errors
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('ALB with multiple subnets and security groups', () => {
    it('generates ALB with multiple subnet and security group references', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'Main VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 's1', resourceType: 'aws_subnet', label: 'Subnet 1', metadata: { cidr_block: '10.0.1.0/24', availability_zone: 'us-east-1a' } },
        { id: 's2', resourceType: 'aws_subnet', label: 'Subnet 2', metadata: { cidr_block: '10.0.2.0/24', availability_zone: 'us-east-1b' } },
        { id: 'sg1', resourceType: 'aws_security_group', label: 'ALB SG', metadata: { ingress_rules: [{ cidr_blocks: ['0.0.0.0/0'], from_port: 80, to_port: 80, protocol: 'tcp' }] } },
        { id: 'lb1', resourceType: 'aws_lb', label: 'Main ALB', metadata: { load_balancer_type: 'application', internal: false } },
      ];
      const edges: TestEdge[] = [
        { id: 'e1', source: 'v1', target: 's1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e2', source: 'v1', target: 's2', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e3', source: 'v1', target: 'sg1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e4', source: 's1', target: 'lb1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e5', source: 's2', target: 'lb1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e6', source: 'sg1', target: 'lb1', relationshipType: 'accesses', direction: 'source-to-target' },
      ];

      const { files, issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);

      const allContent = files.map((f) => f.content).join('\n');

      // ALB resource exists
      expect(hclContains(allContent, 'resource "aws_lb"')).toBe(true);
      // Multiple subnets referenced
      const subnetRefs = (allContent.match(/aws_subnet\.[a-z0-9_]+\.id/g) || []);
      expect(subnetRefs.length).toBeGreaterThanOrEqual(2);
      // Security group referenced
      expect(hclContains(allContent, 'security_groups = [aws_security_group.')).toBe(true);
      // No errors
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('Lambda with generated IAM Role', () => {
    it('generates Lambda with correct IAM role ARN reference', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'Main VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 'role1', resourceType: 'aws_iam_role', label: 'Lambda Exec Role', metadata: { name: 'lambda-exec-role', assume_role_policy: JSON.stringify({ Version: '2012-10-17', Statement: [{ Effect: 'Allow', Principal: { Service: 'lambda.amazonaws.com' }, Action: 'sts:AssumeRole' }] }) } },
        { id: 'fn1', resourceType: 'aws_lambda_function', label: 'Process Function', metadata: { function_name: 'process-fn', runtime: 'nodejs20.x', handler: 'index.handler', memory_size: 128, timeout: 30 } },
      ];
      const edges: TestEdge[] = [
        { id: 'e1', source: 'fn1', target: 'role1', relationshipType: 'accesses', direction: 'source-to-target' },
      ];

      const { files, issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);

      const allContent = files.map((f) => f.content).join('\n');

      // Lambda resource exists
      expect(hclContains(allContent, 'resource "aws_lambda_function"')).toBe(true);
      // IAM role resource exists
      expect(hclContains(allContent, 'resource "aws_iam_role"')).toBe(true);
      // Lambda references IAM role ARN
      expect(hclContains(allContent, 'role = aws_iam_role.')).toBe(true);
      expect(hclContains(allContent, '.arn')).toBe(true);
      // No errors (warnings about missing AMI are OK)
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('Duplicate resource labels', () => {
    it('generates unique Terraform resource names for duplicate labels', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'Production VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 'v2', resourceType: 'aws_vpc', label: 'Production VPC', metadata: { cidr_block: '10.0.0.0/16' } },
      ];
      const edges: TestEdge[] = [];

      const { files } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);

      const allContent = files.map((f) => f.content).join('\n');

      // Both VPCs should generate distinct resource blocks
      const vpcBlockCount = (allContent.match(/resource "aws_vpc" /g) || []).length;
      expect(vpcBlockCount).toBe(2);
    });
  });

  describe('Missing and ambiguous relationships', () => {
    it('reports error when Subnet has no VPC', () => {
      const nodes: TestNode[] = [
        { id: 's1', resourceType: 'aws_subnet', label: 'Orphan Subnet', metadata: { cidr_block: '10.0.1.0/24' } },
      ];
      const edges: TestEdge[] = [];

      const { issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);

      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].missing).toContain('VPC');
    });

    it('reports error when EC2 has no Subnet', () => {
      const nodes: TestNode[] = [
        { id: 'i1', resourceType: 'aws_instance', label: 'Orphan EC2', metadata: { instance_type: 't3.micro', ami: 'ami-0c55b159cbfafe1f0' } },
      ];
      const edges: TestEdge[] = [];

      const { issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);

      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].missing).toContain('Subnet');
    });

    it('reports error when Security Group has no VPC', () => {
      const nodes: TestNode[] = [
        { id: 'sg1', resourceType: 'aws_security_group', label: 'Orphan SG', metadata: {} },
      ];
      const edges: TestEdge[] = [];

      const { issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);

      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].missing).toContain('VPC');
    });
  });

  describe('Unsupported resources', () => {
    it('includes unsupported resource type without crashing', () => {
      const nodes: TestNode[] = [
        { id: 'r1', resourceType: 'aws_redshift_cluster', label: 'Redshift', metadata: {} },
      ];
      const edges: TestEdge[] = [];

      const { files, issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);

      // Should not crash, should generate files (even if just provider/variables)
      expect(files.length).toBeGreaterThan(0);
      // Should report that resource type has no HCL generator
      const allContent = files.map((f) => f.content).join('\n');
      expect(allContent).not.toContain('aws_redshift_cluster');
    });
  });

  describe('Circular dependencies', () => {
    it('handles circular contains edges without infinite loop', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 's1', resourceType: 'aws_subnet', label: 'Subnet', metadata: { cidr_block: '10.0.1.0/24' } },
      ];
      const edges: TestEdge[] = [
        { id: 'e1', source: 'v1', target: 's1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e2', source: 's1', target: 'v1', relationshipType: 'contains', direction: 'source-to-target' }, // circular
      ];

      const { files } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);
      expect(files.length).toBeGreaterThan(0);
    });
  });

  describe('Multiple architectures with different regions', () => {
    it('uses correct region in provider and variables', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'VPC', metadata: { cidr_block: '10.0.0.0/16' } },
      ];
      const edges: TestEdge[] = [];

      const { files } = TerraformGenerator.generate('Test Arch', 'eu-west-1', nodes, edges);

      const providerContent = files.find((f) => f.filename === 'provider.tf')?.content || '';
      const variablesContent = files.find((f) => f.filename === 'variables.tf')?.content || '';

      expect(providerContent).toContain('region = var.aws_region');
      expect(variablesContent).toContain('default = "eu-west-1"');
    });
  });

  describe('HCL expression handling', () => {
    it('EC2 AMI variable is not quoted (Terraform expression)', () => {
      const nodes: TestNode[] = [
        { id: 'i1', resourceType: 'aws_instance', label: 'Server', metadata: { instance_type: 't3.micro', root_volume_size: 20 } },
      ];
      const edges: TestEdge[] = [];

      const { files } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);
      const allContent = files.map((f) => f.content).join('\n');

      // AMI should be a bare reference, not quoted
      expect(allContent).toContain('ami = var.ec2_ami');
      expect(allContent).not.toContain('ami = "var.ec2_ami"');
    });

    it('ordinary strings remain quoted', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'My VPC', metadata: { cidr_block: '10.0.0.0/16' } },
      ];
      const edges: TestEdge[] = [];

      const { files } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);
      const allContent = files.map((f) => f.content).join('\n');

      // Tags Name should be quoted string
      expect(allContent).toContain('tags = {');
      expect(allContent).toContain('Name = "My VPC"');
    });

    it('VPC reference ends in .id', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'Main VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 's1', resourceType: 'aws_subnet', label: 'Subnet', metadata: { cidr_block: '10.0.1.0/24', availability_zone: 'us-east-1a' } },
      ];
      const edges: TestEdge[] = [
        { id: 'e1', source: 'v1', target: 's1', relationshipType: 'contains', direction: 'source-to-target' },
      ];

      const { files } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);
      const allContent = files.map((f) => f.content).join('\n');

      expect(allContent).toMatch(/aws_vpc\.[a-z0-9_]+\.id/);
    });

    it('NAT subnet reference ends in .id', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 's1', resourceType: 'aws_subnet', label: 'Public Subnet', metadata: { cidr_block: '10.0.1.0/24', availability_zone: 'us-east-1a' } },
        { id: 'ngw1', resourceType: 'aws_nat_gateway', label: 'NAT GW', metadata: {} },
      ];
      const edges: TestEdge[] = [
        { id: 'e1', source: 'v1', target: 's1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e2', source: 's1', target: 'ngw1', relationshipType: 'contains', direction: 'source-to-target' },
      ];

      const { files } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);
      const allContent = files.map((f) => f.content).join('\n');

      expect(allContent).toMatch(/aws_subnet\.[a-z0-9_]+\.id/);
    });

    it('reverse-direction edges are rejected (SG contains VPC instead of VPC contains SG)', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 'sg1', resourceType: 'aws_security_group', label: 'SG', metadata: {} },
      ];
      // Reverse: SG contains VPC (invalid)
      const edges: TestEdge[] = [
        { id: 'e1', source: 'sg1', target: 'v1', relationshipType: 'contains', direction: 'source-to-target' },
      ];

      const { issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('ambiguous relationships are reported', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'VPC 1', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 'v2', resourceType: 'aws_vpc', label: 'VPC 2', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 's1', resourceType: 'aws_subnet', label: 'Subnet', metadata: { cidr_block: '10.0.1.0/24', availability_zone: 'us-east-1a' } },
      ];
      // Subnet contained by both VPCs
      const edges: TestEdge[] = [
        { id: 'e1', source: 'v1', target: 's1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e2', source: 'v2', target: 's1', relationshipType: 'contains', direction: 'source-to-target' },
      ];

      const { issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.missing.toLowerCase().includes('ambiguous'))).toBe(true);
    });

    it('unsupported resource types produce issues', () => {
      const nodes: TestNode[] = [
        { id: 'r1', resourceType: 'aws_redshift_cluster', label: 'Redshift', metadata: {} },
      ];
      const edges: TestEdge[] = [];

      const { issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].missing).toContain('Unsupported resource type');
    });

    it('circular dependencies are detected without infinite loop', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 's1', resourceType: 'aws_subnet', label: 'Subnet', metadata: { cidr_block: '10.0.1.0/24' } },
      ];
      const edges: TestEdge[] = [
        { id: 'e1', source: 'v1', target: 's1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e2', source: 's1', target: 'v1', relationshipType: 'contains', direction: 'source-to-target' },
      ];

      const { files, issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);
      expect(files.length).toBeGreaterThan(0);
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.some((e) => e.missing.toLowerCase().includes('circular'))).toBe(true);
    });
  });
});
