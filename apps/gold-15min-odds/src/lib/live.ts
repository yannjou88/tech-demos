import {
  eventSlug,
  midFromBook,
  parseStringArray,
  referenceFrom,
  resultFromOutcomes,
  ROUND_SECONDS,
  SERIES_ID,
  splitPercents,
  SPOT_ASSET,
  streakFrom,
  tokenIdFor,
  windowStartSec,
  type Asset,
  type Board,
  type BookSide,
  type RoundSummary,
  type SpotPoint,
} from "./market";

const GAMMA = "https://gamma-api.polymarket.com";
const CLOB = "https://clob.polymarket.com";
const SPOT = "https://gateway.polymarket.us/v1/asset-prices/history";

type GammaMarket = {
  outcomes?: unknown;
  outcomePrices?: unknown;
  clobTokenIds?: unknown;
  eventStartTime?: string;
  endDate?: string;
};

type GammaEvent = {
  slug?: string;
  startTime?: string;
  endDate?: string;
  eventMetadata?: { priceToBeat?: unknown };
  markets?: GammaMarket[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
}

function asEvent(value: unknown): GammaEvent | null {
  if (!isRecord(value)) return null;
  const markets = Array.isArray(value.markets)
    ? value.markets.filter(isRecord).map((market) => market as GammaMarket)
    : undefined;
  const metadata = isRecord(value.eventMetadata) ? value.eventMetadata : undefined;
  return {
    slug: typeof value.slug === "string" ? value.slug : undefined,
    startTime: typeof value.startTime === "string" ? value.startTime : undefined,
    endDate: typeof value.endDate === "string" ? value.endDate : undefined,
    eventMetadata: metadata,
    markets,
  };
}

function asBook(value: unknown): { bids: BookSide[]; asks: BookSide[] } | null {
  if (!isRecord(value)) return null;
  const levels = (raw: unknown): BookSide[] => {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((level) => {
      if (!isRecord(level)) return [];
      if (typeof level.price !== "string" && typeof level.price !== "number") return [];
      return [{ price: String(level.price) }];
    });
  };
  return { bids: levels(value.bids), asks: levels(value.asks) };
}

type Candle = SpotPoint & { open: number };

async function quote(market: GammaMarket): Promise<{ up: number; down: number }> {
  const upId = tokenIdFor(market.outcomes, market.clobTokenIds, "up");
  const downId = tokenIdFor(market.outcomes, market.clobTokenIds, "down");
  let up = Number.NaN;
  let down = Number.NaN;
  if (upId && downId) {
    const [upBook, downBook] = await Promise.all([
      getJson(`${CLOB}/book?token_id=${encodeURIComponent(upId)}`).catch(() => null),
      getJson(`${CLOB}/book?token_id=${encodeURIComponent(downId)}`).catch(() => null),
    ]);
    up = midFromBook(asBook(upBook)) ?? Number.NaN;
    down = midFromBook(asBook(downBook)) ?? Number.NaN;
  }
  if (!Number.isFinite(up) || !Number.isFinite(down)) {
    const outcomes = parseStringArray(market.outcomes).map((outcome) => outcome.toLowerCase());
    const prices = parseStringArray(market.outcomePrices).map(Number);
    up = prices[outcomes.indexOf("up")] ?? Number.NaN;
    down = prices[outcomes.indexOf("down")] ?? Number.NaN;
  }
  if (!Number.isFinite(up) || !Number.isFinite(down)) throw new Error("no quote");
  return { up, down };
}

function readCandles(payload: unknown, fromSec: number, toSec: number): Candle[] {
  if (!isRecord(payload) || !Array.isArray(payload.series)) return [];
  const first = payload.series[0];
  if (!isRecord(first) || !Array.isArray(first.candles)) return [];
  const points: Candle[] = [];
  for (const candle of first.candles) {
    if (!isRecord(candle) || typeof candle.timestamp !== "number") continue;
    const price = Number(candle.close);
    const open = Number(candle.open);
    const t = candle.timestamp * 1000;
    if (!Number.isFinite(price) || !Number.isFinite(open)) continue;
    if (candle.timestamp < fromSec || candle.timestamp > toSec) continue;
    points.push({ t, price, open });
  }
  return points;
}

async function loadSpot(asset: Asset, fromSec: number, toSec: number): Promise<Candle[]> {
  if (toSec <= fromSec) return [];
  const params = new URLSearchParams({
    assets: SPOT_ASSET[asset],
    from: String(fromSec),
    to: String(toSec),
    bucket: "ASSET_PRICE_BUCKET_15S",
  });
  const payload = await getJson(`${SPOT}?${params.toString()}`);
  return readCandles(payload, fromSec, toSec);
}

async function loadRecent(asset: Asset): Promise<RoundSummary[]> {
  const params = new URLSearchParams({
    series_id: SERIES_ID[asset],
    closed: "true",
    limit: "12",
    order: "endDate",
    ascending: "false",
  });
  const payload = await getJson(`${GAMMA}/events?${params.toString()}`);
  if (!Array.isArray(payload)) return [];
  const rounds: RoundSummary[] = [];
  for (const item of payload) {
    const event = asEvent(item);
    const market = event?.markets?.[0];
    if (!event || !market) continue;
    const result = resultFromOutcomes(market.outcomes, market.outcomePrices);
    const startTime = event.startTime ?? market.eventStartTime;
    const endTime = event.endDate ?? market.endDate;
    if (!result || !startTime || !endTime) continue;
    rounds.push({
      id: event.slug ?? endTime,
      startTime,
      endTime,
      result,
    });
  }
  rounds.sort((a, b) => Date.parse(b.endTime) - Date.parse(a.endTime));
  return rounds.slice(0, 10);
}

export async function loadLive(asset: Asset, nowMs: number): Promise<Board | null> {
  const start = windowStartSec(nowMs);
  const payload = await getJson(`${GAMMA}/events/slug/${eventSlug(asset, start)}`);
  const event = asEvent(payload);
  const market = event?.markets?.[0];
  if (!event || !market) return null;

  const { up, down } = await quote(market);
  const percents = splitPercents(up, down);
  const nowSec = Math.floor(nowMs / 1000);
  const candles = await loadSpot(asset, start, nowSec).catch(() => [] as Candle[]);
  const recent = await loadRecent(asset).catch(() => [] as RoundSummary[]);
  const startTime = event.startTime ?? market.eventStartTime ?? new Date(start * 1000).toISOString();
  const endTime =
    event.endDate ?? market.endDate ?? new Date((start + ROUND_SECONDS) * 1000).toISOString();
  const spot: SpotPoint[] = candles.map(({ t, price }) => ({ t, price }));

  return {
    source: "live",
    asset,
    fetchedAt: new Date(nowMs).toISOString(),
    demoReason: null,
    current: {
      id: event.slug ?? eventSlug(asset, start),
      startTime,
      endTime,
      referencePrice: referenceFrom(event.eventMetadata?.priceToBeat, candles, start * 1000),
      spotPrice: spot.at(-1)?.price ?? null,
      upPct: percents.upPct,
      downPct: percents.downPct,
      spot,
    },
    recent,
    streak: streakFrom(recent.map((round) => round.result)),
  };
}
