export type ArchitectureStatus = 'validated' | 'draft' | 'review';

export interface DashboardStat {
  id: string;
  label: string;
  value: string;
  sublabel: string;
  trendText: string;
  isMock?: boolean;
}

export interface ArchitectureSummary {
  id: string;
  name: string;
  description: string;
  region: string;
  resourceCount: number;
  estimatedMonthlyCost: number;
  status: ArchitectureStatus;
  updatedAt: string;
  services: string[];
  isSample: true;
}

export interface QuickStartTemplate {
  id: string;
  title: string;
  category: 'Web & Compute' | 'Serverless' | 'Networking' | 'Storage & Edge';
  description: string;
  estimatedMonthlyCost: number;
  serviceCount: number;
  services: string[];
  complexity: 'Starter' | 'Standard' | 'Production';
  isSample: true;
}

export type ActivityType = 'validation' | 'cost' | 'template' | 'system';

export interface WorkspaceActivityItem {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  type: ActivityType;
  isSample: true;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}
