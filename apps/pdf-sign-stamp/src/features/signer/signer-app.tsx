"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { Pair, Stack } from "@/features/signer/bilingual";
import { PageStage } from "@/features/signer/page-stage";
import { ToolPanel } from "@/features/signer/tool-panel";
import type { Draft, Mark } from "@/features/signer/types";
import { signedFileName } from "@/lib/filename";
import { flattenPdf } from "@/lib/flatten";
import { markSize } from "@/lib/geometry";
import { openPdf, pdfErrorMessage } from "@/lib/pdf-client";
import { buildSamplePdf } from "@/lib/sample-pdf";
import { loadSignatures, type SavedSignature } from "@/lib/storage";
import { Download, LockKeyhole, ShieldAlert } from "lucide-react";

type OpenDoc = {
  name: string;
  bytes: Uint8Array;
  pdf: PDFDocumentProxy;
  pageCount: number;
  close: () => Promise<void>;
};

type Notice = { zh: string; en: string };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function Thumbnail({
  pdf,
  pageNumber,
  active,
  onPick,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  active: boolean;
  onPick: (page: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    void (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: 112 / base.width });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        task = page.render({ canvas, canvasContext: ctx, viewport });
        await task.promise;
      } catch {
        // A cancelled thumbnail render is expected when the file changes.
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNumber]);

  return (
    <button
      type="button"
      onClick={() => onPick(pageNumber)}
      className={`shrink-0 rounded-lg border bg-white p-1 ${active ? "ring-2 ring-primary" : ""}`}
      aria-current={active}
    >
      <canvas ref={canvasRef} className="h-auto w-14 md:w-full" />
      <span className="mt-1 block text-center text-xs">{pageNumber}</span>
    </button>
  );
}

