import { env } from '../config/env.js';

export interface SystemMetadata {
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
}

export function getSystemMetadata(): SystemMetadata {
  return {
    service: 'cloudforge-api',
    version: '0.1.0',
    environment: env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
  };
}
