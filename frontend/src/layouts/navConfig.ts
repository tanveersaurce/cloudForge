import type { NavItemConfig } from '@/types/navigation';

export const SIDEBAR_NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/',
    description: 'Workspace overview, health status, sample architectures, and starter blueprints.',
  },
  {
    id: 'builder',
    label: 'Architecture Builder',
    path: '/builder',
    description: 'Visual drag-and-drop AWS topology canvas powered by React Flow (@xyflow/react).',
    plannedCapabilities: [
      'Drag-and-drop AWS service palette organized by category',
      'VPC, Subnet, and Availability Zone visual container grouping',
      'Interactive node property inspector with schema validation',
      'Auto-save canvas layout and connections to PostgreSQL',
    ],
  },
  {
    id: 'aws-services',
    label: 'AWS Services',
    path: '/services',
    description: 'Curated catalog of AWS services, architectural use cases, and configuration defaults.',
    plannedCapabilities: [
      'Browse Compute, Networking, Storage, Database, Serverless, and Security services',
      'Inspect recommended IAM boundaries and service limits',
      'Add services directly into new or existing architectures',
    ],
  },
  {
    id: 'architectures',
    label: 'My Architectures',
    path: '/architectures',
    description: 'Manage saved cloud architectures, revisions, and regional topologies.',
    plannedCapabilities: [
      'PostgreSQL-backed CRUD for workspace architecture projects',
      'Version snapshots and architectural diffing',
      'Clone starter blueprints into team workspaces',
    ],
  },
  {
    id: 'cost-explorer',
    label: 'Cost Explorer',
    path: '/cost-explorer',
    phaseLabel: 'Phase 04',
    description: 'Real-time monthly AWS infrastructure cost estimation and resource breakdown.',
    plannedCapabilities: [
      'Per-service monthly cost projection based on sizing & region',
      'Compare cost impacts across instance types and scaling tiers',
      'Export itemized cost summaries alongside architecture specs',
    ],
  },
  {
    id: 'terraform',
    label: 'Terraform',
    path: '/terraform',
    phaseLabel: 'Phase 05',
    description: 'Deterministic HCL generation, syntax preview, and downloadable Terraform projects.',
    plannedCapabilities: [
      'Compile visual AWS graphs into modular main.tf, variables.tf, and outputs.tf',
      'Inspect generated HCL per resource node',
      'Export complete Terraform project archives (.zip)',
    ],
  },
  {
    id: 'deployments',
    label: 'Deployments',
    path: '/deployments',
    phaseLabel: 'Phase 06',
    description: 'Approval-gated Terraform plan previews and AWS deployment audit history.',
    plannedCapabilities: [
      'Run dry-run Terraform plan previews before touching cloud resources',
      'Explicit human approval gate prior to apply or destroy actions',
      'Immutable deployment logs and state tracking',
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
    phaseLabel: 'Phase 02+',
    description: 'Workspace preferences, default AWS regions, and optional AWS account connections.',
    plannedCapabilities: [
      'Configure default target AWS region and tagging conventions',
      'Manage optional scoped AWS IAM role connections (Phase 06)',
      'Inspect API and database diagnostics',
    ],
  },
];
