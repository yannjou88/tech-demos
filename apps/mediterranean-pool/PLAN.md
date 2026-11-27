# Mediterranean Pool

## Goal

A single calm screen: a sunlit Mediterranean pool you can touch, with water that actually moves.

## Single-user MVP

One full-viewport WebGL scene and nothing else. No accounts, no settings, no network.

- Angled top-down view of a blue mosaic pool, stone coping, and a warm deck. The water fills most of the frame on both phone and desktop.
- GPU heightfield water (ping-pong render targets): ripples from taps and drags, refraction of the tiled floor, sky reflections, a sun glint, and caustic light on the floor that clusters where the surface focuses it.
- Soft palm-frond shadows drifting across the water and the deck.
- Flowers (hibiscus and bougainvillea). Tap or click empty water to drop one; it floats and drifts with the waves. Press-and-hold or drag a flower to push it under; release and it springs back with a splash. Drag in a circle on open water to stir a whirlpool that pulls floating flowers into a swirl.
- Pointer events for mouse and touch, with a larger grab radius on coarse pointers. The page does not scroll while you play.
- Chrome: small title, the hint “Tap to drop flowers - drag to stir”, and a Reset button that restores the opening flowers and still water.
- Pixel ratio capped (about 1.25 on phones, 1.5 on desktop) and a smaller simulation grid on coarse pointers, so a mid-range phone can hold 60fps.
- English only.

## Out of scope

WebGPU (the sim is the classic WebGL render-target technique; a second backend is a way to miss the phone budget). Audio. Flower types beyond the painted set. Multiplayer. Any API, key, or sign-in. Next.js Cache Components and `partialPrefetching` (they hang on Workers).

## Tasks

1. Scaffold Next.js (App Router, Tailwind, `src/`) with `bunx create-next-app`, `bunfig.toml` written before `bun install`, then shadcn/ui (nova) for the reset button.
2. Pure logic with tests: tap versus drag, circular-stir detection, flower spring and whirlpool advection, and a tiny CPU heightfield used only so flowers can drift with the same impulses the GPU sees.
3. three.js scene: pool geometry and tile/deck shaders, GPU sim, caustic splat, refraction pass, palm shadow, instanced flowers, pointer loop.
4. Wire the client-only canvas into the page (`ssr: false` so three.js stays out of the Worker bundle). Add OpenNext + `wrangler.jsonc` (`name`: `mediterranean-pool`) with no paid bindings.
5. App README, one root Demos row, and the tracking entries.

## Stack

- Bun — runtime, package manager, and test runner for this repo.
- Next.js App Router — one static page the Worker can serve; the toy itself is client-side.
- shadcn/ui nova — one button, same minimalist preset as the other demo.
- three.js WebGL — heightfield sim, caustics, and the pool. No React Three Fiber; the ping-pong loop is clearer in a single render function.
- `@opennextjs/cloudflare` + Wrangler — Workers deploy path. No R2, no image binding, no Cache Components. Observability logs and traces on, traces sampled.
- `bun:test` — gesture classification, flower motion, and wave damping only.

## Deferred

- WebGPU — same look, extra risk, no MVP benefit.
- A second CPU readback of the GPU heightfield — a low-resolution CPU mirror stays in sync because both receive the same impulses, and flower height on screen is sampled from the GPU texture in the vertex shader.
- Git hooks — `bun test` is enough.
