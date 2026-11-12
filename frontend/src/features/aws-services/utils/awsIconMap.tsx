import {
  Activity,
  Archive,
  BarChart3,
  Bell,
  Boxes,
  Brain,
  Briefcase,
  Cloud,
  Code2,
  Container,
  Cpu,
  Database,
  FileCode2,
  FolderKanban,
  GitBranch,
  Globe,
  HardDrive,
  KeyRound,
  Layers,
  Lock,
  Mail,
  Monitor,
  Network,
  Radio,
  Rocket,
  Route,
  Server,
  Settings2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Truck,
  Video,
  Waypoints,
  Webhook,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export interface AwsVisualSpec {
  icon: LucideIcon;
  badgeClassName: string;
}

const CATEGORY_THEMES: Record<string, string> = {
  compute: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  storage: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  networking: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
  database: 'border-indigo-500/25 bg-indigo-500/10 text-indigo-300',
  security: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
  containers: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300',
  serverless: 'border-orange-500/25 bg-orange-500/10 text-orange-300',
  integration: 'border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-300',
  management: 'border-teal-500/25 bg-teal-500/10 text-teal-300',
  'developer-tools': 'border-violet-500/25 bg-violet-500/10 text-violet-300',
  analytics: 'border-blue-500/25 bg-blue-500/10 text-blue-300',
  'ml-ai': 'border-purple-500/25 bg-purple-500/10 text-purple-300',
  migration: 'border-lime-500/25 bg-lime-500/10 text-lime-300',
  iot: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300',
  media: 'border-pink-500/25 bg-pink-500/10 text-pink-300',
  business: 'border-slate-500/25 bg-slate-500/10 text-slate-300',
};

const ICON_MAP: Record<string, LucideIcon> = {
  // Categories
  compute: Cpu,
  storage: HardDrive,
  networking: Network,
  database: Database,
  security: Shield,
  containers: Boxes,
  serverless: Zap,
  integration: Workflow,
  management: Activity,
  'developer-tools': Code2,
  analytics: BarChart3,
  'ml-ai': Brain,
  migration: Truck,
  iot: Radio,
  media: Video,
  business: Briefcase,

  // Compute
  ec2: Server,
  'elastic-beanstalk': Layers,
  batch: FolderKanban,
  'app-runner': Rocket,
  lightsail: Cloud,

  // Containers
  ecs: Container,
  eks: Boxes,
  fargate: Layers,
  ecr: Archive,

  // Storage
  s3: HardDrive,
  ebs: Database,
  efs: FolderKanban,
  glacier: Archive,

  // Networking & Content Delivery
  vpc: Network,
  cloudfront: Globe,
  'route-53': Route,
  elb: Waypoints,
  'transit-gateway': GitBranch,
  'direct-connect': Waypoints,
  'nat-gateway': Network,

  // Database
  rds: Database,
  aurora: Database,
  dynamodb: Zap,
  elasticache: Cpu,
  redshift: BarChart3,
  documentdb: FileCode2,

  // Security, Identity & Compliance
  iam: KeyRound,
  kms: Lock,
  'secrets-manager': KeyRound,
  acm: ShieldCheck,
  waf: ShieldAlert,
  guardduty: ShieldAlert,
  shield: Shield,

  // Serverless & Application Integration
  lambda: Zap,
  appsync: Webhook,
  sqs: Layers,
  sns: Bell,
  eventbridge: Workflow,
  'step-functions': GitBranch,
  'api-gateway': Webhook,

  // Management & Governance
  cloudwatch: Activity,
  cloudtrail: FileCode2,
  config: Settings2,
  ssm: Terminal,

  // Developer Tools
  codebuild: Terminal,
  codepipeline: GitBranch,
  codedeploy: Rocket,

  // Analytics & ML/AI
  athena: BarChart3,
  glue: Workflow,
  kinesis: Activity,
  sagemaker: Brain,
  bedrock: Sparkles,

  // Migration, Transfer, IoT, Media, Business
  dms: Truck,
  transfer: Truck,
  mediaconvert: Video,
  ses: Mail,
  workspaces: Monitor,
};

const DEFAULT_THEME = 'border-sky-500/25 bg-sky-500/10 text-sky-300';

export function resolveAwsVisual(iconKey: string, categoryIconKey?: string): AwsVisualSpec {
  const icon = ICON_MAP[iconKey] ?? (categoryIconKey ? ICON_MAP[categoryIconKey] : undefined) ?? Cloud;
  const badgeClassName =
    CATEGORY_THEMES[categoryIconKey ?? iconKey] ?? CATEGORY_THEMES[iconKey] ?? DEFAULT_THEME;

  return { icon, badgeClassName };
}
