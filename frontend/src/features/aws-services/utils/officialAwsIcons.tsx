import type { SVGProps } from 'react';

export type AwsIconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
};

// -------------------------------------------------------------
// Official AWS Architecture Service SVGs
// Standard AWS colors:
// Compute: #ED7100
// Storage: #3F8624
// Database: #2E73B8
// Networking: #8C4FFF
// Security: #DD344C
// Management: #E05243
// Integration: #E7157B
// -------------------------------------------------------------

export function AwsLogoIcon({ size = 24, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#232F3E" />
      <path
        d="M21.2 36.8c-.8 0-1.5-.2-2-.6-.5-.4-.8-1-.8-1.7 0-.7.3-1.3.8-1.7.5-.4 1.3-.7 2.3-.7.9 0 1.6.2 2.3.5v1.2c-.6-.4-1.3-.6-2-.6-.7 0-1.2.2-1.5.5-.3.3-.4.7-.4 1.1 0 .4.1.8.4 1.1.3.3.8.4 1.5.4.8 0 1.6-.2 2.3-.7v1.4c-.8.7-1.7 1.1-2.9 1.1zm8.3-.2l-2.4-8.8h1.8l1.6 6.7 1.5-6.7h1.7l1.5 6.7 1.6-6.7h1.8l-2.4 8.8h-1.8l-1.6-6.6-1.6 6.6h-1.7zm11.7.2c-.9 0-1.7-.2-2.3-.6-.6-.4-.9-1-.9-1.8 0-.8.3-1.4.9-1.8.6-.4 1.4-.7 2.4-.7 1 0 1.8.2 2.5.6v1.3c-.7-.5-1.5-.7-2.3-.7-.7 0-1.3.2-1.6.5-.3.3-.5.7-.5 1.1 0 .4.2.8.5 1.1.3.3.9.5 1.6.5.9 0 1.7-.3 2.4-.8v1.4c-.8.6-1.7.9-2.7.9z"
        fill="#FFFFFF"
      />
      <path
        d="M17 43c9.5 4.8 20.8 4.2 30-.8-.3-.4-.7-.9-1.2-1.2-8.3 4.3-18.4 4.7-27 .6-.6.4-1.2.9-1.8 1.4z"
        fill="#FF9900"
      />
      <path
        d="M48.2 41c-.4.5-.9 1.1-1.4 1.6 1.4.5 3 1 4.2 1.3-.2-1.3-.8-2.6-1.8-3.6-.3.2-.7.5-1 .7z"
        fill="#FF9900"
      />
    </svg>
  );
}

// Compute: Amazon EC2
export function Ec2Icon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#ED7100" />
      {/* Microchip pins */}
      <path d="M12 24h4m-4 8h4m-4 8h4M48 24h4m-4 8h4m-4 8h4M24 12v4m8-4v4m8-4v4M24 48v4m8-4v4m8-4v4" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      {/* Outer Chip */}
      <rect x="16" y="16" width="32" height="32" rx="4" stroke="#FFFFFF" strokeWidth="2.5" />
      {/* Layered server cards */}
      <rect x="22" y="22" width="20" height="20" rx="2" fill="#FFFFFF" fillOpacity="0.25" stroke="#FFFFFF" strokeWidth="2" />
      <path d="M26 27h12M26 32h12M26 37h8" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Storage: Amazon S3
export function S3Icon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#3F8624" />
      {/* Bucket body */}
      <path
        d="M17 26l3.5 22.5c.3 2 2 3.5 4 3.5h15c2 0 3.7-1.5 4-3.5L47 26H17z"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Bucket rim */}
      <ellipse cx="32" cy="25" rx="15" ry="5.5" stroke="#FFFFFF" strokeWidth="2.5" />
      {/* Bucket handle */}
      <path
        d="M20 23c2-7 22-7 24 0"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Storage layers inside bucket */}
      <path d="M24 35c3.5 1.8 12.5 1.8 16 0" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      <path d="M26 42c2.5 1.5 9.5 1.5 12 0" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Database: Amazon RDS
