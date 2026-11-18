import { useSignal, useVisibleTask$ } from '@builder.io/qwik';
import type { Glide } from '../glide.ts';
import { naturalSizeOf } from '../util/draw.ts';
import { createImageUrlSafe, revokeImageUrl } from '../util/image.ts';
import { fitContent, type Size } from '../util/size.ts';

/** The URL and natural size of the image for the img-based renderers; a new image is fitted once, a resize keeps the view. */
export function useImageUrl(props: { glide: Glide; image?: Blob | null }) {
  const src = useSignal<string>();
  const natural = useSignal<Size | null>(null);
  const fitPending = useSignal(false);

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

      fitPending.value = !!size;
      natural.value = size;
    },
    { strategy: 'document-ready' },
  );

  useVisibleTask$(({ track }) => {
    track(() => props.glide.viewportSize.value);
    const size = track(() => natural.value);
    fitPending.value = fitContent(props.glide, size, fitPending.value);
  });

  return { src, natural };
}
