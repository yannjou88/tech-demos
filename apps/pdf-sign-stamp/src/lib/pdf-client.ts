import type { PDFDocumentProxy } from "pdfjs-dist";

export const PDFJS_ASSET = "/pdfjs";

export async function openPdf(bytes: Uint8Array): Promise<{
  pdf: PDFDocumentProxy;
  pageCount: number;
  close: () => Promise<void>;
}> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_ASSET}/pdf.worker.min.mjs`;
  pdfjs.GlobalWorkerOptions.rendererSrc = `${PDFJS_ASSET}/pdf.renderer.min.mjs`;
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    standardFontDataUrl: `${PDFJS_ASSET}/standard_fonts/`,
    cMapUrl: `${PDFJS_ASSET}/cmaps/`,
    cMapPacked: true,
    wasmUrl: `${PDFJS_ASSET}/wasm/`,
  });
  const pdf = await task.promise;
  return {
    pdf,
    pageCount: pdf.numPages,
    close: () => task.destroy(),
  };
}

export function pdfErrorMessage(error: unknown): { zh: string; en: string } {
  const name = error instanceof Error ? error.name : "";
  if (name === "PasswordException") {
    return {
      zh: "这个 PDF 有密码，打不开。",
      en: "This PDF is password-protected.",
    };
  }
  if (name === "InvalidPDFException") {
    return {
      zh: "这不是一份能打开的 PDF。",
      en: "This file is not a PDF we can open.",
    };
  }
  return {
    zh: "打不开这份 PDF。换一份试试。",
    en: "Could not open this PDF. Try another file.",
  };
}