export function RdsIcon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#2E73B8" />
      {/* Database Cylinder */}
      <ellipse cx="32" cy="22" rx="14" ry="5" stroke="#FFFFFF" strokeWidth="2.5" />
      <path
        d="M18 22v20c0 2.8 6.3 5 14 5s14-2.2 14-5V22"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Mid cylinder tier */}
      <path
        d="M18 32c0 2.8 6.3 5 14 5s14-2.2 14-5"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Replication / directional arrows */}
      <path d="M24 25l-4-4 4-4M40 39l4 4-4 4" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Database: Amazon Aurora
export function AuroraIcon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#2E73B8" />
      <ellipse cx="32" cy="20" rx="13" ry="5" stroke="#FFFFFF" strokeWidth="2.5" />
      <path d="M19 20v22c0 2.8 5.8 5 13 5s13-2.2 13-5V20" stroke="#FFFFFF" strokeWidth="2.5" />
      <path d="M19 31c0 2.8 5.8 5 13 5s13-2.2 13-5" stroke="#FFFFFF" strokeWidth="2.5" />
      {/* High-speed aurora lightning rays */}
      <path d="M33 13l-4 9h6l-5 11" stroke="#FFD700" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Networking: Elastic Load Balancing / ALB
export function AlbIcon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#8C4FFF" />
      {/* Ingress Parent Node */}
      <circle cx="32" cy="20" r="4.5" stroke="#FFFFFF" strokeWidth="2.5" />
      {/* Downward balanced fanout branches */}
      <path d="M32 25v7M32 32L21 41M32 32l11 9M32 32v10" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      {/* Target Balance Nodes */}
      <circle cx="20" cy="44" r="4" stroke="#FFFFFF" strokeWidth="2.5" />
      <circle cx="32" cy="44" r="4" stroke="#FFFFFF" strokeWidth="2.5" />
      <circle cx="44" cy="44" r="4" stroke="#FFFFFF" strokeWidth="2.5" />
    </svg>
  );
}

// Serverless: AWS Lambda
export function LambdaIcon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#ED7100" />
      {/* Greek Lambda λ symbol */}
      <path
        d="M21 46l8-18m3-7l11 25m-14-18l6 18"
        stroke="#FFFFFF"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="18" r="2.5" fill="#FFFFFF" />
    </svg>
  );
}

// Database: Amazon DynamoDB
export function DynamoDbIcon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#2E73B8" />
      {/* Segmented DB slices */}
      <ellipse cx="32" cy="21" rx="14" ry="4.5" stroke="#FFFFFF" strokeWidth="2.5" />
      <path d="M18 21v8c0 2.5 6.3 4.5 14 4.5s14-2 14-4.5v-8" stroke="#FFFFFF" strokeWidth="2.5" />
      <path d="M18 29v8c0 2.5 6.3 4.5 14 4.5s14-2 14-4.5v-8" stroke="#FFFFFF" strokeWidth="2.5" />
      <path d="M18 37v7c0 2.5 6.3 4.5 14 4.5s14-2 14-4.5v-7" stroke="#FFFFFF" strokeWidth="2.5" />
      {/* Lightning Bolt */}
      <path
        d="M36 15l-9 14h7l-4 14 11-16h-7l2-12z"
        fill="#FFD700"
        stroke="#2E73B8"
        strokeWidth="1.5"
      />
    </svg>
  );
}

// Networking: Amazon CloudFront
export function CloudFrontIcon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#8C4FFF" />
      {/* Globe Circle */}
      <circle cx="32" cy="32" r="14" stroke="#FFFFFF" strokeWidth="2.5" />
      {/* Lat/Long curves */}
      <ellipse cx="32" cy="32" rx="7" ry="14" stroke="#FFFFFF" strokeWidth="2" />
      <path d="M18 32h28M21 24h22M21 40h22" stroke="#FFFFFF" strokeWidth="2" />
      {/* Edge Points of Presence */}
      <circle cx="16" cy="18" r="3" fill="#FFFFFF" />
      <circle cx="48" cy="18" r="3" fill="#FFFFFF" />
      <circle cx="48" cy="46" r="3" fill="#FFFFFF" />
      <circle cx="16" cy="46" r="3" fill="#FFFFFF" />
    </svg>
  );
}

