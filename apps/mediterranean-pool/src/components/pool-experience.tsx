"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { PoolCanvas } from "@/components/pool-canvas";
import type { PoolHandle } from "@/pool/create-pool";

export function PoolExperience() {
  const pool = useRef<PoolHandle | null>(null);

  return (
    <div className="pool-root relative h-full w-full overflow-hidden select-none">
      <PoolCanvas onReady={(handle) => { pool.current = handle; }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="min-w-0 rounded-md bg-[#12343f]/45 px-2.5 py-1.5 backdrop-blur-[2px]">
          <h1 className="font-[Iowan_Old_Style,Palatino,Palatino_Linotype,Georgia,serif] text-[1.02rem] leading-tight tracking-wide text-white">
            Mediterranean Pool
          </h1>
          <p className="mt-0.5 text-[12px] text-white/92">
            Tap to drop flowers - drag to stir
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="pointer-events-auto border-white/45 bg-[#12343f]/50 text-white backdrop-blur-sm hover:bg-[#12343f]/70 hover:text-white"
          onClick={() => pool.current?.reset()}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
