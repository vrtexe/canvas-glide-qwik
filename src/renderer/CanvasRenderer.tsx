import { component$, noSerialize, useSignal, useVisibleTask$, type NoSerialize } from '@builder.io/qwik';
import type { Glide } from '../glide.ts';
import { drawImage } from '../util/draw.ts';
import { createImageBitmapSafe } from '../util/image.ts';
import { fitInto } from '../util/size.ts';

export const CanvasRenderer = component$<{ glide: Glide; image?: Blob | null }>((props) => {
  const canvas = useSignal<HTMLCanvasElement>();
  const bitmap = useSignal<NoSerialize<ImageBitmap>>();

  // A new image is fitted once; a resize keeps the view and only updates the content size.
  useVisibleTask$(
    async ({ track, cleanup }) => {
      const image = track(() => props.image);
      let current = true;
      cleanup(() => (current = false));

      const loaded = await createImageBitmapSafe(image).catch(() => null);
      if (!current) {
        loaded?.close();
        return;
      }

      bitmap.value?.close();
      bitmap.value = loaded ? noSerialize(loaded) : undefined;
      props.glide.contentSize.value = loaded && fitInto(props.glide.viewportSize.value, loaded);
      if (loaded) props.glide.engine.value?.fit();
    },
    { strategy: 'document-ready' },
  );

  useVisibleTask$(({ track }) => {
    const viewportSize = track(() => props.glide.viewportSize.value);
    const loaded = track(() => bitmap.value);
    props.glide.contentSize.value = loaded ? fitInto(viewportSize, loaded) : null;
  });

  useVisibleTask$(({ track }) => {
    const element = track(() => canvas.value);
    const transform = track(() => props.glide.transform.value);
    const viewportSize = track(() => props.glide.viewportSize.value);
    const contentSize = track(() => props.glide.contentSize.value);
    const loaded = track(() => bitmap.value);
    if (element) drawImage(element, loaded, transform, viewportSize, contentSize);
  });

  useVisibleTask$(({ cleanup }) => cleanup(() => bitmap.value?.close()));

  return <canvas ref={canvas} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
});
