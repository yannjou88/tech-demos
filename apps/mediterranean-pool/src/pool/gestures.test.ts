import { describe, expect, test } from "bun:test";
import { isSwirl, isTap, measureSwirl, type PointerSample } from "./gestures";

function circle(turns: number, clockwise: boolean, radius = 60): PointerSample[] {
  const samples: PointerSample[] = [];
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2 * turns * (clockwise ? -1 : 1);
    samples.push({
      x: 200 + Math.cos(angle) * radius,
      y: 180 + Math.sin(angle) * radius,
      t: i * 16,
    });
  }
  return samples;
}

describe("gestures", () => {
  test("a short press is a tap", () => {
    const samples: PointerSample[] = [
      { x: 10, y: 10, t: 0 },
      { x: 12, y: 11, t: 80 },
      { x: 14, y: 13, t: 140 },
    ];
    expect(isTap(samples, { maxMovePx: 18, maxDurationMs: 450 })).toBe(true);
  });

  test("a long drag is not a tap", () => {
    const samples: PointerSample[] = [
      { x: 0, y: 0, t: 0 },
      { x: 40, y: 10, t: 120 },
      { x: 90, y: 12, t: 240 },
    ];
    expect(isTap(samples, { maxMovePx: 18, maxDurationMs: 450 })).toBe(false);
  });

  test("a closed circle reads as a swirl", () => {
    const measurement = measureSwirl(circle(1, false));
    expect(measurement).not.toBeNull();
    expect(measurement!.signedAngle).toBeGreaterThan(5.5);
    expect(measurement!.signedAngle).toBeLessThan(7);
    expect(isSwirl(measurement!)).toBe(true);
  });

  test("a clockwise circle has a negative angle", () => {
    const measurement = measureSwirl(circle(1, true));
    expect(measurement).not.toBeNull();
    expect(measurement!.signedAngle).toBeLessThan(-5.5);
    expect(isSwirl(measurement!)).toBe(true);
  });

  test("a straight drag is not a swirl", () => {
    const samples: PointerSample[] = [];
    for (let i = 0; i < 24; i++) {
      samples.push({ x: i * 12, y: 40 + i * 0.2, t: i * 16 });
    }
    const measurement = measureSwirl(samples);
    expect(measurement).not.toBeNull();
    expect(isSwirl(measurement!)).toBe(false);
  });
});
