import type { AuthUser } from '@/features/auth/types/auth.types';

export interface DashboardArchitectureSummary {
  id: string;
  name: string;
  description: string | null;
  region: string;
  status: string;
  resourceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardQuickStartTemplate {
  id: string;
  title: string;
  category: 'Web & Compute' | 'Serverless' | 'Networking' | 'Storage & Edge';
  description: string;
  serviceCount: number;
  services: string[];
  complexity: 'Starter' | 'Standard' | 'Production';
  isStaticTemplate: true;
}

export interface DashboardActivityEntry {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  type: 'account' | 'architecture';
}

export interface DashboardOverviewData {
  user: AuthUser;
  metrics: {
    totalArchitectures: number;
    savedProjects: number;
    awsServicesExplored: {
      available: false;
      value: null;
      statusLabel: string;
    };
    estimatedMonthlyCost: {
      available: false;
      value: null;
      statusLabel: string;
    };
  };
  recentArchitectures: DashboardArchitectureSummary[];
  quickStartTemplates: DashboardQuickStartTemplate[];
  recentActivity: DashboardActivityEntry[];
}
