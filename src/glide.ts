import { $, noSerialize, useSignal, useVisibleTask$, type NoSerialize, type QRL, type Signal } from '@builder.io/qwik';
import { createEngine, type CanvasEngine, type Point, type Transform } from 'canvas-glide';
import { createConstrainer } from './util/constraint.ts';
import type { Size } from './util/size.ts';

type Range = [number, number];

/** The engine options that survive serialization; callbacks are replaced by the signals of `Glide`. */
export type GlideOptions = {
  initial?: Transform;
  move?: { enabled?: boolean };
  scale?: { enabled?: boolean; wheelVelocity?: number; zoomStep?: number };
  constraints?: {
    scale?: { enabled?: boolean; constraints?: Range };
    origin?: { enabled?: boolean; constraints?: { x: Range; y: Range } };
  };
};

export type GlideSignals = {
  /** The current transform, updated at most once per animation frame. */
  transform: Signal<Transform>;
  /** Whether a pointer drag is in progress. */
  moving: Signal<boolean>;
  /** The viewport element's size in CSS pixels. */
  viewportSize: Signal<Size>;
  /** The content's size at scale 1, used by fit, center and the default pan limit. */
  contentSize: Signal<Size | null>;
};

export type Glide = GlideSignals & {
  /** Put on the viewport element: `<div ref={glide.ref}>`. */
  ref: Signal<Element | undefined>;
  /** The engine, available in the browser once the viewport is visible. */
  engine: Signal<NoSerialize<CanvasEngine>>;
  pannable: boolean;
  zoomIn$: QRL<(step?: number) => void>;
  zoomOut$: QRL<(step?: number) => void>;
  zoomTo$: QRL<(scale: number, pivot?: Point) => void>;
  panTo$: QRL<(origin: Point) => void>;
  setTransform$: QRL<(transform: Transform) => void>;
  fit$: QRL<() => void>;
  center$: QRL<() => void>;
  reset$: QRL<() => void>;
};

/** Wires an engine to a viewport element and publishes its state into the signals; returns the engine and a detach function. */
export function attachGlide(element: HTMLElement, options: GlideOptions, signals: GlideSignals) {
  let frame = 0;

  const getViewportRect = () => element.getBoundingClientRect();
  const getCanvasRect = () => {
    const size = signals.contentSize.value;
    return size && { x: 0, y: 0, ...size };
  };

  const engine: CanvasEngine = createEngine({
    getViewportRect,
    getCanvasRect,
    move: {
      ...options.move,
      onIsMovingChange: (moving) => (signals.moving.value = moving),
    },
    scale: options.scale,
    constraints: {
      ...options.constraints,
      origin: options.constraints?.origin ?? {
        enabled: true,
        constrain: createConstrainer({ getViewportRect, getCanvasRect, getScale: () => engine.getScale() }),
      },
    },
    state: {
      initial: options.initial,
      onTransformChange: () => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          signals.transform.value = engine.getTransform();
        });
      },
    },
  });

  element.style.touchAction = 'none';
  element.style.userSelect = 'none';

  const { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onWheel } = engine.event;
  const listeners: [string, EventListener, AddEventListenerOptions?][] = [
    ['pointerdown', onPointerDown as EventListener],
    ['pointermove', onPointerMove as EventListener],
    ['pointerup', onPointerUp as EventListener],
    ['pointercancel', onPointerCancel as EventListener],
    ['wheel', onWheel as EventListener, { passive: false }],
  ];
  listeners.forEach(([type, listener, listenerOptions]) => element.addEventListener(type, listener, listenerOptions));

  const measure = () => (signals.viewportSize.value = { width: element.clientWidth, height: element.clientHeight });
  const resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(element);
  measure();

  return {
    engine,
    detach: () => {
      listeners.forEach(([type, listener]) => element.removeEventListener(type, listener));
      resizeObserver.disconnect();
      cancelAnimationFrame(frame);
    },
  };
}

/** Pan and zoom state for one viewport. Options are read once, when the viewport element first becomes visible. */
export function useGlide(options: GlideOptions = {}): Glide {
  const ref = useSignal<Element>();
  const engine = useSignal<NoSerialize<CanvasEngine>>();
  const transform = useSignal<Transform>(options.initial ?? { origin: { x: 0, y: 0 }, scale: 1 });
  const moving = useSignal(false);
  const viewportSize = useSignal<Size>({ width: 0, height: 0 });
  const contentSize = useSignal<Size | null>(null);

  useVisibleTask$(
    ({ track, cleanup }) => {
      const element = track(() => ref.value);
      if (!(element instanceof HTMLElement)) return;

      const glide = attachGlide(element, options, { transform, moving, viewportSize, contentSize });
      engine.value = noSerialize(glide.engine);
      cleanup(() => {
        glide.detach();
        engine.value = undefined;
      });
    },
    { strategy: 'document-ready' },
  );

  return {
    ref,
    engine,
    transform,
    moving,
    viewportSize,
    contentSize,
    pannable: options.move?.enabled !== false,
    zoomIn$: $((step?: number) => engine.value?.zoomIn(step)),
    zoomOut$: $((step?: number) => engine.value?.zoomOut(step)),
    zoomTo$: $((scale: number, pivot?: Point) => engine.value?.zoomTo(scale, pivot)),
    panTo$: $((origin: Point) => engine.value?.panTo(origin)),
    setTransform$: $((next: Transform) => engine.value?.setTransform(next)),
    fit$: $(() => engine.value?.fit()),
    center$: $(() => engine.value?.center()),
    reset$: $(() => engine.value?.reset()),
  };
}
