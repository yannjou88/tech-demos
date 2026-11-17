export type SavedSignature = {
  id: string;
  dataUrl: string;
  createdAt: string;
};

const KEY = "pdf-sign-stamp.signatures";
const MAX_SAVED = 8;

export function loadSignatures(storage: Storage): SavedSignature[] {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedSignature[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.dataUrl === "string" &&
        item.dataUrl.startsWith("data:image/png"),
    );
  } catch {
    return [];
  }
}

export function rememberSignature(
  storage: Storage,
  item: SavedSignature,
): SavedSignature[] {
  const next = [item, ...loadSignatures(storage).filter((saved) => saved.id !== item.id)].slice(
    0,
    MAX_SAVED,
  );
  storage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearSignatures(storage: Storage): void {
  storage.removeItem(KEY);
}
