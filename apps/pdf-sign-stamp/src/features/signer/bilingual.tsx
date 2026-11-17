export function Pair({ zh, en }: { zh: string; en: string }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      <span>{zh}</span>
      <span className="text-[0.72em] font-normal text-muted-foreground">{en}</span>
    </span>
  );
}

export function Stack({ zh, en }: { zh: string; en: string }) {
  return (
    <span className="flex flex-col items-start leading-tight">
      <span>{zh}</span>
      <span className="text-xs font-normal text-muted-foreground">{en}</span>
    </span>
  );
}
