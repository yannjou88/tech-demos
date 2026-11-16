import {
  eventSlug,
  ROUND_SECONDS,
  splitPercents,
  streakFrom,
  windowStartSec,
  type Asset,
  type Board,
  type DemoReason,
  type RoundSummary,
  type SpotPoint,
} from "./market";

const ANCHOR: Record<Asset, number> = {
  gold: 3862,
  silver: 47.5,
};

function hashSeed(asset: Asset, startSec: number): number {
  const salt = asset === "gold" ? 1 : 2;
  return (Math.imul(startSec, 2654435761) ^ Math.imul(salt, 1597334677)) >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function roundPath(asset: Asset, startSec: number, steps: number): number[] {
  const rand = mulberry32(hashSeed(asset, startSec));
  const digits = asset === "silver" ? 3 : 2;
  const step = asset === "gold" ? 0.35 : 0.004;
  const swing = asset === "gold" ? 8 : 0.12;
  let price = ANCHOR[asset] + (rand() - 0.5) * swing;
  const points = [price];
  for (let index = 0; index < steps; index += 1) {
    price += (rand() - 0.48) * step;
    points.push(price);
  }
  return points.map((point) => Number(point.toFixed(digits)));
}

function settledRound(asset: Asset, startSec: number): RoundSummary {
  const path = roundPath(asset, startSec, 60);
  const reference = path[0] ?? ANCHOR[asset];
  const finalPrice = path[path.length - 1] ?? reference;
  return {
    id: eventSlug(asset, startSec),
    startTime: new Date(startSec * 1000).toISOString(),
    endTime: new Date((startSec + ROUND_SECONDS) * 1000).toISOString(),
    result: finalPrice >= reference ? "up" : "down",
  };
}

export function mockBoard(asset: Asset, nowMs: number, reason: DemoReason): Board {
  const start = windowStartSec(nowMs);
  const elapsed = Math.min(ROUND_SECONDS, Math.max(0, Math.floor(nowMs / 1000) - start));
  const steps = Math.max(1, Math.floor(elapsed / 15));
  const path = roundPath(asset, start, steps);
  const reference = path[0] ?? ANCHOR[asset];
  const spot = path[path.length - 1] ?? reference;
  const up = 1 / (1 + Math.exp(-((spot - reference) / reference) * 3500));
  const percents = splitPercents(up, 1 - up);
  const series: SpotPoint[] = path.map((price, index) => ({
    t: (start + index * 15) * 1000,
    price,
  }));
  const recent = Array.from({ length: 10 }, (_, index) =>
    settledRound(asset, start - (index + 1) * ROUND_SECONDS),
  );

  return {
    source: "demo",
    asset,
    fetchedAt: new Date(nowMs).toISOString(),
    demoReason: reason,
    current: {
      id: eventSlug(asset, start),
      startTime: new Date(start * 1000).toISOString(),
      endTime: new Date((start + ROUND_SECONDS) * 1000).toISOString(),
      referencePrice: reference,
      spotPrice: spot,
      upPct: percents.upPct,
      downPct: percents.downPct,
      spot: series,
    },
    recent,
    streak: streakFrom(recent.map((round) => round.result)),
  };
}
