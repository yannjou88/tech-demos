export const POOL_W = 7.2;
export const POOL_D = 5.4;
export const POOL_DEPTH = 1.22;
export const MAX_FLOWERS = 28;
export const MAX_IMPULSES = 8;

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0 || 1)));
  return t * t * (3 - 2 * t);
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function insidePool(x: number, z: number, margin = 0.2): boolean {
  return Math.abs(x) <= POOL_W / 2 - margin && Math.abs(z) <= POOL_D / 2 - margin;
}

export function worldToUv(x: number, z: number): { u: number; v: number } {
  return { u: x / POOL_W + 0.5, v: z / POOL_D + 0.5 };
}
