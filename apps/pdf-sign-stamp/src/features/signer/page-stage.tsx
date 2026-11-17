"use client";

/* Placed stamps are canvas data URLs, not remote images. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { Mark } from "@/features/signer/types";

type Drag =
  | {
      kind: "move";
      id: string;
      startX: number;
      startY: number;
      mark: Mark;
      width: number;
      height: number;
    }
  | {
      kind: "resize";
      id: string;
      handle: string;
      startX: number;
      startY: number;
      mark: Mark;
      width: number;
      height: number;
    };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resizeMark(drag: Extract<Drag, { kind: "resize" }>, dx: number, dy: number): Partial<Mark> {
  const start = drag.mark;
  const pageAspect = drag.width / drag.height;
  let x = start.x;
  let y = start.y;
  let w = start.w;
  let h = start.h;
  if (drag.handle.includes("e")) w = start.w + dx;
  if (drag.handle.includes("w")) {
    w = start.w - dx;
    x = start.x + dx;
  }
  if (drag.handle.includes("s")) h = start.h + dy;
  if (drag.handle.includes("n")) {
    h = start.h - dy;
    y = start.y + dy;
  }
  if (start.lockAspect && start.bitmapAspect > 0) {
    if (drag.handle === "n" || drag.handle === "s") {
      w = (h * start.bitmapAspect) / pageAspect;
    } else {
      h = (w * pageAspect) / start.bitmapAspect;
    }
    if (drag.handle.includes("w")) x = start.x + start.w - w;
    if (drag.handle.includes("n")) y = start.y + start.h - h;
  }
  w = Math.max(0.06, w);
  h = Math.max(0.04, h);
  if (x < 0) {
    w += x;
    x = 0;
  }
  if (y < 0) {
    h += y;
    y = 0;
  }
  if (x + w > 1) w = 1 - x;
  if (y + h > 1) h = 1 - y;
  return { x, y, w, h };
}

export function PageStage({
  pdf,
  pageNumber,
  marks,
  selectedId,
  armed,
  onPlace,
  onSelect,
  onChange,
  onDelete,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  marks: Mark[];
  selectedId: string | null;
  armed: boolean;
  onPlace: (x: number, y: number, pageAspect: number) => void;
  onSelect: (id: string | null) => void;
  onChange: (id: string, next: Partial<Mark>) => void;
  onDelete: (id: string) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [tick, setTick] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => setTick((value) => value + 1));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const width = stage.clientWidth;
    if (width < 20) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    setFailed(false);
    void (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(
          2.25,
          (width * Math.min(window.devicePixelRatio || 1, 2)) / base.width,
        );
        const viewport = page.getViewport({ scale });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        task = page.render({ canvas, canvasContext: ctx, viewport });
        await task.promise;
      } catch (error) {
        const name = error instanceof Error ? error.name : "";
        if (!cancelled && name !== "RenderingCancelledException") setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNumber, tick]);

  function pageAspect() {
    const stage = stageRef.current;
    if (!stage || stage.clientHeight === 0) return 0.7;
    return stage.clientWidth / stage.clientHeight;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div
        ref={stageRef}
        data-testid="page-stage"
        className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10"
      >
        <canvas ref={canvasRef} className="block h-auto w-full" />
        <div
          className={`absolute inset-0 touch-none ${armed ? "cursor-copy" : ""}`}
          onPointerDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (!armed) {
              onSelect(null);
              return;
            }
            const rect = event.currentTarget.getBoundingClientRect();
            onPlace(
              (event.clientX - rect.left) / rect.width,
              (event.clientY - rect.top) / rect.height,
              pageAspect(),
            );
          }}
        >
          {marks
            .filter((mark) => mark.page === pageNumber)
            .map((mark) => {
              const selected = mark.id === selectedId;
              return (
                <div
                  key={mark.id}
                  className={`absolute touch-none ${selected ? "z-10 ring-2 ring-sky-700" : "z-0"}`}
                  style={{
                    left: `${mark.x * 100}%`,
                    top: `${mark.y * 100}%`,
                    width: `${mark.w * 100}%`,
                    height: `${mark.h * 100}%`,
                  }}
                  onPointerDown={(event) => {
                    const rect = stageRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    if (armed) {
                      event.stopPropagation();
                      onPlace(
                        (event.clientX - rect.left) / rect.width,
                        (event.clientY - rect.top) / rect.height,
                        pageAspect(),
                      );
                      return;
                    }
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    onSelect(mark.id);
                    dragRef.current = {
                      kind: "move",
                      id: mark.id,
                      startX: event.clientX,
                      startY: event.clientY,
                      mark,
                      width: rect.width,
                      height: rect.height,
                    };
                  }}
                  onPointerMove={(event) => {
                    const drag = dragRef.current;
                    if (!drag || drag.id !== mark.id) return;
                    const dx = (event.clientX - drag.startX) / drag.width;
                    const dy = (event.clientY - drag.startY) / drag.height;
                    if (drag.kind === "move") {
                      onChange(mark.id, {
                        x: clamp(drag.mark.x + dx, 0, 1 - drag.mark.w),
                        y: clamp(drag.mark.y + dy, 0, 1 - drag.mark.h),
                      });
                      return;
                    }
                    onChange(mark.id, resizeMark(drag, dx, dy));
                  }}
                  onPointerUp={() => {
                    dragRef.current = null;
                  }}
                >
                  <img
                    src={mark.dataUrl}
                    alt=""
                    draggable={false}
                    className="pointer-events-none h-full w-full"
                  />
                  {selected ? (
                    <>
                      <button
                        type="button"
                        className="absolute -top-9 right-0 h-8 rounded-full bg-foreground px-2 text-xs text-background"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => onDelete(mark.id)}
                      >
                        删除 / Delete
                      </button>
                      {(["nw", "ne", "sw", "se"] as const).map((handle) => (
                        <button
                          key={handle}
                          type="button"
                          aria-label={`resize ${handle}`}
                          className="absolute size-6 rounded-full border-2 border-white bg-sky-700"
                          style={{
                            left: handle.includes("w") ? -12 : undefined,
                            right: handle.includes("e") ? -12 : undefined,
                            top: handle.includes("n") ? -12 : undefined,
                            bottom: handle.includes("s") ? -12 : undefined,
                          }}
                          onPointerDown={(event) => {
                            if (armed) return;
                            event.stopPropagation();
                            const rect = stageRef.current?.getBoundingClientRect();
                            if (!rect) return;
                            event.currentTarget.setPointerCapture(event.pointerId);
                            dragRef.current = {
                              kind: "resize",
                              id: mark.id,
                              handle,
                              startX: event.clientX,
                              startY: event.clientY,
                              mark,
                              width: rect.width,
                              height: rect.height,
                            };
                          }}
                          onPointerMove={(event) => {
                            const drag = dragRef.current;
                            if (!drag || drag.kind !== "resize" || drag.id !== mark.id) return;
                            const dx = (event.clientX - drag.startX) / drag.width;
                            const dy = (event.clientY - drag.startY) / drag.height;
                            onChange(mark.id, resizeMark(drag, dx, dy));
                          }}
                          onPointerUp={() => {
                            dragRef.current = null;
                          }}
                        />
                      ))}
                    </>
                  ) : null}
                </div>
              );
            })}
        </div>
      </div>
      {failed ? (
        <p className="text-center text-sm text-destructive">
          这一页没能画出来。 / This page could not be drawn.
        </p>
      ) : null}
    </div>
  );
}
