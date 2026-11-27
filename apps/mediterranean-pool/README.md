# Mediterranean Pool

A sunlit pool you can touch. Tap the water to drop a hibiscus or bougainvillea. Press and hold a flower to push it under — it bobs back up. Drag in a circle to stir a whirlpool that pulls the flowers into a swirl.

The water is a GPU heightfield: ripples, refraction, reflections, caustics on the tiles, and palm shadows drifting across the surface. Nothing is fetched. There is no account and no API key.

```bash
bun install
bun run dev
```

Open the URL Bun prints (usually http://localhost:3000).

## Cloudflare Workers

The app is set up for [OpenNext](https://opennext.js.org/cloudflare) on the Workers free plan. The worker name is `mediterranean-pool`. The page is a static shell; the pool runs in the browser, so the worker does not need R2, KV, or an image binding. Cache Components and `partialPrefetching` are left off because they hang on Workers.

```bash
bun run preview   # build and serve in workerd
bun run deploy    # needs a logged-in Wrangler
```

## Tests

```bash
bun test
```

Gesture classification, flower motion, and the small CPU wave mirror.
