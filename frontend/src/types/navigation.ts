export type NavItemId =
  | 'dashboard'
  | 'builder'
  | 'aws-services'
  | 'architectures'
  | 'cost-explorer'
  | 'terraform'
  | 'deployments'
  | 'settings';

export interface NavItemConfig {
  id: NavItemId;
  label: string;
  path: string;
  phaseLabel?: string;
  description: string;
  plannedCapabilities?: string[];
}
