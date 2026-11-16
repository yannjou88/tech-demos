import { loadLive } from "./live";
import type { Asset, Board } from "./market";
import { mockBoard } from "./mock";

export function selectFeed(asset: Asset, nowMs: number, live: Board | null, failed: boolean): Board {
  if (failed || live == null) {
    return mockBoard(asset, nowMs, failed ? "request-failed" : "no-active-round");
  }
  return live;
}

export async function getBoard(asset: Asset, nowMs = Date.now()): Promise<Board> {
  try {
    const live = await loadLive(asset, nowMs);
    return selectFeed(asset, nowMs, live, false);
  } catch {
    return selectFeed(asset, nowMs, null, true);
  }
}
