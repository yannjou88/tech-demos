import { PDFDocument, degrees } from "pdf-lib";
import { placeMark } from "./geometry";
import { dataUrlToBytes, type FlattenMark } from "./png";

export async function flattenPdf(
  input: Uint8Array,
  marks: FlattenMark[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(input);
  const pageCount = doc.getPageCount();

  for (const mark of marks) {
    if (mark.pageIndex < 0 || mark.pageIndex >= pageCount) continue;
    const page = doc.getPage(mark.pageIndex);
    const box = page.getMediaBox();
    const placement = placeMark(mark, {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      rotation: page.getRotation().angle,
    });
    const image = await doc.embedPng(dataUrlToBytes(mark.pngDataUrl));
    page.drawImage(image, {
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      rotate: degrees(placement.rotate),
    });
  }

  return doc.save();
}
