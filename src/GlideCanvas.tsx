import { component$, Slot, type CSSProperties, type HTMLAttributes } from '@builder.io/qwik';
import { useGlide, type Glide } from './glide.ts';
import { CanvasRenderer } from './renderer/CanvasRenderer.tsx';
import { HtmlRenderer } from './renderer/HtmlRenderer.tsx';
import { ImageRenderer } from './renderer/ImageRenderer.tsx';

export type Renderer = (typeof Renderer)[keyof typeof Renderer];
export const Renderer = Object.freeze({
  Canvas: 'canvas',
  Image: 'image',
  /** Renders the image as a resized, scrolled `<img>`, not arbitrary HTML. */
  Html: 'html',
} as const);

export type GlideCanvasProps = Omit<HTMLAttributes<HTMLDivElement>, 'style'> & {
  /** The pan and zoom state from `useGlide()`; pass your own to read it and call its methods. */
  glide?: Glide;
  /** The image to show; `null` clears the view. */
  image?: Blob | null;
  renderer?: Renderer;
  style?: CSSProperties;
};

/** An image viewer; children are an overlay in image coordinates at scale 1, moved and scaled with the image. */
export const GlideCanvas = component$<GlideCanvasProps>(({ glide: given, image, renderer, style, ...rest }) => {
  const own = useGlide();
  const glide = given ?? own;

  const { origin, scale } = glide.transform.value;
  const size = glide.contentSize.value;

  return (
    <div
      {...rest}
      ref={glide.ref}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        'overscroll-behavior': 'contain',
        cursor: glide.moving.value ? 'grabbing' : glide.pannable ? 'grab' : undefined,
        ...style,
      }}
    >
      {renderer === Renderer.Image ? (
        <ImageRenderer glide={glide} image={image} />
      ) : renderer === Renderer.Html ? (
        <HtmlRenderer glide={glide} image={image} />
      ) : (
        <CanvasRenderer glide={glide} image={image} />
      )}

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          'transform-origin': '0 0',
          width: `${size?.width ?? 0}px`,
          height: `${size?.height ?? 0}px`,
          transform: `scale(${scale}) translate(${-origin.x}px, ${-origin.y}px)`,
        }}
      >
        <Slot />
      </div>
    </div>
  );
});
