import { describe, expect, test } from "bun:test";
import { markSize, placeMark } from "./geometry";

const page = { x: 0, y: 0, width: 400, height: 200, rotation: 0 };

describe("placeMark", () => {
  test("maps a top-left origin box onto an upright page", () => {
    expect(placeMark({ x: 0.1, y: 0.2, w: 0.3, h: 0.1 }, page)).toEqual({
      x: 40,
      y: 140,
      width: 120,
      height: 20,
      rotate: 0,
    });
  });

  test("keeps the bitmap upright on a page rotated 90 degrees", () => {
    expect(
      placeMark({ x: 0.1, y: 0.2, w: 0.3, h: 0.1 }, { ...page, rotation: 90 }),
    ).toEqual({
      x: 120,
      y: 20,
      width: 60,
      height: 40,
      rotate: 90,
    });
  });

  test("keeps the bitmap upright on a page rotated 180 degrees", () => {
    expect(
      placeMark({ x: 0.1, y: 0.2, w: 0.3, h: 0.1 }, { ...page, rotation: 180 }),
    ).toEqual({
      x: 360,
      y: 60,
      width: 120,
      height: 20,
      rotate: 180,
    });
  });

  test("keeps the bitmap upright on a page rotated 270 degrees", () => {
    expect(
      placeMark({ x: 0.1, y: 0.2, w: 0.3, h: 0.1 }, { ...page, rotation: 270 }),
    ).toEqual({
      x: 280,
      y: 180,
      width: 60,
      height: 40,
      rotate: 270,
    });
  });

  test("adds the media box origin", () => {
    expect(
      placeMark(
        { x: 0, y: 0, w: 0, h: 0 },
        { x: 10, y: 20, width: 400, height: 200, rotation: 0 },
      ),
    ).toMatchObject({ x: 10, y: 220 });
  });
});

describe("markSize", () => {
  test("preserves the bitmap aspect on the page", () => {
    const { w, h } = markSize(2, 0.5, 0.4);
    expect(w).toBeCloseTo(0.4);
    expect(h).toBeCloseTo(0.1);
  });
});
