export type Asset = "gold" | "silver";
export type Side = "up" | "down";
export type DemoReason = "no-active-round" | "request-failed";

export const ROUND_SECONDS = 900;

export const SERIES_ID: Record<Asset, string> = {
  gold: "12967",
  silver: "12968",
};

const SLUG_PREFIX: Record<Asset, string> = {
  gold: "xau-updown-15m",
  silver: "xag-updown-15m",
};

export const SPOT_ASSET: Record<Asset, string> = {
  gold: "commodity:gold",
  silver: "commodity:silver",
};

export type SpotPoint = { t: number; price: number };

export type RoundSummary = {
  id: string;
  startTime: string;
  endTime: string;
  result: Side;
};

export type Board = {
  source: "live" | "demo";
  asset: Asset;
  fetchedAt: string;
  demoReason: DemoReason | null;
  current: {
    id: string;
    startTime: string;
    endTime: string;
    referencePrice: number | null;
    spotPrice: number | null;
    upPct: number;
    downPct: number;
    spot: SpotPoint[];
  };
  recent: RoundSummary[];
  streak: { side: Side; count: number } | null;
};

export type BookSide = { price: string };

export function windowStartSec(nowMs: number): number {
  const sec = Math.floor(nowMs / 1000);
  return sec - (sec % ROUND_SECONDS);
}

export function eventSlug(asset: Asset, startSec: number): string {
  return `${SLUG_PREFIX[asset]}-${startSec}`;
}

export function parseStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function splitPercents(up: number, down: number): { upPct: number; downPct: number } {
  const upQuote = Number.isFinite(up) && up > 0 ? up : 0;
  const downQuote = Number.isFinite(down) && down > 0 ? down : 0;
  const total = upQuote + downQuote;
  if (total <= 0) return { upPct: 50, downPct: 50 };
  const upPct = Math.round((upQuote / total) * 1000) / 10;
  const downPct = Math.round((100 - upPct) * 10) / 10;
  return { upPct, downPct };
}

export function midFromBook(book: { bids?: BookSide[]; asks?: BookSide[] } | null): number | null {
  if (!book) return null;
  const bids = (book.bids ?? []).map((level) => Number(level.price)).filter(Number.isFinite);
  const asks = (book.asks ?? []).map((level) => Number(level.price)).filter(Number.isFinite);
  const bestBid = bids.length > 0 ? Math.max(...bids) : null;
  const bestAsk = asks.length > 0 ? Math.min(...asks) : null;
  if (bestBid != null && bestAsk != null) return (bestBid + bestAsk) / 2;
  return bestBid ?? bestAsk;
}

export function resultFromOutcomes(outcomesRaw: unknown, pricesRaw: unknown): Side | null {
  const outcomes = parseStringArray(outcomesRaw).map((outcome) => outcome.toLowerCase());
  const prices = parseStringArray(pricesRaw).map(Number);
  const upIndex = outcomes.indexOf("up");
  const downIndex = outcomes.indexOf("down");
  if (upIndex < 0 || downIndex < 0) return null;
  const up = prices[upIndex];
  const down = prices[downIndex];
  if (!Number.isFinite(up) || !Number.isFinite(down)) return null;
  if (up >= 0.99 && down <= 0.01) return "up";
  if (down >= 0.99 && up <= 0.01) return "down";
  return null;
}

export function tokenIdFor(outcomesRaw: unknown, tokenIdsRaw: unknown, side: Side): string | null {
  const outcomes = parseStringArray(outcomesRaw).map((outcome) => outcome.toLowerCase());
  const ids = parseStringArray(tokenIdsRaw);
  const index = outcomes.indexOf(side);
  const id = index >= 0 ? ids[index] : undefined;
  return id ? id : null;
}

export function streakFrom(results: Side[]): { side: Side; count: number } | null {
  const first = results[0];
  if (!first) return null;
  let count = 0;
  for (const result of results) {
    if (result !== first) break;
    count += 1;
  }
  return { side: first, count };
}

export function referenceFrom(
  metadata: unknown,
  opens: { t: number; open: number }[],
  startMs: number,
): number | null {
  const stamped = typeof metadata === "number" ? metadata : typeof metadata === "string" ? Number(metadata) : NaN;
  if (Number.isFinite(stamped)) return stamped;
  const atOpen = opens.find((candle) => candle.t === startMs);
  return atOpen && Number.isFinite(atOpen.open) ? atOpen.open : null;
}

export function isAsset(value: string | null): value is Asset {
  return value === "gold" || value === "silver";
}
