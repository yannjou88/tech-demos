"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SpotChart } from "@/components/spot-chart";
import { formatDelta, formatKlRange, formatKlStamp, formatKlTime, formatPct, formatPrice, formatRemain } from "@/lib/format";
import type { Asset, Board } from "@/lib/market";

const ASSETS: { id: Asset; zh: string; en: string; dot: string }[] = [
  { id: "gold", zh: "黄金", en: "Gold", dot: "bg-amber-300" },
  { id: "silver", zh: "白银", en: "Silver", dot: "bg-zinc-300" },
];

function isBoard(value: unknown): value is Board {
  if (typeof value !== "object" || value === null) return false;
  const board = value as Partial<Board>;
  return (
    (board.asset === "gold" || board.asset === "silver") &&
    (board.source === "live" || board.source === "demo") &&
    typeof board.current?.endTime === "string" &&
    typeof board.current.upPct === "number" &&
    Array.isArray(board.recent)
  );
}

async function fetchBoard(asset: Asset): Promise<Board | null> {
  const response = await fetch(`/api/board?asset=${asset}`, { cache: "no-store" });
  if (!response.ok) return null;
  const payload: unknown = await response.json();
  return isBoard(payload) ? payload : null;
}

function streakCopy(streak: Board["streak"]): { zh: string; en: string } {
  if (!streak) return { zh: "暂无连续", en: "No streak" };
  if (streak.side === "up") {
    return { zh: `连续上涨 ${streak.count} 轮`, en: `${streak.count} up in a row` };
  }
  return { zh: `连续下跌 ${streak.count} 轮`, en: `${streak.count} down in a row` };
}

export function OddsBoard({ initial }: { initial: Board }) {
  const [board, setBoard] = useState(initial);
  const [now, setNow] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const kicked = useRef<string | null>(null);
  const asset = board.asset;
  const roundEnds = board.current.endTime;
  const roundId = board.current.id;
  const clock = now ?? Date.parse(board.fetchedAt);
  const remain = formatRemain(roundEnds, clock);
  const delta = formatDelta(board.asset, board.current.spotPrice, board.current.referencePrice);
  const spotUp =
    board.current.spotPrice != null &&
    board.current.referencePrice != null &&
    board.current.spotPrice >= board.current.referencePrice;
  const streak = streakCopy(board.streak);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const start = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const pull = async () => {
      const next = await fetchBoard(asset);
      if (active && next) setBoard(next);
    };
    const id = window.setInterval(() => void pull(), 10_000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [asset]);

  useEffect(() => {
    if (now == null) return;
    if (new Date(roundEnds).getTime() > now) return;
    if (kicked.current === roundId) return;
    kicked.current = roundId;
    void fetchBoard(asset).then((next) => {
      if (next) setBoard(next);
    });
  }, [now, asset, roundEnds, roundId]);

  async function choose(nextAsset: Asset) {
    if (nextAsset === asset || busy) return;
    setBusy(true);
    try {
      const next = await fetchBoard(nextAsset);
      if (next) setBoard(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`flex flex-col gap-4 ${busy ? "opacity-70" : ""}`} aria-busy={busy}>
      {board.source === "demo" ? (
        <div className="flex flex-col items-start gap-2">
          <Badge variant="outline" className="h-6 px-2.5">
            演示数据 / Demo data
          </Badge>
          <p className="text-xs text-muted-foreground">
            {board.demoReason === "request-failed"
              ? "行情接口暂时不可用，以下为演示数据。"
              : "未找到进行中的回合，以下为演示数据。"}
          </p>
        </div>
      ) : null}

      <ToggleGroup
        value={[board.asset]}
        onValueChange={(values) => {
          const next = values.find((value) => value === "gold" || value === "silver");
          if (next) void choose(next);
        }}
        spacing={0}
        variant="outline"
        className="grid w-full grid-cols-2"
        aria-label="品种"
      >
        {ASSETS.map((asset) => (
          <ToggleGroupItem
            key={asset.id}
            value={asset.id}
            className="h-11 w-full data-pressed:bg-foreground data-pressed:text-background aria-pressed:bg-foreground aria-pressed:text-background"
          >
            <span className={`size-2 rounded-full ${asset.dot}`} />
            {asset.zh}
            <span className="text-xs font-normal opacity-70">{asset.en}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Card>
        <CardHeader>
          <CardTitle>本轮</CardTitle>
          <p className="text-sm text-muted-foreground">
            {formatKlRange(board.current.startTime, board.current.endTime)}
            <span className="mt-0.5 block text-xs">Current round · Kuala Lumpur</span>
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div>
            <p className="text-6xl font-semibold tracking-tight tabular-nums">{remain}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              剩余
              <span className="ml-2 text-xs">Time left</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">
                开盘参考价
                <span className="mt-0.5 block">Price to beat</span>
              </p>
              <p className="mt-1 text-xl font-medium tabular-nums">
                {formatPrice(board.asset, board.current.referencePrice)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                现货
                <span className="mt-0.5 block">Spot</span>
              </p>
              <p
                className={`mt-1 text-xl font-medium tabular-nums ${
                  board.current.spotPrice == null || board.current.referencePrice == null
                    ? ""
                    : spotUp
                      ? "text-emerald-400"
                      : "text-rose-400"
                }`}
              >
                {formatPrice(board.asset, board.current.spotPrice)}
              </p>
              {delta ? (
                <p className={`text-xs tabular-nums ${spotUp ? "text-emerald-400" : "text-rose-400"}`}>{delta}</p>
              ) : null}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-semibold tabular-nums text-emerald-400">
                  {formatPct(board.current.upPct)}
                </p>
                <p className="text-sm text-muted-foreground">
                  上涨 <span className="text-xs">Up</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-semibold tabular-nums text-rose-400">
                  {formatPct(board.current.downPct)}
                </p>
                <p className="text-sm text-muted-foreground">
                  下跌 <span className="text-xs">Down</span>
                </p>
              </div>
            </div>
            <div
              className="flex h-3 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`上涨 ${formatPct(board.current.upPct)}，下跌 ${formatPct(board.current.downPct)}`}
            >
              <div className="bg-emerald-400" style={{ width: `${board.current.upPct}%` }} />
              <div className="bg-rose-400" style={{ width: `${board.current.downPct}%` }} />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              现货走势
              <span className="ml-2 text-xs">Spot this round</span>
            </p>
            <SpotChart
              points={board.current.spot}
              reference={board.current.referencePrice}
              asset={board.asset}
            />
            {board.current.referencePrice != null && board.current.spot.length > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">虚线为开盘参考价 · dashed line is the reference</p>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground">
            更新于 {formatKlStamp(board.fetchedAt)} · 约每 10 秒刷新
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>最近回合</CardTitle>
          <p className="text-sm text-muted-foreground">
            {streak.zh}
            <span className="mt-0.5 block text-xs">{streak.en}</span>
          </p>
        </CardHeader>
        <CardContent>
          {board.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无已结算回合</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {board.recent.map((round) => (
                <div
                  key={round.id}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                    round.result === "up"
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "bg-rose-400/15 text-rose-300"
                  }`}
                >
                  <span className="text-muted-foreground">{formatKlTime(round.startTime)}</span>
                  <span className="ml-1.5 font-medium">{round.result === "up" ? "涨" : "跌"}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />
    </div>
  );
}