export function SignerApp() {
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<OpenDoc | null>(null);
  const [doc, setDoc] = useState<OpenDoc | null>(null);
  const [page, setPage] = useState(1);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<SavedSignature[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggingFile, setDraggingFile] = useState(false);

  useEffect(() => {
    // localStorage is empty during SSR. Read it after mount so the saved
    // signatures match this browser without a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only storage
    setSaved(loadSignatures(localStorage));
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (!selectedId) return;
      event.preventDefault();
      setMarks((current) => current.filter((mark) => mark.id !== selectedId));
      setSelectedId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  async function openBytes(name: string, bytes: Uint8Array) {
    setOpening(true);
    setNotice(null);
    try {
      const opened = await openPdf(bytes);
      void docRef.current?.close();
      const next = { name, bytes, ...opened };
      docRef.current = next;
      setDoc(next);
      setPage(1);
      setMarks([]);
      setSelectedId(null);
      setDraft(null);
    } catch (error) {
      setNotice(pdfErrorMessage(error));
    } finally {
      setOpening(false);
    }
  }

  async function openFile(file: File) {
    const looksPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!looksPdf) {
      setNotice({ zh: "请选择 PDF 文件。", en: "Please choose a PDF file." });
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    await openBytes(file.name, bytes);
  }

  function placeAt(x: number, y: number, pageAspect: number) {
    if (!draft) return;
    const target = draft.kind === "seal" ? 0.26 : draft.kind === "signature" ? 0.3 : 0.28;
    const size = markSize(draft.bitmapAspect, pageAspect, target);
    const id = crypto.randomUUID();
    const mark: Mark = {
      ...draft,
      id,
      page,
      x: clamp(x - size.w / 2, 0, 1 - size.w),
      y: clamp(y - size.h / 2, 0, 1 - size.h),
      w: size.w,
      h: size.h,
    };
    setMarks((current) => [...current, mark]);
    setSelectedId(id);
    setDraft(null);
  }

  async function download() {
    if (!doc || marks.length === 0) return;
    setSaving(true);
    setNotice(null);
    try {
      const bytes = await flattenPdf(
        doc.bytes,
        marks.map((mark) => ({
          pageIndex: mark.page - 1,
          x: mark.x,
          y: mark.y,
          w: mark.w,
          h: mark.h,
          pngDataUrl: mark.dataUrl,
        })),
      );
      const copy = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(copy).set(bytes);
      const url = URL.createObjectURL(new Blob([copy], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = signedFileName(doc.name);
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setNotice({
        zh: "没能生成 PDF。再试一次。",
        en: "Could not build the PDF. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="flex h-dvh flex-col"
      onDragOver={(event) => {
        event.preventDefault();
        setDraggingFile(true);
      }}
      onDragLeave={() => setDraggingFile(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDraggingFile(false);
        const file = event.dataTransfer.files[0];
        if (file) void openFile(file);
      }}
    >
      <header className="flex flex-col gap-2 border-b bg-card px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <Pair zh="签字盖章" en="Sign and stamp" />
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm">
            <LockKeyhole className="size-4 shrink-0" aria-hidden />
            <Pair zh="文件不会离开你的设备" en="Files never leave your device" />
          </p>
        </div>
        <Button
          type="button"
          className="h-12 px-4"
          data-testid="download"
          disabled={!doc || marks.length === 0 || saving}
          onClick={() => void download()}
        >
          <Download />
          <Pair
            zh={saving ? "正在生成" : "下载已签 PDF"}
            en={saving ? "Preparing" : "Download signed PDF"}
          />
        </Button>
      </header>

      {notice ? (
        <p className="bg-destructive/10 px-4 py-2 text-sm text-destructive" role="status">
          {notice.zh} / {notice.en}
        </p>
      ) : null}
      {draft ? (
        <p className="bg-primary/10 px-4 py-2 text-sm" data-testid="armed-banner" role="status">
          <Pair zh="点一下页面，放在你想要的位置" en="Tap the page where you want it" />
          <button type="button" className="ml-3 underline" onClick={() => setDraft(null)}>
            取消 / Cancel
          </button>
        </p>
      ) : null}

      {!doc ? (
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-8">
          <label
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-3xl border-2 border-dashed bg-card px-6 py-16 text-center ${draggingFile ? "border-primary" : "border-foreground/20"}`}
          >
            <input
              ref={fileRef}
              data-testid="upload-input"
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void openFile(file);
              }}
            />
            <Stack zh="把 PDF 拖到这里" en="Drop a PDF here" />
            <span className="text-sm text-muted-foreground">或点一下选择 / or tap to choose</span>
            {opening ? <span className="text-sm">正在打开 / Opening…</span> : null}
          </label>
          <Button
            type="button"
            variant="outline"
            className="h-12"
            data-testid="sample-pdf"
            disabled={opening}
            onClick={() => {
              void (async () => {
                setOpening(true);
                try {
                  const sample = await buildSamplePdf();
                  await openBytes(sample.name, sample.bytes);
                } catch {
                  setNotice({
                    zh: "示例文件没能生成。",
                    en: "Could not create the sample.",
                  });
                  setOpening(false);
                }
              })();
            }}
          >
            <Pair zh="试试示例订单" en="Try a sample order" />
          </Button>
        </main>
      ) : (
        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_minmax(0,42dvh)] md:grid-cols-[22rem_minmax(0,1fr)_6.5rem] md:grid-rows-1">
          <aside className="flex gap-2 overflow-x-auto border-b p-2 md:col-start-3 md:row-start-1 md:flex-col md:overflow-y-auto md:overflow-x-hidden md:border-b-0 md:border-l">
            {Array.from({ length: doc.pageCount }, (_, index) => (
              <Thumbnail
                key={index + 1}
                pdf={doc.pdf}
                pageNumber={index + 1}
                active={page === index + 1}
                onPick={setPage}
              />
            ))}
          </aside>
          <section className="flex min-h-0 flex-col gap-3 overflow-auto p-3 md:col-start-2 md:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                第 {page} / {doc.pageCount} 页
                <span className="ml-2 text-muted-foreground">Page {page} of {doc.pageCount}</span>
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  <Pair zh="上一页" en="Previous" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  disabled={page >= doc.pageCount}
                  onClick={() => setPage((current) => current + 1)}
                >
                  <Pair zh="下一页" en="Next" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => fileRef.current?.click()}
                >
                  <Pair zh="换一份" en="Replace" />
                </Button>
              </div>
            </div>
            {opening ? <p className="text-sm">正在打开 / Opening…</p> : null}
            <PageStage
              pdf={doc.pdf}
              pageNumber={page}
              marks={marks}
              selectedId={selectedId}
              armed={draft !== null}
              onPlace={placeAt}
              onSelect={setSelectedId}
              onChange={(id, next) => {
                setMarks((current) =>
                  current.map((mark) => (mark.id === id ? { ...mark, ...next } : mark)),
                );
              }}
              onDelete={(id) => {
                setMarks((current) => current.filter((mark) => mark.id !== id));
                setSelectedId((current) => (current === id ? null : current));
              }}
            />
            {marks.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                做好签名或印章，再点页面放上去。 / Make a signature or stamp, then tap the page.
              </p>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                已放 {marks.length} 处。拖动可以移动，角上的圆点可以改大小。 / {marks.length} placed.
                Drag to move, use the corner dots to resize.
              </p>
            )}
            <input
              ref={fileRef}
              data-testid="upload-input"
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void openFile(file);
              }}
            />
          </section>
          <aside className="overflow-y-auto border-t bg-card md:col-start-1 md:row-start-1 md:border-t-0 md:border-r">
            <ToolPanel saved={saved} onSaved={setSaved} onDraft={setDraft} />
          </aside>
        </div>
      )}

      <footer className="flex items-start gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          这是方便用的小工具，不是有法律认证效力的电子签名服务。
          <span className="mt-0.5 block text-xs">
            A convenience tool, not a certified e-signature service.
          </span>
        </p>
      </footer>
    </div>
  );
}
