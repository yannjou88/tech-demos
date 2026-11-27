import { POOL_D, POOL_W } from "./constants";

/** Low-resolution mirror of the GPU heightfield, used only to drift flowers. */
export class CpuWave {
  readonly size: number;
  private h: Float32Array;
  private v: Float32Array;
  private next: Float32Array;

  constructor(size = 48) {
    this.size = size;
    const n = size * size;
    this.h = new Float32Array(n);
    this.v = new Float32Array(n);
    this.next = new Float32Array(n);
  }

  clear(): void {
    this.h.fill(0);
    this.v.fill(0);
    this.next.fill(0);
  }

  /** Gaussian dent or bump. Radius is in meters. */
  impulse(x: number, z: number, amplitude: number, radius: number): void {
    const n = this.size;
    const rad = Math.max(radius, 0.04);
    const reach = rad * 3;
    for (let iy = 1; iy < n - 1; iy++) {
      const wz = ((iy + 0.5) / n - 0.5) * POOL_D;
      if (Math.abs(wz - z) > reach) continue;
      for (let ix = 1; ix < n - 1; ix++) {
        const wx = ((ix + 0.5) / n - 0.5) * POOL_W;
        const dx = wx - x;
        const dz = wz - z;
        if (Math.abs(dx) > reach) continue;
        const d2 = dx * dx + dz * dz;
        this.h[iy * n + ix]! += amplitude * Math.exp(-d2 / (rad * rad));
      }
    }
  }

  step(): void {
    const n = this.size;
    const h = this.h;
    const v = this.v;
    const next = this.next;
    for (let y = 1; y < n - 1; y++) {
      for (let x = 1; x < n - 1; x++) {
        const i = y * n + x;
        const average = ((h[i - 1] ?? 0) + (h[i + 1] ?? 0) + (h[i - n] ?? 0) + (h[i + n] ?? 0)) * 0.25;
        let velocity = (v[i] ?? 0) + (average - (h[i] ?? 0)) * 2;
        velocity *= 0.984;
        let height = (h[i] ?? 0) + velocity;
        if (height > 0.22) height = 0.22;
        if (height < -0.22) height = -0.22;
        next[i] = height;
        v[i] = velocity;
      }
    }
    for (let i = 0; i < n; i++) {
      next[i] = 0;
      next[(n - 1) * n + i] = 0;
      next[i * n] = 0;
      next[i * n + n - 1] = 0;
      v[i] = 0;
      v[(n - 1) * n + i] = 0;
      v[i * n] = 0;
      v[i * n + n - 1] = 0;
    }
    this.h = next;
    this.next = h;
  }

  sample(x: number, z: number): { h: number; dhx: number; dhz: number } {
    const n = this.size;
    const texelX = POOL_W / n;
    const texelZ = POOL_D / n;
    const h = this.heightAt(x, z);
    return {
      h,
      dhx: (this.heightAt(x + texelX, z) - this.heightAt(x - texelX, z)) / (2 * texelX),
      dhz: (this.heightAt(x, z + texelZ) - this.heightAt(x, z - texelZ)) / (2 * texelZ),
    };
  }

  maxAbs(): number {
    let max = 0;
    for (const value of this.h) max = Math.max(max, Math.abs(value));
    return max;
  }

  private heightAt(x: number, z: number): number {
    const n = this.size;
    const fx = ((x / POOL_W + 0.5) * n - 0.5);
    const fz = ((z / POOL_D + 0.5) * n - 0.5);
    const x0 = Math.max(0, Math.min(n - 1, Math.floor(fx)));
    const z0 = Math.max(0, Math.min(n - 1, Math.floor(fz)));
    const x1 = Math.max(0, Math.min(n - 1, x0 + 1));
    const z1 = Math.max(0, Math.min(n - 1, z0 + 1));
    const tx = fx - Math.floor(fx);
    const tz = fz - Math.floor(fz);
    const h00 = this.h[z0 * n + x0] ?? 0;
    const h10 = this.h[z0 * n + x1] ?? 0;
    const h01 = this.h[z1 * n + x0] ?? 0;
    const h11 = this.h[z1 * n + x1] ?? 0;
    const a = h00 + (h10 - h00) * tx;
    const b = h01 + (h11 - h01) * tx;
    return a + (b - a) * tz;
  }
}
