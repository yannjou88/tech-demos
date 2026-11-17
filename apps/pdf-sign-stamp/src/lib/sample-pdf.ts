import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { dataUrlToBytes } from "./png";
import { loadHandwritingFonts } from "./raster";

export async function buildSamplePdf(): Promise<{ name: string; bytes: Uint8Array }> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.16, 0.13, 0.1);

  await loadHandwritingFonts();
  const header = document.createElement("canvas");
  header.width = 900;
  header.height = 160;
  const ctx = header.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#1c1917";
    ctx.font = "96px 'Ma Shan Zheng'";
    ctx.textBaseline = "middle";
    ctx.fillText("订单确认", 8, 80);
    const png = await doc.embedPng(dataUrlToBytes(header.toDataURL("image/png")));
    page.drawImage(png, { x: 48, y: 750, width: 280, height: 50 });
  }

  page.drawText("Order confirmation", {
    x: 48,
    y: 720,
    size: 16,
    font: bold,
    color: ink,
  });
  page.drawText("Etsy digital download  ·  printable planner", {
    x: 48,
    y: 690,
    size: 12,
    font,
    color: ink,
  });

  const rows = [
    ["Item", "Sunday planner, 12 pages"],
    ["Buyer", ""],
    ["Shop", ""],
  ];
  rows.forEach((row, index) => {
    const y = 620 - index * 48;
    page.drawText(row[0] ?? "", { x: 48, y, size: 12, font: bold, color: ink });
    page.drawLine({
      start: { x: 140, y: y - 4 },
      end: { x: 520, y: y - 4 },
      thickness: 0.6,
      color: rgb(0.55, 0.48, 0.4),
    });
    if (row[1]) {
      page.drawText(row[1], { x: 148, y, size: 12, font, color: ink });
    }
  });

  page.drawText("Sign above the line", {
    x: 48,
    y: 180,
    size: 12,
    font,
    color: ink,
  });
  page.drawLine({
    start: { x: 48, y: 160 },
    end: { x: 320, y: 160 },
    thickness: 0.8,
    color: ink,
  });

  return { name: "order-confirmation.pdf", bytes: await doc.save() };
}
