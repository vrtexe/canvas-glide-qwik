# @canvas-glide/qwik

Pan, zoom and pinch-to-zoom for Qwik, built on [canvas-glide](https://github.com/vrtexe/canvas-glide): a `useGlide` hook that turns any element into a pan-and-zoom viewport and exposes the transform as signals, and a ready `GlideCanvas` image viewer.

[![npm version](https://img.shields.io/npm/v/@canvas-glide/qwik.svg?style=flat-square)](https://www.npmjs.com/package/@canvas-glide/qwik)
[![license](https://img.shields.io/npm/l/@canvas-glide/qwik.svg?style=flat-square)](LICENSE.md)

Everything a component receives is serializable, so pages render on the server and resume in the browser. The engine itself starts in the browser when the viewport becomes visible. The package targets Qwik 1 (`@builder.io/qwik`).

## Install

```sh
npm install @canvas-glide/qwik
```

`canvas-glide` is a dependency and installs with it. `@builder.io/qwik` is a peer dependency. List `@canvas-glide/qwik` in your app's `dependencies`, so that the Qwik Vite plugin bundles it with your app and both use one Qwik runtime.

## Image viewer

```tsx
import { component$, useSignal } from '@builder.io/qwik';
import { GlideCanvas, Renderer, useGlide } from '@canvas-glide/qwik';

export const Viewer = component$(() => {
  const glide = useGlide();
  const file = useSignal<File | null>(null);

  return (
    <>
      <input type="file" accept="image/*" onChange$={(_, input) => (file.value = input.files?.[0] ?? null)} />
      <button onClick$={() => glide.zoomIn$()}>+</button>
      <button onClick$={() => glide.zoomOut$()}>−</button>
      <button onClick$={() => glide.fit$()}>Fit</button>
      <span>{Math.round(glide.transform.value.scale * 100)}%</span>

      <div style={{ width: '800px', height: '500px' }}>
        <GlideCanvas glide={glide} image={file.value} renderer={Renderer.Image} />
      </div>
    </>
  );
});
```

`GlideCanvas` fills its parent, so the parent needs a size. At scale 1 the image is fitted inside the box with its aspect ratio kept, and a new image starts fitted. The image can be panned until it just leaves the box, and no further. Without a `glide` prop, `GlideCanvas` creates its own.

## useGlide

`useGlide(options?)` returns the state of one viewport:

| Member | Type | Meaning |
|---|---|---|
| `ref` | `Signal<Element \| undefined>` | Put it on the viewport element: `<div ref={glide.ref}>`. |
| `transform` | `Signal<Transform>` | The current `{ origin, scale }`, updated at most once per animation frame. |
| `moving` | `Signal<boolean>` | Whether a pointer drag is in progress. |
| `viewportSize` | `Signal<Size>` | The viewport element's size in CSS pixels. |
| `contentSize` | `Signal<Size \| null>` | The content's size at scale 1; `fit`, `center` and the default pan limit use it. You can assign it. |
| `engine` | `Signal<NoSerialize<CanvasEngine>>` | The underlying engine, set in the browser once the viewport is visible. |
| `zoomIn$`, `zoomOut$`, `zoomTo$`, `panTo$`, `setTransform$`, `fit$`, `center$`, `reset$` | QRL | The engine methods of the same names, documented in the [canvas-glide README](https://github.com/vrtexe/canvas-glide#methods). |

The returned object holds only signals, QRLs and a boolean, so it can be passed as a prop. The viewport element gets pointer and wheel listeners (the wheel listener is not passive, so the wheel zooms instead of scrolling the page), `touch-action: none` and `user-select: none`.

`options` are the data parts of the [canvas-glide options](https://github.com/vrtexe/canvas-glide#options): `initial`, `move.enabled`, `scale.enabled`, `scale.wheelVelocity`, `scale.zoomStep`, and the `enabled` and `constraints` ranges of `constraints.scale` and `constraints.origin`. Callbacks and custom `constrain` functions are not available, because they cannot be serialized; read the signals instead. `useGlide` adds a default origin limit that keeps the content reachable, and `constraints.origin` replaces it. The options are read once, when the viewport element first becomes visible.

## Your own content

This example pans and zooms a 1200 by 800 pixel `<div>`:

```tsx
import { component$, useTask$ } from '@builder.io/qwik';
import { useGlide } from '@canvas-glide/qwik';

export const Board = component$(() => {
  const glide = useGlide();
  useTask$(() => {
    glide.contentSize.value = { width: 1200, height: 800 };
  });

  const { origin, scale } = glide.transform.value;

  return (
    <div ref={glide.ref} style={{ width: '800px', height: '500px', overflow: 'hidden' }}>
      <div
        style={{
          width: '1200px',
          height: '800px',
          'transform-origin': '0 0',
          transform: `translate(${-origin.x * scale}px, ${-origin.y * scale}px) scale(${scale})`,
        }}
      >
        Your content
      </div>
    </div>
  );
});
```

## GlideCanvas

| Prop | Type | Usage |
|---|---|---|
| `glide` | `Glide` | The state from `useGlide()`; pass your own to read it and call its methods. |
| `image` | `Blob \| null` | The image to show; a `File` from an `<input type="file">` is a `Blob`. `null` clears the view. |
| `renderer` | `Renderer` | `Renderer.Canvas` (default), `Renderer.Image` or `Renderer.Html`. |

Children are an overlay in image coordinates at scale 1, moved and scaled with the image, for markers and annotations. Every other attribute, such as `class`, `style` or an event handler, goes to the outer `<div>`.

| Renderer | How it draws |
|---|---|
| `Renderer.Canvas` | Draws the decoded bitmap into a `<canvas>` sized in device pixels. |
| `Renderer.Image` | Moves and scales an `<img>` with a CSS `transform`. |
| `Renderer.Html` | Resizes the `<img>` to the zoomed size and scrolls its container, with no CSS transform, so the browser rasterizes the image at its displayed size. |

The image and HTML renderers load PNG, JPEG, GIF, WebP, AVIF and BMP through a `blob:` URL and every other type, such as SVG, through a `data:` URL, so a script inside an uploaded SVG cannot run in your page's origin.

## Development

`canvas-glide` is listed twice: `^1.0.1` in `dependencies` for consumers, and `../lib` in `devDependencies`, which npm links during local development. Build `lib` first, then:

```sh
npm install
npm test
npm run build
```

`npm test` runs the Vitest suite in `test/` in jsdom; it covers the engine wiring and the drawing, not the components. `npm run build` type-checks with `tsc -b` and writes `dist/` with the Qwik optimizer in library mode: `canvas-glide.qwik.mjs`, `canvas-glide.qwik.cjs` and the type declarations. The `.qwik.` infix tells the optimizer of a consuming app to process the package. The demo app lives in the sibling `qwik-usage` folder.

## License

MIT, see [LICENSE.md](LICENSE.md).
