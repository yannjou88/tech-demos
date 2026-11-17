import { describe, expect, test } from "bun:test";
import { formatStampDate } from "./dates";

describe("formatStampDate", () => {
  const date = new Date(2026, 10, 17);

  test("formats the local calendar day", () => {
    expect(formatStampDate(date, "zh")).toBe("2026年11月17日");
    expect(formatStampDate(date, "iso")).toBe("2026-11-17");
    expect(formatStampDate(date, "dmy")).toBe("17/11/2026");
    expect(formatStampDate(date, "en")).toBe("Nov 17, 2026");
  });
});
