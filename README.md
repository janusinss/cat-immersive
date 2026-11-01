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

The production site is generated in `dist/`. Serve that folder through a static web host; the current asset URLs expect the site at the domain root.

## Stack

React, TypeScript, Vite, GSAP, Lenis, WebGL, and Canvas2D. Fonts and media are served locally. Reduced motion disables spatial effects, and the liquid renderer has mobile and unavailable-GPU fallbacks.

## Media

`VIDEO.mp4` preserves the supplied source. The desktop and mobile files in `public/` are seek-friendly derivatives; the atmosphere stills come from the same footage. Media rights remain with their respective owners. No additional media license is granted by this repository.

The app downloads its selected video into a browser-local Blob URL before enabling playback. This keeps manual scrubbing seekable on static hosts that ignore HTTP byte-range requests. The poster remains visible during loading; failed downloads can be retried. Downloads are cancelled and Blob URLs released when replaced or unmounted.

Touch devices use native scrolling. Text remains scrollable before video decoding, including with reduced motion enabled. Mobile uses a 640px, 2.94 MB all-intra derivative at the original 24fps and 1x speed. Download progress appears when the host supplies a content length; download and metadata preparation each have a 30-second retry timeout. Metadata enables user-initiated playback without depending on mobile browsers firing `loadeddata`.

Project design and behavior decisions are documented in `DESIGN.md` and `PRODUCT.md`.
