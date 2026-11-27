import { expect, test } from "bun:test";
import { CpuWave } from "./wave-cpu";

test("an impulse spreads and then damps without blowing up", () => {
  const wave = new CpuWave(32);
  wave.impulse(0, 0, -0.12, 0.18);
  expect(Math.abs(wave.sample(0, 0).h)).toBeGreaterThan(0.04);

  for (let i = 0; i < 6; i++) wave.step();
  const neighbor = Math.abs(wave.sample(0.45, 0).h);
  expect(neighbor).toBeGreaterThan(0.002);

  for (let i = 0; i < 90; i++) wave.step();
  expect(wave.maxAbs()).toBeLessThan(0.08);
  expect(Number.isFinite(wave.sample(0.2, -0.3).h)).toBe(true);
});
