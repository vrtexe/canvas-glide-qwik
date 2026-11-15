import { component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import type { Glide } from '../glide.ts';
import { useImageUrl } from './useImageUrl.ts';

/**
 * Scroll-based renderer: no CSS transform and no <canvas>. Zoom resizes the <img>, so the browser rasterizes it at its
 * displayed size, and pan scrolls an overflow: hidden box. The img's padding adds one viewport of slack on every side,
 * so the image can be panned fully off-screen and negative origins are reachable scroll positions.
 */
export const HtmlRenderer = component$<{ glide: Glide; image?: Blob | null }>((props) => {
  const scroller = useSignal<HTMLDivElement>();
  const { src, natural } = useImageUrl(props);

  // Runs after the render that applied the new img size, so the scroll range is already updated.
  useVisibleTask$(({ track }) => {
    const element = track(() => scroller.value);
    const { origin, scale } = track(() => props.glide.transform.value);
    const { width, height } = track(() => props.glide.viewportSize.value);
    if (element && track(() => natural.value)) element.scrollTo(width + origin.x * scale, height + origin.y * scale);
  });

  const { scale } = props.glide.transform.value;
  const size = props.glide.contentSize.value;
  const viewport = props.glide.viewportSize.value;

  return (
    <div ref={scroller} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {src.value && (
        <img
          src={src.value}
          alt=""
          draggable={false}
          style={{
            display: 'block',
            'box-sizing': 'content-box',
            width: `${(size?.width ?? 0) * scale}px`,
            height: `${(size?.height ?? 0) * scale}px`,
            padding: `${viewport.height}px ${viewport.width}px`,
          }}
        />
      )}
    </div>
  );
});