// Networking: Amazon Route 53
export function Route53Icon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#8C4FFF" />
      {/* Shield Boundary */}
      <path
        d="M32 14l16 5v12c0 11-8 19-16 22-8-3-16-11-16-22V19l16-5z"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* '53' Label */}
      <text
        x="32"
        y="38"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="16"
        fontWeight="bold"
        fontFamily="sans-serif"
      >
        53
      </text>
    </svg>
  );
}

// Networking: Amazon VPC
export function VpcIcon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#8C4FFF" />
      {/* Cloud outline */}
      <path
        d="M23 43h19c4.4 0 8-3.6 8-8 0-4-3-7.3-7-7.9-.5-5.6-5.2-10.1-11-10.1-5.1 0-9.4 3.4-10.7 8.1-1-.4-2.1-.6-3.3-.6-4.4 0-8 3.6-8 8 0 4.2 3.2 7.7 7.4 8z"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Enclosed network lock/switch */}
      <circle cx="32" cy="33" r="3.5" fill="#FFFFFF" />
      <path d="M25 33h4m6 0h4" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Networking: Internet Gateway
export function InternetGatewayIcon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#8C4FFF" />
      {/* Gateway Arch */}
      <path
        d="M20 46V28a12 12 0 0124 0v18"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Ingress / Egress arrows */}
      <path d="M15 37h12m-4-4l4 4-4 4" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M49 37H37m4-4l-4 4 4 4" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Networking: NAT Gateway
export function NatGatewayIcon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#8C4FFF" />
      {/* Dual translation circle */}
      <circle cx="32" cy="32" r="14" stroke="#FFFFFF" strokeWidth="2.5" />
      {/* One-way egress translation arrow */}
      <path
        d="M24 32h16m-5-5l5 5-5 5"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="32" r="2.5" fill="#FFFFFF" />
    </svg>
  );
}

// Networking: Subnet
export function SubnetIcon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#8C4FFF" />
      <rect x="18" y="18" width="28" height="28" rx="4" stroke="#FFFFFF" strokeWidth="2.5" strokeDasharray="3 3" />
      <circle cx="25" cy="25" r="3" fill="#FFFFFF" />
      <circle cx="39" cy="25" r="3" fill="#FFFFFF" />
      <circle cx="25" cy="39" r="3" fill="#FFFFFF" />
      <circle cx="39" cy="39" r="3" fill="#FFFFFF" />
      <path d="M25 25h14v14H25z" stroke="#FFFFFF" strokeWidth="1.5" />
    </svg>
  );
}

// Security: AWS IAM
export function IamIcon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#DD344C" />
      {/* User silhouette */}
      <circle cx="32" cy="24" r="6" stroke="#FFFFFF" strokeWidth="2.5" />
      <path d="M20 44c0-6.6 5.4-12 12-12s12 5.4 12 12" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      {/* Security badge keyhole */}
      <rect x="36" y="32" width="12" height="15" rx="3" fill="#DD344C" stroke="#FFFFFF" strokeWidth="2" />
      <circle cx="42" cy="38" r="1.5" fill="#FFFFFF" />
      <path d="M42 39.5v3" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Security: AWS KMS
export function KmsIcon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#DD344C" />
      {/* Key Bow */}
      <circle cx="26" cy="32" r="8" stroke="#FFFFFF" strokeWidth="2.5" />
      <circle cx="26" cy="32" r="3.5" stroke="#FFFFFF" strokeWidth="2" />
      {/* Key Shaft & Teeth */}
      <path d="M34 32h14m-5 0v5m4-5v3" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// Security: AWS Secrets Manager
