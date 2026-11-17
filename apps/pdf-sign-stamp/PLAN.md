# PDF sign & stamp

## Goal

One person can open a PDF in the browser, put a signature and a few stamps on it, and download a flattened copy, without an account or a server.

## Single-user MVP

CJ sells digital products on Etsy, speaks Chinese, and switches between phone and desktop. The screen is Simplified Chinese first, with a short English line under each label.

- Drop or pick a PDF. Render pages with pdf.js, plus thumbnails and previous / next.
- Make a signature by drawing (mouse and touch), typing with a handwriting font, or uploading a PNG. Ink is black, blue, or red.
- Stamps: today's date (several formats), the signer's name, a short text box, and a round red seal that reads 已签 / APPROVED.
- Tap a page to drop the current item, then drag to move and resize. Delete an item.
- Download `<original>-signed.pdf`. pdf-lib draws the marks as images, so the file is flat.
- Optional: keep signatures in localStorage, with one button that clears them all.
- A visible note: files never leave this device. A short disclaimer: this is a convenience tool, not a certified e-signature service.
- A "try a sample" button builds a one-page order PDF in the browser, so the demo needs no upload.

## Out of scope

Accounts, email, audit logs, certificates, password-protected PDFs, multi-party signing, form filling, cloud storage, and any backend. This is not a SignuDoc clone.

## Tasks

1. Scaffold Next.js from `create-next-app` and shadcn/ui. `bunfig.toml` exists before `bun install`. Add OpenNext and `wrangler.jsonc` with worker name `pdf-sign-stamp`. Do not enable `cacheComponents` or `partialPrefetching`.
2. Pure helpers with tests: signed file name, date formats, page-percent to PDF rectangle, and flatten (a mark becomes an image on the page).
3. Browser PDF session: load with pdf.js, copy `pdf.worker.min.mjs` into `public/` on dev and build, rasterize signatures and stamps to PNG, place them, save signatures locally, download the flat PDF.
4. One bilingual screen that works on a phone (bottom tools) and a desktop (side tools, page, thumbnails).
5. App README, one root Demos row, and the tracking entries (this candidate under proposed and approved; the Allo font post under skipped).
6. `opennextjs-cloudflare build` succeeds, and a real browser run uploads a PDF, draws and types a signature, adds a date, downloads, and the file contains the marks.

## Stack

- Bun — runtime, package manager, and test runner for this repo.
- Next.js App Router — one screen, official scaffold, same shape as the other demo. No route handlers; the PDF never goes to a server.
- shadcn/ui `nova` — buttons, dialogs, tabs, and inputs, then a warm paper theme on top.
- pdfjs-dist — page and thumbnail rendering. The matching worker file is served from `public/` so the Workers asset bundle includes it.
- pdf-lib — load the original PDF and draw PNG marks. No form fields, no reflow.
- @fontsource Caveat, Dancing Script, and Ma Shan Zheng — SIL Open Font License, bundled in the app, not loaded from a font CDN. Typed signatures and Chinese stamps are drawn on a canvas so the glyphs are baked into the PNG. The seal ring uses bundled Noto Sans Bold so the Latin letters stay readable at stamp size.
- @opennextjs/cloudflare + wrangler — `build` / `preview` / `deploy`. No R2 cache and no Images binding, because the app stores nothing and uses no `next/image` optimization.
- `bun:test` — file name, dates, geometry, and flatten only.

## Deferred

- Legal e-sign, certificates, and audit trails — a different product, and they need a server.
- Password-protected PDFs and AcroForm filling — not on the path to "stamp and download".
- Git hooks — `bun test` is enough for this demo.
- A drag-and-resize library — one pointer-events layer keeps touch and percentage coordinates in one place.
