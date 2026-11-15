import { useSignal, useVisibleTask$ } from '@builder.io/qwik';
import type { Glide } from '../glide.ts';
import { naturalSizeOf } from '../util/draw.ts';
import { createImageUrlSafe, revokeImageUrl } from '../util/image.ts';
import { fitInto, type Size } from '../util/size.ts';

/** The URL and natural size of the image for the img-based renderers; a new image is fitted once, a resize keeps the view. */
export function useImageUrl(props: { glide: Glide; image?: Blob | null }) {
  const src = useSignal<string>();
  const natural = useSignal<Size | null>(null);

  useVisibleTask$(
    async ({ track, cleanup }) => {
      const image = track(() => props.image);
      let current = true;
      let url: string | null = null;
      cleanup(() => {
        current = false;
        revokeImageUrl(url);
      });

      url = await createImageUrlSafe(image).catch(() => null);
      if (!current) {
        revokeImageUrl(url);
        return;
      }

      natural.value = null;
      src.value = url ?? undefined;
      const size = url ? await naturalSizeOf(url) : null;
      if (!current) return;

      natural.value = size;
      props.glide.contentSize.value = size && fitInto(props.glide.viewportSize.value, size);
      if (size) props.glide.engine.value?.fit();
    },
    { strategy: 'document-ready' },
  );

  useVisibleTask$(({ track }) => {
    const viewportSize = track(() => props.glide.viewportSize.value);
    const size = track(() => natural.value);
    props.glide.contentSize.value = size && fitInto(viewportSize, size);
  });

  return { src, natural };
}
