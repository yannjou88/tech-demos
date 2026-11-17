export const INKS = [
  { id: "black", hex: "#1c1917", zh: "黑色", en: "Black" },
  { id: "blue", hex: "#1d4e89", zh: "蓝色", en: "Blue" },
  { id: "red", hex: "#b42318", zh: "红色", en: "Red" },
] as const;

export type InkId = (typeof INKS)[number]["id"];

export const HANDWRITING_FONTS = [
  {
    id: "ma-shan-zheng",
    family: "Ma Shan Zheng",
    zh: "毛笔",
    en: "Brush",
  },
  { id: "caveat", family: "Caveat", zh: "手写", en: "Hand" },
  {
    id: "dancing-script",
    family: "Dancing Script",
    zh: "花体",
    en: "Script",
  },
] as const;

export type FontId = (typeof HANDWRITING_FONTS)[number]["id"];

export function inkHex(id: InkId): string {
  return INKS.find((ink) => ink.id === id)?.hex ?? INKS[0].hex;
}

export function fontFamily(id: FontId): string {
  return HANDWRITING_FONTS.find((font) => font.id === id)?.family ?? HANDWRITING_FONTS[0].family;
}

export async function loadHandwritingFonts(): Promise<void> {
  await Promise.all([
    document.fonts.load("72px 'Ma Shan Zheng'"),
    document.fonts.load("72px Caveat"),
    document.fonts.load("72px 'Dancing Script'"),
    document.fonts.load("700 80px 'Noto Sans'"),
  ]);
}

export type Raster = {
  dataUrl: string;
  bitmapAspect: number;
};

function canvasResult(canvas: HTMLCanvasElement): Raster {
  return {
    dataUrl: canvas.toDataURL("image/png"),
    bitmapAspect: canvas.width / canvas.height,
  };
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const char of paragraph) {
      const next = line + char;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = char;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines.length > 0 ? lines : [""];
}

export async function renderTextStamp(options: {
  text: string;
  fontFamily: string;
  color: string;
  fontSize?: number;
  maxWidth?: number;
  background?: boolean;
}): Promise<Raster> {
  await loadHandwritingFonts();
  const fontSize = options.fontSize ?? 72;
  const maxWidth = options.maxWidth ?? 720;
  const padding = options.background ? 28 : 12;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.font = `${fontSize}px "${options.fontFamily}"`;
  const lines = wrapText(ctx, options.text.trim(), maxWidth);
  const lineHeight = fontSize * 1.25;
  const textWidth = Math.max(...lines.map((line) => ctx.measureText(line || " ").width), 40);
  canvas.width = Math.ceil(textWidth + padding * 2);
  canvas.height = Math.ceil(lines.length * lineHeight + padding * 2);
  if (options.background) {
    ctx.fillStyle = "rgba(255,252,247,0.94)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.font = `${fontSize}px "${options.fontFamily}"`;
  ctx.fillStyle = options.color;
  ctx.textBaseline = "top";
  lines.forEach((line, index) => {
    ctx.fillText(line, padding, padding + index * lineHeight);
  });
  return canvasResult(canvas);
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  points: number,
) {
  ctx.beginPath();
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / points;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function sealRingFont(character: string): string {
  return /[\u3400-\u9fff]/.test(character)
    ? "86px 'Ma Shan Zheng'"
    : "700 80px 'Noto Sans', 'Liberation Sans', sans-serif";
}

export async function renderSeal(center: string, ring: string): Promise<Raster> {
  await loadHandwritingFonts();
  const size = 640;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const cx = size / 2;
  const cy = size / 2;
  const ink = "#b42318";
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(cx, cy, 286, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 266, 0, Math.PI * 2);
  ctx.stroke();

  const ringText = (ring.trim() || "APPROVED").slice(0, 18);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const radius = 236;
  const widths = [...ringText].map((character) => {
    ctx.font = sealRingFont(character);
    return ctx.measureText(character).width;
  });
  const gap = 14;
  const total =
    widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(widths.length - 1, 0);
  let cursor = -total / 2;
  ringText.split("").forEach((character, index) => {
    const width = widths[index] ?? 0;
    const mid = cursor + width / 2;
    const angle = -Math.PI / 2 + mid / radius;
    ctx.save();
    ctx.translate(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    ctx.rotate(angle + Math.PI / 2);
    ctx.font = sealRingFont(character);
    ctx.fillText(character, 0, 0);
    ctx.restore();
    cursor += width + gap;
  });

  const label = (center.trim() || "已签").slice(0, 4);
  ctx.font = `${label.length > 2 ? 72 : 108}px 'Ma Shan Zheng'`;
  ctx.fillText(label, cx, cy + 36);
  drawStar(ctx, cx, cy + 118, 16, 7, 5);
  return canvasResult(canvas);
}

export async function imageFileToPng(file: File): Promise<Raster> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = dataUrl;
  });
  const max = 1400;
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvasResult(canvas);
}
