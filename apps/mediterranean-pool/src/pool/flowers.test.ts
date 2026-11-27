import { expect, test } from "bun:test";
import { FLAT_SLOPE, STILL_WHIRL, createFlower, stepFlower, type Whirl } from "./flowers";

test("holding a flower pushes it under, and releasing it brings it back", () => {
  const flower = createFlower({ x: 0, z: 0, variant: 0, held: true });
  for (let i = 0; i < 80; i++) stepFlower(flower, 1 / 60, FLAT_SLOPE, STILL_WHIRL);
  expect(flower.y).toBeLessThan(-0.45);

  flower.held = false;
  for (let i = 0; i < 180; i++) stepFlower(flower, 1 / 60, FLAT_SLOPE, STILL_WHIRL);
  expect(flower.y).toBeGreaterThan(-0.08);
});

test("a whirlpool pulls a floating flower inward", () => {
  const flower = createFlower({ x: 1.25, z: 0.1, variant: 1, scale: 1 });
  const whirl: Whirl = { x: 0, z: 0, strength: 1, radius: 2.1 };
  const start = Math.hypot(flower.x, flower.z);
  for (let i = 0; i < 240; i++) stepFlower(flower, 1 / 60, FLAT_SLOPE, whirl);
  expect(Math.hypot(flower.x, flower.z)).toBeLessThan(start * 0.72);
});

test("a flower slides downhill on a wave slope", () => {
  const flower = createFlower({ x: 0, z: 0, variant: 2 });
  for (let i = 0; i < 40; i++) {
    stepFlower(flower, 1 / 60, { h: 0, dhx: 0.8, dhz: 0 }, STILL_WHIRL);
  }
  expect(flower.x).toBeLessThan(-0.05);
});
