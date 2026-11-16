import { describe, expect, test } from "bun:test";
import { formatKlRange, formatKlTime, formatPrice, formatRemain } from "./format";
import { selectFeed } from "./board";
import {
  eventSlug,
  midFromBook,
  resultFromOutcomes,
  referenceFrom,
  splitPercents,
  streakFrom,
  tokenIdFor,
  windowStartSec,
} from "./market";
import { mockBoard } from "./mock";

const NOW = Date.parse("2026-11-16T09:22:08.000Z");

describe("15-minute windows", () => {
  test("aligns unix time down to a 900 second boundary", () => {
    expect(windowStartSec(NOW)).toBe(1794820500);
    expect(windowStartSec(1794820500 * 1000)).toBe(1794820500);
  });

  test("builds the public event slug", () => {
    expect(eventSlug("gold", 1794820500)).toBe("xau-updown-15m-1794820500");
    expect(eventSlug("silver", 1794820500)).toBe("xag-updown-15m-1794820500");
  });
});

describe("quotes", () => {
  test("reads the best bid and ask even when the book is not sorted", () => {
    expect(
      midFromBook({
        bids: [
          { price: "0.18" },
          { price: "0.28" },
          { price: "0.19" },
        ],
        asks: [
          { price: "0.58" },
          { price: "0.29" },
          { price: "0.41" },
        ],
      }),
    ).toBeCloseTo(0.285, 5);
  });

  test("returns null when a book has no prices", () => {
    expect(midFromBook({ bids: [], asks: [] })).toBeNull();
    expect(midFromBook(null)).toBeNull();
  });

  test("normalizes up and down prices into percents that sum to 100", () => {
    expect(splitPercents(0.29, 0.71)).toEqual({ upPct: 29, downPct: 71 });
    expect(splitPercents(0.4, 0.4)).toEqual({ upPct: 50, downPct: 50 });
    expect(splitPercents(0, 0)).toEqual({ upPct: 50, downPct: 50 });
    const split = splitPercents(1, 2);
    expect(split.upPct + split.downPct).toBe(100);
  });

  test("uses the stamped price to beat, then the window-start print", () => {
    expect(referenceFrom(3862.458, [], 0)).toBe(3862.458);
    expect(referenceFrom("47.517", [], 0)).toBe(47.517);
    expect(referenceFrom(null, [{ t: 1_000, open: 3858.1 }], 1_000)).toBe(3858.1);
    expect(referenceFrom(undefined, [{ t: 2_000, open: 1 }], 1_000)).toBeNull();
  });

  test("maps token ids by outcome name", () => {
    expect(tokenIdFor('["Up","Down"]', '["up-token","down-token"]', "down")).toBe(
      "down-token",
    );
  });
});

describe("settled rounds", () => {
  test("reads a resolved outcome from Gamma's JSON strings", () => {
    expect(resultFromOutcomes('["Up","Down"]', '["1","0"]')).toBe("up");
    expect(resultFromOutcomes('["Up","Down"]', '["0","1"]')).toBe("down");
    expect(resultFromOutcomes('["Up","Down"]', '["0.48","0.52"]')).toBeNull();
  });

  test("counts the current streak from the newest round backward", () => {
    expect(streakFrom(["up", "up", "up", "down"])).toEqual({ side: "up", count: 3 });
    expect(streakFrom(["down", "up"])).toEqual({ side: "down", count: 1 });
    expect(streakFrom([])).toBeNull();
  });
});

describe("Kuala Lumpur labels", () => {
  test("formats the round window in Asia/Kuala_Lumpur", () => {
    expect(formatKlRange("2026-11-16T09:15:00.000Z", "2026-11-16T09:30:00.000Z")).toBe(
      "11月16日 17:15–17:30",
    );
    expect(formatKlTime("2026-11-16T09:00:00.000Z")).toBe("17:00");
  });

  test("formats prices and the countdown", () => {
    expect(formatPrice("gold", 3862.458)).toBe("$3,862.46");
    expect(formatPrice("silver", 47.517)).toBe("$47.517");
    expect(formatPrice("gold", null)).toBe("—");
    expect(formatRemain("2026-11-16T09:30:00.000Z", NOW)).toBe("07:52");
    expect(formatRemain("2026-11-16T09:22:00.000Z", NOW)).toBe("00:00");
  });
});

describe("feed selection", () => {
  test("uses the live board when a round was found", () => {
    const live = mockBoard("gold", NOW, "request-failed");
    live.source = "live";
    live.demoReason = null;
    expect(selectFeed("gold", NOW, live, false)).toBe(live);
  });

  test("falls back to demo data when the round is missing or the request fails", () => {
    const missing = selectFeed("silver", NOW, null, false);
    expect(missing.source).toBe("demo");
    expect(missing.demoReason).toBe("no-active-round");
    expect(missing.asset).toBe("silver");

    const failed = selectFeed("gold", NOW, null, true);
    expect(failed.demoReason).toBe("request-failed");
  });
});

describe("mock feed", () => {
  test("is deterministic and stays in a realistic band", () => {
    const a = mockBoard("gold", NOW, "no-active-round");
    const b = mockBoard("gold", NOW, "no-active-round");
    expect(a).toEqual(b);
    expect(a.current.referencePrice).toBeGreaterThan(3800);
    expect(a.current.referencePrice).toBeLessThan(3920);
    expect(a.current.upPct + a.current.downPct).toBe(100);
    expect(a.recent).toHaveLength(10);
    expect(a.streak).toEqual(streakFrom(a.recent.map((round) => round.result)));
    expect(a.current.spot.length).toBeGreaterThan(1);

    const silver = mockBoard("silver", NOW, "request-failed");
    expect(silver.current.referencePrice).toBeGreaterThan(40);
    expect(silver.current.referencePrice).toBeLessThan(55);
  });
});
