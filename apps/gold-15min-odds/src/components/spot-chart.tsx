import type { Asset, SpotPoint } from "@/lib/market";

export function SpotChart({
  points,
  reference,
  asset,
}: {
  points: SpotPoint[];
  reference: number | null;
  asset: Asset;
}) {
  if (points.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        本轮现货暂无
        <span className="mt-0.5 block text-xs">Spot history unavailable</span>
      </p>
    );
  }

  const series = points.length === 1 ? [points[0], points[0]] : points;
  const prices = series.map((point) => point.price);
  if (reference != null) prices.push(reference);
  let min = Math.min(...prices);
  let max = Math.max(...prices);
  if (min === max) {
    const pad = asset === "gold" ? 0.4 : 0.01;
    min -= pad;
    max += pad;
  } else {
    const pad = (max - min) * 0.18;
    min -= pad;
    max += pad;
  }

  const width = 320;
  const height = 96;
  const xAt = (index: number) => (index / (series.length - 1)) * width;
  const yAt = (price: number) => height - ((price - min) / (max - min)) * height;
  const line = series
    .map((point, index) => `${index === 0 ? "M" : "L"}${xAt(index).toFixed(1)},${yAt(point.price).toFixed(1)}`)
    .join(" ");
  const last = series[series.length - 1]?.price ?? min;
  const above = reference == null ? last >= (series[0]?.price ?? last) : last >= reference;
  const refY = reference == null ? null : yAt(reference);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`h-24 w-full ${above ? "text-emerald-400" : "text-rose-400"}`}
      role="img"
      aria-label="现货走势"
    >
      {refY != null ? (
        <line
          x1="0"
          x2={width}
          y1={refY}
          y2={refY}
          className="text-muted-foreground"
          stroke="currentColor"
          strokeDasharray="4 4"
          strokeWidth="1"
        />
      ) : null}
      <path d={`${line} L${width},${height} L0,${height} Z`} fill="currentColor" opacity="0.12" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
