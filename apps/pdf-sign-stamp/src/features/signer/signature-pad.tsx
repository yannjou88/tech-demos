"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pair } from "@/features/signer/bilingual";

type Point = { x: number; y: number };
type Stroke = { color: string; points: Point[] };

const WIDTH = 640;
const HEIGHT = 220;

function trimCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = source.getContext("2d");
  if (!ctx) return source;
  const { width, height } = source;
  const pixels = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3] ?? 0;
      if (alpha < 12) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX) return source;
  const pad = 16;
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const trimmedWidth = Math.min(width - left, maxX - left + 1 + pad);
  const trimmedHeight = Math.min(height - top, maxY - top + 1 + pad);
  const next = document.createElement("canvas");
  next.width = trimmedWidth;
  next.height = trimmedHeight;
  next.getContext("2d")?.drawImage(
    source,
    left,
    top,
    trimmedWidth,
    trimmedHeight,
    0,
    0,
    trimmedWidth,
    trimmedHeight,
  );
  return next;
}

export function SignaturePad({
  color,
  onPlace,
}: {
  color: string;
  onPlace: (dataUrl: string, bitmapAspect: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const active = useRef<Stroke | null>(null);
  const ratio = useRef(1);
  const [count, setCount] = useState(0);

  function context() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.setTransform(ratio.current, 0, 0, ratio.current, 0, 0);
    return ctx;
  }

  function redraw() {
    const ctx = context();
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    for (const stroke of strokes.current) {
      if (stroke.points.length === 0) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = 3.6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      stroke.points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    ratio.current = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = WIDTH * ratio.current;
    canvas.height = HEIGHT * ratio.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio.current, 0, 0, ratio.current, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
  }, []);

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    active.current = { color, points: [pointFrom(event)] };
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!active.current) return;
    active.current.points.push(pointFrom(event));
    if (!strokes.current.includes(active.current)) {
      strokes.current = [...strokes.current, active.current];
    }
    redraw();
  }

  function end() {
    if (!active.current) return;
    if (active.current.points.length === 1) {
      const point = active.current.points[0];
      if (point) active.current.points.push({ x: point.x + 0.5, y: point.y + 0.5 });
    }
    if (!strokes.current.includes(active.current)) {
      strokes.current = [...strokes.current, active.current];
    }
    active.current = null;
    setCount(strokes.current.length);
    redraw();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-dashed border-foreground/20 bg-white">
        <canvas
          ref={canvasRef}
          data-testid="sig-canvas"
          className="block h-36 w-full touch-none sm:h-44"
          aria-label="签名画布 / Signature canvas"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
        <p className="border-t border-foreground/10 px-3 py-1.5 text-xs text-muted-foreground">
          在这里签名 / Sign here
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 px-3"
          onClick={() => {
            strokes.current = strokes.current.slice(0, -1);
            setCount(strokes.current.length);
            redraw();
          }}
          disabled={count === 0}
        >
          <Pair zh="撤销" en="Undo" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 px-3"
          onClick={() => {
            strokes.current = [];
            setCount(0);
            redraw();
          }}
          disabled={count === 0}
        >
          <Pair zh="重写" en="Clear" />
        </Button>
        <Button
          type="button"
          className="h-11 px-3"
          data-testid="place-signature"
          disabled={count === 0}
          onClick={() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const trimmed = trimCanvas(canvas);
            onPlace(trimmed.toDataURL("image/png"), trimmed.width / trimmed.height);
          }}
        >
          <Pair zh="用这个签名" en="Use this signature" />
        </Button>
      </div>
    </div>
  );
}
