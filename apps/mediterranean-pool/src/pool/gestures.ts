export type PointerSample = { x: number; y: number; t: number };

export type SwirlMeasurement = {
  signedAngle: number;
  centerX: number;
  centerY: number;
  radius: number;
  circularity: number;
  pathLength: number;
};

export function pointerTravel(samples: readonly PointerSample[]): number {
  let moved = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (!a || !b) continue;
    moved = Math.max(moved, Math.hypot(b.x - a.x, b.y - a.y));
  }
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (first && last) {
    moved = Math.max(moved, Math.hypot(last.x - first.x, last.y - first.y));
  }
  return moved;
}

export function isTap(
  samples: readonly PointerSample[],
  opts: { maxMovePx: number; maxDurationMs: number },
): boolean {
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || !last) return false;
  return last.t - first.t <= opts.maxDurationMs && pointerTravel(samples) <= opts.maxMovePx;
}

export function measureSwirl(
  samples: readonly PointerSample[],
  windowMs = 900,
): SwirlMeasurement | null {
  const last = samples[samples.length - 1];
  if (!last) return null;
  const windowed = samples.filter((sample) => last.t - sample.t <= windowMs);
  if (windowed.length < 6) return null;

  let cx = 0;
  let cy = 0;
  for (const sample of windowed) {
    cx += sample.x;
    cy += sample.y;
  }
  cx /= windowed.length;
  cy /= windowed.length;

  let angle = 0;
  let radiusSum = 0;
  let path = 0;
  let prev = Math.atan2((windowed[0]?.y ?? cy) - cy, (windowed[0]?.x ?? cx) - cx);
  for (let i = 0; i < windowed.length; i++) {
    const sample = windowed[i];
    if (!sample) continue;
    const dx = sample.x - cx;
    const dy = sample.y - cy;
    const radius = Math.hypot(dx, dy);
    radiusSum += radius;
    if (i > 0) {
      const prevSample = windowed[i - 1];
      if (prevSample) path += Math.hypot(sample.x - prevSample.x, sample.y - prevSample.y);
      const next = Math.atan2(dy, dx);
      let delta = next - prev;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      if (radius > 14) angle += delta;
      prev = next;
    }
  }

  const mean = radiusSum / windowed.length;
  let variance = 0;
  for (const sample of windowed) {
    const radius = Math.hypot(sample.x - cx, sample.y - cy);
    variance += (radius - mean) ** 2;
  }
  const std = Math.sqrt(variance / windowed.length);
  const circularity = mean > 1 ? 1 - std / mean : 0;

  return {
    signedAngle: angle,
    centerX: cx,
    centerY: cy,
    radius: mean,
    circularity,
    pathLength: path,
  };
}

/** A drag counts as stirring once it has swept a real arc, including a messy circle. */
export function isSwirl(measurement: SwirlMeasurement): boolean {
  const turned = Math.abs(measurement.signedAngle) >= 4.6;
  const arc = Math.abs(measurement.signedAngle) >= 3.3 && measurement.circularity >= 0.5;
  return (turned || arc) && measurement.radius >= 18 && measurement.pathLength >= 80;
}
