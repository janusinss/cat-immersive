# cat-immersive

A cinematic cat film with scroll-driven storytelling, word-specific GSAP animations, a liquid surround, and optional automatic playback.

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Scroll to explore immediately, or select **Start experience** for automatic playback at normal 1x speed. Scroll, tap the film, or press Escape to return to manual control.

## Verify and build

```sh
npm test
npm run build
npm run preview
```

The production site is generated in `dist/`. Deploy it to Cloudflare Pages with the included `_worker.js` and `_routes.json`; production video URLs require that worker. `npm run dev` uses direct local media. Plain `vite preview` serves the UI but does not execute the Cloudflare worker.

## Stack

React, TypeScript, Vite, GSAP, Lenis, WebGL, and Canvas2D. Fonts and media are served locally. Reduced motion disables spatial effects, and the liquid renderer has mobile and unavailable-GPU fallbacks.

## Media

`VIDEO.mp4` preserves the supplied source. The desktop and mobile files in `public/` are seek-friendly derivatives; the atmosphere stills come from the same footage. Media rights remain with their respective owners. No additional media license is granted by this repository.

Production uses native MP4 URLs under `/media/`. The Pages worker explicitly returns HTTP 206 with correct byte ranges, even when the underlying static asset ignores Range requests. The browser no longer waits for a JavaScript Blob download. The handler allowlists two film files and buffers at most 20 MiB per request; concurrent range requests increase memory and asset reads.

Touch devices use native scrolling. Text remains scrollable before video decoding, including with reduced motion enabled. Mobile uses the 640px H.264 Constrained Baseline film at its original 24fps and 1x speed. The load/start button remains available before metadata to permit a browser-required user gesture. Metadata preparation has a 30-second retry timeout; pending playback has a 15-second recovery timeout.

Project design and behavior decisions are documented in `DESIGN.md` and `PRODUCT.md`.
