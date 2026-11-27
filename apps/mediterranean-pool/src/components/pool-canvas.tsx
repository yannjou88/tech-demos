"use client";

import { useEffect, useRef, useState } from "react";
import type { PoolHandle } from "@/pool/create-pool";

export function PoolCanvas({ onReady }: { onReady: (handle: PoolHandle | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onReadyRef = useRef(onReady);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let handle: PoolHandle | null = null;
    let cancelled = false;

    void import("@/pool/create-pool")
      .then(({ createPool }) => {
        if (cancelled) return;
        handle = createPool(canvas);
        onReadyRef.current(handle);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFailed(true);
        console.error(
          JSON.stringify({
            message: "pool failed to start",
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      });

    return () => {
      cancelled = true;
      handle?.dispose();
      onReadyRef.current(null);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        aria-label="Mediterranean pool. Tap to drop a flower, drag a flower to push it under, or drag in a circle to stir a whirlpool."
      />
      {failed ? (
        <p className="absolute inset-x-0 bottom-8 text-center text-sm text-white">
          WebGL is required to show the pool.
        </p>
      ) : null}
    </>
  );
}
