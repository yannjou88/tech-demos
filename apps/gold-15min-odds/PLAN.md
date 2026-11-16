# Gold 15-minute odds

## Goal

A read-only board for one trader in Malaysia: will gold or silver finish the current 15-minute Polymarket round up or down?

## Single-user MVP

- One dark screen, readable on a phone, Simplified Chinese labels with small English sublabels. Times in Asia/Kuala_Lumpur.
- Gold / silver toggle.
- Current round: countdown to the window end, Up % vs Down % bar, and the round's start reference price (price to beat).
- Last 10 settled rounds as Up/Down chips, plus the current streak.
- A small spot line for the open round when public price history is available.
- Server route reads public Polymarket APIs and the page polls it about every 10 seconds. If the active round cannot be found or a request fails, the whole board switches to a deterministic mock feed and shows a 演示数据 / Demo data badge.
- Footer: 仅供参考，不构成投资建议 / for information only.

## Out of scope

Placing bets, wallets, accounts, alerts, history past 10 rounds, assets other than gold and silver, a theme toggle.

## Tasks

1. Scaffold Next.js (App Router) and shadcn/ui. Write `bunfig.toml` before `bun install`.
2. Pure market math with tests: 15-minute window, event slug, book midpoint, percent split, settled result, streak, Kuala Lumpur labels.
3. Live loader (Gamma event by slug, closed series for recent rounds, CLOB book for odds, public asset-price history for the spot line) and a seeded mock feed. One function picks live vs demo.
4. `GET /api/board` plus the single screen. The countdown ticks every second on the client; data refreshes every 10 seconds.
5. App README (Chinese and English), one root Demos row, and the tracking entries.

## Stack

- Bun — runtime, package manager, and test runner for this repo.
- Next.js App Router — one screen and a route handler, so the browser never calls Polymarket and CORS is not an issue.
- shadcn/ui `nova` (style `base-nova`) — neutral Geist preset from `bunx shadcn@latest init --preset nova` (badge, card, toggle, separator).
- Gamma `GET /events/slug/{xau|xag}-updown-15m-{unix}` — public discovery. Windows are unix time floored to 900 seconds. Series `gold-up-or-down-15m` (id 12967) and `silver-up-or-down-15m` (id 12968) supply the last settled rounds.
- CLOB `GET /book?token_id=` — public best bid and best ask. The displayed odds are the midpoint of each outcome, normalized to 100%. Gamma `outcomePrices` is the fallback quote if a book is empty.
- `GET https://gateway.polymarket.us/v1/asset-prices/history` — public, no key. Chainlink XAU/USD and XAG/USD candles (`commodity:gold`, `commodity:silver`, 15-second buckets) for the spot line. If this call fails, the rest of a live board still renders and the chart is omitted.
- `bun:test` — parsers, streak, fallback choice, and mock determinism only.

## Deferred

- Orders, accounts, alerts, and other assets — not on the path to a one-screen read-only board.
- Git hooks — `bun test` is enough for this demo.
- A chart library — the spot series is one SVG polyline.
