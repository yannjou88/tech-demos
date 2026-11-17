export function signedFileName(original: string): string {
  const trimmed = original.trim() || "document.pdf";
  const base = trimmed.replace(/\.pdf$/i, "");
  return `${base}-signed.pdf`;
}
