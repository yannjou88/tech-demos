import { describe, expect, test } from "bun:test";
import { PDFDocument, degrees } from "pdf-lib";
import { flattenPdf } from "./flatten";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function paintCount(bytes: Uint8Array): Promise<number> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = import.meta.resolve(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
  );
  const loaded = await pdfjs
    .getDocument({
      data: bytes,
      useWasm: false,
      isOffscreenCanvasSupported: false,
      disableFontFace: true,
    })
    .promise;
  const page = await loaded.getPage(1);
  const ops = await page.getOperatorList();
  const paint = new Set([
    pdfjs.OPS.paintImageXObject,
    pdfjs.OPS.paintImageXObjectRepeat,
  ]);
  return ops.fnArray.filter((fn: number) => paint.has(fn)).length;
}

describe("flattenPdf", () => {
  test("draws each mark as an image", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 200]);
    page.setRotation(degrees(90));
    const input = await doc.save();
    const output = await flattenPdf(input, [
      { pageIndex: 0, x: 0.1, y: 0.2, w: 0.25, h: 0.12, pngDataUrl: PNG },
      { pageIndex: 0, x: 0.5, y: 0.5, w: 0.2, h: 0.2, pngDataUrl: PNG },
    ]);
    expect(await paintCount(output)).toBe(2);
  });
});
