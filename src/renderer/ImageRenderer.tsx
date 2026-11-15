import { component$ } from '@builder.io/qwik';
import type { Glide } from '../glide.ts';
import { useImageUrl } from './useImageUrl.ts';

export const ImageRenderer = component$<{ glide: Glide; image?: Blob | null }>((props) => {
  const { src, natural } = useImageUrl(props);

  const { origin, scale } = props.glide.transform.value;
  const size = props.glide.contentSize.value;

  return (
    <div
      style={{
        position: 'relative',
        'transform-origin': '0 0',
        width: `${size?.width ?? 0}px`,
        height: `${size?.height ?? 0}px`,
        transform: `scale(${scale}) translate(${-origin.x}px, ${-origin.y}px)`,
      }}
    >
      {src.value && (
        <img
          src={src.value}
          alt=""
          draggable={false}
          style={{ display: 'block', width: '100%', height: '100%', visibility: natural.value ? 'visible' : 'hidden' }}
        />
      )}
    </div>
  );
});
