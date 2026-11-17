# 签字盖章

在浏览器里打开一份 PDF，手写或打字签名，盖上日期和红色圆章，然后下载一份已经压平的文件。没有账号，文件也不会上传。

界面是简体中文，每条说明下面有一行英文。适合在手机和电脑上用。

文件一直留在这台设备上。这是方便用的小工具，不是有法律认证效力的电子签名服务。

## 运行

```bash
cd apps/pdf-sign-stamp
bun install
bun run dev
```

浏览器打开 http://localhost:3000 。点「试试示例订单」可以不上传文件就走一遍。逻辑测试：`bun test`。

不需要密钥。签名字体（Caveat、Dancing Script、Ma Shan Zheng）和印章上的拉丁字母（Noto Sans）都是 OFL，打进应用里。pdf.js 的 worker、标准字体、cmap 和 wasm 在 `dev` / `build` 时从 `pdfjs-dist` 复制到 `public/pdfjs/`，这样 Cloudflare Workers 的静态资源里也有这些文件。

## 部署到 Cloudflare Workers

Worker 名称是 `pdf-sign-stamp`。本机需要已经登录 Wrangler（`bunx wrangler login`）。

```bash
cd apps/pdf-sign-stamp
bun install
bun run deploy
```

只构建、不发布：`bun run preview`。它会先复制 pdf.js 资源，再跑 `opennextjs-cloudflare build`。没有开启 `cacheComponents` 或 `partialPrefetching`。

# Sign and stamp

Open a PDF in the browser, draw or type a signature, add a date and a round red seal, then download a flattened file. There is no account, and the file is never uploaded.

Labels are Simplified Chinese with a short English line under each one. The layout works on a phone and on a desktop.

Files stay on this device. This is a convenience tool, not a certified e-signature service.

## Run

```bash
cd apps/pdf-sign-stamp && bun install && bun run dev
```

Open http://localhost:3000. "Try a sample order" walks through the demo without an upload. Tests: `bun test`.

No secrets. The handwriting fonts (Caveat, Dancing Script, Ma Shan Zheng) and the Latin letters on the seal (Noto Sans) are OFL and bundled. The pdf.js worker, standard fonts, cmaps, and wasm are copied from `pdfjs-dist` into `public/pdfjs/` on `dev` and `build`, so the Workers asset bundle can serve them.

## Deploy

The worker name is `pdf-sign-stamp`. Wrangler must already be logged in (`bunx wrangler login`).

```bash
cd apps/pdf-sign-stamp && bun install && bun run deploy
```

`bun run preview` copies the pdf.js assets and runs `opennextjs-cloudflare build` without deploying. `cacheComponents` and `partialPrefetching` stay off.
