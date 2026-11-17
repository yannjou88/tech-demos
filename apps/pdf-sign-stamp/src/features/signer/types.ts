export type MarkKind = "signature" | "date" | "name" | "text" | "seal";

export type Draft = {
  kind: MarkKind;
  dataUrl: string;
  bitmapAspect: number;
  lockAspect: boolean;
};

export type Mark = Draft & {
  id: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
};
