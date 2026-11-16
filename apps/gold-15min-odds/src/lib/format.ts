import type { Asset } from "./market";

const KL = "Asia/Kuala_Lumpur";

type ClockParts = {
  month: number;
  day: number;
  hour: string;
  minute: string;
  second: string;
};

function klParts(iso: string): ClockParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KL,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return {
    month: Number(read("month")),
    day: Number(read("day")),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

export function formatKlRange(startIso: string, endIso: string): string {
  const start = klParts(startIso);
  const end = klParts(endIso);
  return `${start.month}月${start.day}日 ${start.hour}:${start.minute}–${end.hour}:${end.minute}`;
}

export function formatKlTime(iso: string): string {
  const parts = klParts(iso);
  return `${parts.hour}:${parts.minute}`;
}

export function formatKlStamp(iso: string): string {
  const parts = klParts(iso);
  return `${parts.hour}:${parts.minute}:${parts.second}`;
}

export function formatPrice(asset: Asset, value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const digits = asset === "silver" ? 3 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPct(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded.toFixed(0)}%` : `${rounded.toFixed(1)}%`;
}

export function formatRemain(endIso: string, nowMs: number): string {
  const remainingMs = new Date(endIso).getTime() - nowMs;
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatDelta(asset: Asset, spot: number | null, reference: number | null): string | null {
  if (spot == null || reference == null) return null;
  const delta = spot - reference;
  const digits = asset === "silver" ? 3 : 2;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(digits)}`;
}