export function SecretsManagerIcon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#DD344C" />
      {/* Safe Box / Padlock */}
      <rect x="20" y="27" width="24" height="20" rx="3" stroke="#FFFFFF" strokeWidth="2.5" />
      <path d="M26 27v-6a6 6 0 0112 0v6" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      {/* Combination dial */}
      <circle cx="32" cy="37" r="3.5" stroke="#FFFFFF" strokeWidth="2" />
      <path d="M32 37l2 2" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Security: AWS Certificate Manager (ACM)
export function AcmIcon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#DD344C" />
      {/* Certificate parchment */}
      <rect x="18" y="16" width="28" height="32" rx="3" stroke="#FFFFFF" strokeWidth="2.5" />
      <path d="M24 23h16M24 29h16M24 35h10" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      {/* Star award */}
      <circle cx="37" cy="37" r="4.5" fill="#FFD700" stroke="#FFFFFF" strokeWidth="1.5" />
    </svg>
  );
}

// Containers: Amazon ECS
export function EcsIcon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#ED7100" />
      {/* Clustered container blocks */}
      <rect x="18" y="18" width="12" height="12" rx="2" stroke="#FFFFFF" strokeWidth="2" />
      <rect x="34" y="18" width="12" height="12" rx="2" stroke="#FFFFFF" strokeWidth="2" />
      <rect x="18" y="34" width="12" height="12" rx="2" stroke="#FFFFFF" strokeWidth="2" />
      <rect x="34" y="34" width="12" height="12" rx="2" stroke="#FFFFFF" strokeWidth="2" />
      {/* Center cluster connector */}
      <circle cx="32" cy="32" r="3" fill="#FFFFFF" />
      <path d="M30 30L25 25M34 30L39 25M30 34L25 39M34 34L39 39" stroke="#FFFFFF" strokeWidth="1.5" />
    </svg>
  );
}

// Containers: Amazon EKS
export function EksIcon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#ED7100" />
      {/* Kubernetes Ship Wheel */}
      <circle cx="32" cy="32" r="10" stroke="#FFFFFF" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="4" fill="#FFFFFF" />
      {/* 6 Spokes */}
      <path d="M32 16v6M32 42v6M18 24l5 3M41 37l5 3M18 40l5-3M41 27l5-3" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// Containers: Amazon ECR
export function EcrIcon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#ED7100" />
      <path d="M32 17l14 8v14l-14 8-14-8V25l14-8z" stroke="#FFFFFF" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M18 25l14 8 14-8M32 33v16" stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// Management & Governance: Amazon CloudWatch
export function CloudWatchIcon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#E05243" />
      {/* Telemetry Eye / Target */}
      <circle cx="32" cy="32" r="14" stroke="#FFFFFF" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="8" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="3 2" />
      <circle cx="32" cy="32" r="3" fill="#FFFFFF" />
      {/* Telemetry line graph */}
      <path d="M22 34l6-5 4 4 8-7" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Application Integration: Amazon API Gateway
export function ApiGatewayIcon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#E7157B" />
      {/* Doorway / Portal */}
      <rect x="20" y="17" width="24" height="30" rx="3" stroke="#FFFFFF" strokeWidth="2.5" />
      <path d="M26 33l-3-3 3-3M38 27l3 3-3 3M34 25l-4 14" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Storage: Amazon EBS
export function EbsIcon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#3F8624" />
      <rect x="18" y="20" width="28" height="24" rx="4" stroke="#FFFFFF" strokeWidth="2.5" />
      <circle cx="25" cy="32" r="2.5" fill="#FFFFFF" />
      <path d="M33 28h8M33 36h8" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Security: Security Group (Firewall)
export function SecurityGroupIcon({ size = 40, className, ...props }: AwsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="8" fill="#DD344C" />
      <path
        d="M32 15l15 5v12c0 10-7 18-15 21-8-3-15-11-15-21V20l15-5z"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Padlock */}
      <rect x="27" y="32" width="10" height="8" rx="2" fill="#FFFFFF" />
      <path d="M29 32v-3a3 3 0 016 0v3" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
