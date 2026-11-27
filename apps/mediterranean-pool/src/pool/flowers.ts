import { POOL_D, POOL_W, clamp, smoothstep } from "./constants";

export type Slope = { h: number; dhx: number; dhz: number };

export type Whirl = { x: number; z: number; strength: number; radius: number };

export type Flower = {
  id: number;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  vy: number;
  held: boolean;
  holdTime: number;
  yaw: number;
  spin: number;
  tilt: number;
  scale: number;
  variant: number;
  age: number;
};

export const FLAT_SLOPE: Slope = { h: 0, dhx: 0, dhz: 0 };
export const STILL_WHIRL: Whirl = { x: 0, z: 0, strength: 0, radius: 1.9 };

const INSET = 0.4;

export function createFlower(partial: Partial<Flower> & Pick<Flower, "x" | "z" | "variant">): Flower {
  return {
    id: partial.id ?? 0,
    x: partial.x,
    z: partial.z,
    y: partial.y ?? 0,
    vx: partial.vx ?? 0,
    vz: partial.vz ?? 0,
    vy: partial.vy ?? 0,
    held: partial.held ?? false,
    holdTime: partial.holdTime ?? 0,
    yaw: partial.yaw ?? 0,
    spin: partial.spin ?? 0.25,
    tilt: partial.tilt ?? 0.08,
    scale: partial.scale ?? 1,
    variant: partial.variant,
    age: partial.age ?? 0,
  };
}

function keepInside(flower: Flower): void {
  const limX = POOL_W / 2 - INSET;
  const limZ = POOL_D / 2 - INSET;
  if (flower.x > limX) {
    flower.x = limX;
    flower.vx *= -0.25;
  } else if (flower.x < -limX) {
    flower.x = -limX;
    flower.vx *= -0.25;
  }
  if (flower.z > limZ) {
    flower.z = limZ;
    flower.vz *= -0.25;
  } else if (flower.z < -limZ) {
    flower.z = -limZ;
    flower.vz *= -0.25;
  }
}

/**
 * Float on the slope of the heightfield, orbit a whirlpool, and spring back
 * to the surface after a press-and-hold dunk.
 */
export function stepFlower(
  flower: Flower,
  dt: number,
  slope: Slope,
  whirl: Whirl,
): Flower {
  const step = clamp(dt, 0, 1 / 30);
  flower.age += step;
  flower.yaw += flower.spin * step;

  if (flower.held) {
    flower.holdTime += step;
    flower.vx *= 0.6;
    flower.vz *= 0.6;
  } else {
    flower.holdTime = Math.max(0, flower.holdTime - step * 2.2);
    flower.vx += -slope.dhx * 1.15 * step;
    flower.vz += -slope.dhz * 1.15 * step;
    flower.vx += Math.sin(flower.age * 0.37 + flower.id * 1.7) * 0.04 * step;
    flower.vz += Math.cos(flower.age * 0.29 + flower.id) * 0.04 * step;

    const drag = Math.exp(-0.85 * step);
    flower.vx *= drag;
    flower.vz *= drag;

    if (whirl.strength > 0.03) {
      const dx = flower.x - whirl.x;
      const dz = flower.z - whirl.z;
      const radius = Math.hypot(dx, dz);
      const falloff = smoothstep(whirl.radius, whirl.radius * 0.4, radius);
      const safe = radius + 1e-4;
      const tx = -dz / safe;
      const tz = dx / safe;
      const inward = smoothstep(0.02, 0.46, radius);
      const tangential = 0.7 + whirl.strength * 1.6;
      const radial = -1.9 * whirl.strength * inward;
      const desiredVx = (tx * tangential + (dx / safe) * radial) * falloff;
      const desiredVz = (tz * tangential + (dz / safe) * radial) * falloff;
      const blend = clamp(falloff * whirl.strength * step * 14, 0, 1);
      flower.vx += (desiredVx - flower.vx) * blend;
      flower.vz += (desiredVz - flower.vz) * blend;
    }
    flower.x += flower.vx * step;
    flower.z += flower.vz * step;
    keepInside(flower);
  }

  const sink = flower.held ? -0.78 * smoothstep(0.16, 0.78, flower.holdTime) : 0;
  const stiffness = 34;
  const damping = 10.5;
  const acceleration = (sink - flower.y) * stiffness - flower.vy * damping;
  flower.vy += acceleration * step;
  flower.y += flower.vy * step;
  if (!flower.held && flower.y > 0.015) {
    flower.y = 0.015;
    flower.vy *= -0.2;
  }
  return flower;
}
