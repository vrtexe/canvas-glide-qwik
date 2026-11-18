import type { Glide } from '../glide.ts';

export type Size = { width: number; height: number };

/** `content` scaled to fit inside `viewport` with its aspect ratio kept, like `object-fit: contain`. */
export function fitInto(viewport: Size, content: Size): Size {
  const scale =
    viewport.width && viewport.height && content.width && content.height
      ? Math.min(viewport.width / content.width, viewport.height / content.height)
      : 1;
  return { width: content.width * scale, height: content.height * scale };
}

/** Sets `glide.contentSize` for `natural`; a pending fit runs once the viewport has a size. Returns whether it is still pending. */
export function fitContent(
  glide: Pick<Glide, 'viewportSize' | 'contentSize' | 'engine'>,
  natural: Size | null,
  fitPending: boolean,
) {
  const viewport = glide.viewportSize.value;
  glide.contentSize.value = natural && fitInto(viewport, natural);
  if (!natural || !fitPending || !viewport.width || !viewport.height) return fitPending;
  glide.engine.value?.fit();
  return false;
}
