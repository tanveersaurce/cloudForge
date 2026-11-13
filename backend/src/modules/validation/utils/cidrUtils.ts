export interface ParsedCidr {
  ipNumber: number;
  maskNumber: number;
  prefix: number;
  broadcastNumber: number;
}

export function parseCidr(cidr: string): ParsedCidr | null {
  if (typeof cidr !== 'string') return null;
  const parts = cidr.trim().split('/');
  if (parts.length !== 2) return null;

  const ipStr = parts[0];
  const prefixStr = parts[1];
  const prefix = parseInt(prefixStr, 10);

  if (isNaN(prefix) || prefix < 0 || prefix > 32) return null;

  const octets = ipStr.split('.');
  if (octets.length !== 4) return null;

  let ipNumber = 0;
  for (let i = 0; i < 4; i++) {
    const octet = parseInt(octets[i], 10);
    if (isNaN(octet) || octet < 0 || octet > 255) return null;
    ipNumber = (ipNumber << 8) | octet;
  }
  // Convert to unsigned 32-bit integer
  ipNumber = ipNumber >>> 0;

  const maskNumber = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const networkNumber = (ipNumber & maskNumber) >>> 0;
  const broadcastNumber = (networkNumber | ~maskNumber) >>> 0;

  return {
    ipNumber: networkNumber,
    maskNumber,
    prefix,
    broadcastNumber,
  };
}

export function isCidrContained(parentCidrStr: string, childCidrStr: string): boolean {
  const parent = parseCidr(parentCidrStr);
  const child = parseCidr(childCidrStr);
  if (!parent || !child) return false;

  // Child prefix must be greater than or equal to parent prefix (smaller or equal address space)
  if (child.prefix < parent.prefix) return false;

  // Child network must be >= parent network and child broadcast <= parent broadcast
  return (
    child.ipNumber >= parent.ipNumber &&
    child.broadcastNumber <= parent.broadcastNumber
  );
}

export function doCidrsOverlap(cidrStr1: string, cidrStr2: string): boolean {
  const c1 = parseCidr(cidrStr1);
  const c2 = parseCidr(cidrStr2);
  if (!c1 || !c2) return false;

  return (
    (c1.ipNumber <= c2.broadcastNumber && c1.broadcastNumber >= c2.ipNumber)
  );
}
