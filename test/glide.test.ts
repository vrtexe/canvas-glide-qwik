// @vitest-environment jsdom
import { afterEach, test } from "vitest";
import assert from "node:assert/strict";
import type { NoSerialize, Signal } from "@builder.io/qwik";
import type { CanvasEngine } from "canvas-glide";
import { attachGlide, type GlideOptions, type GlideSignals } from "../src/glide.ts";
import { drawImage } from "../src/util/draw.ts";
import { fitContent } from "../src/util/size.ts";

// jsdom has no ResizeObserver, no pointer capture and no 2D context.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

const signal = <T>(value: T) => ({ value }) as Signal<T>;
const signals = (): GlideSignals => ({
  transform: signal({ origin: { x: 0, y: 0 }, scale: 1 }),
  moving: signal(false),
  viewportSize: signal({ width: 0, height: 0 }),
  contentSize: signal<{ width: number; height: number } | null>({ width: 400, height: 300 }),
});

const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

function attach(options: GlideOptions = {}, state = signals()) {
  const rect = { x: 0, y: 0, width: 800, height: 600 };
  const node = document.body.appendChild(document.createElement("div"));
  node.getBoundingClientRect = () => ({ ...rect }) as DOMRect;
  const glide = attachGlide(node, options, state);
  cleanups.push(() => {
    glide.detach();
    node.remove();
  });
  return { ...glide, node, rect, state };
}

test("a scale range in constraints keeps the default origin limit", () => {
  const { engine } = attach({ constraints: { scale: { constraints: [1, 4] } } });

  engine.zoomTo(10);
  engine.panTo({ x: 5000, y: 5000 });

  assert.equal(engine.getScale(), 4);
  assert.deepEqual(engine.getOrigin(), { x: 400, y: 300 });
});

test("constraints.origin replaces the default origin limit", () => {
  const { engine } = attach({ constraints: { origin: { constraints: { x: [0, 10], y: [0, 10] } } } });

  engine.panTo({ x: 5000, y: 5000 });

  assert.deepEqual(engine.getOrigin(), { x: 10, y: 10 });
});

test("a wheel zoom anchors at the cursor after the viewport moved", () => {
  const { engine, node, rect } = attach();
  engine.center();
  rect.x = 150;

  const before = engine.getTransform();
  node.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, clientX: 150 + 400, clientY: 300, cancelable: true }));
  const after = engine.getTransform();

  assert.ok(after.scale > before.scale);
  assert.ok(Math.abs(after.origin.x + 400 / after.scale - (before.origin.x + 400 / before.scale)) < 1e-9);
});

test("the transform signal updates once per animation frame, moving follows a drag", async () => {
  const { engine, node, state } = attach();

  engine.zoomIn();
  engine.zoomIn();
  assert.equal(state.transform.value.scale, 1);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  assert.deepEqual(state.transform.value, engine.getTransform());

  node.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1, button: 0, clientX: 10, clientY: 10 }));
  assert.equal(state.moving.value, true);
  node.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, button: 0, clientX: 10, clientY: 10 }));
  assert.equal(state.moving.value, false);
});

function fakeCanvas() {
  const calls: string[] = [];
  const canvas = document.createElement("canvas");
  canvas.getContext = (() => ({
    resetTransform: () => calls.push("reset"),
    clearRect: () => calls.push("clear"),
    setTransform: () => calls.push("transform"),
    drawImage: () => calls.push("draw"),
  })) as unknown as HTMLCanvasElement["getContext"];
  return { canvas, calls };
}

const transform = { origin: { x: 0, y: 0 }, scale: 1 };
const viewport = { width: 1000, height: 700 };

test("drawing without an image clears the canvas", () => {
  const { canvas, calls } = fakeCanvas();

  drawImage(canvas, null, transform, viewport, null);

  assert.ok(calls.includes("clear"));
  assert.ok(!calls.includes("draw"));
});

test("the backing store follows devicePixelRatio", () => {
  const { canvas } = fakeCanvas();
  const image = {} as CanvasImageSource;

  drawImage(canvas, image, transform, viewport, { width: 700, height: 700 });
  assert.equal(canvas.width, 1000);

  Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
  drawImage(canvas, image, transform, viewport, { width: 700, height: 700 });
  Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 1 });

  assert.equal(canvas.width, 2000);
  assert.equal(canvas.height, 1400);
});

function fitTarget(viewportSize = { width: 0, height: 0 }) {
  const fits: { width: number; height: number }[] = [];
  const glide = {
    viewportSize: signal(viewportSize),
    contentSize: signal<{ width: number; height: number } | null>(null),
    engine: signal({ fit: () => fits.push({ ...glide.viewportSize.value }) } as unknown as NoSerialize<CanvasEngine>),
  };
  return { glide, fits };
}

test("an image loaded before the viewport has a size is fitted once it gets one, a later resize keeps the view", () => {
  const { glide, fits } = fitTarget();
  const image = { width: 400, height: 300 };

  let pending = fitContent(glide, image, true);
  assert.deepEqual(fits, []);

  glide.viewportSize.value = { width: 800, height: 600 };
  pending = fitContent(glide, image, pending);
  assert.deepEqual(fits, [{ width: 800, height: 600 }]);
  assert.deepEqual(glide.contentSize.value, { width: 800, height: 600 });

  glide.viewportSize.value = { width: 400, height: 600 };
  fitContent(glide, image, pending);
  assert.deepEqual(fits, [{ width: 800, height: 600 }]);
  assert.deepEqual(glide.contentSize.value, { width: 400, height: 300 });
});

test("an image loaded into a sized viewport is fitted at once", () => {
  const { glide, fits } = fitTarget({ width: 800, height: 600 });

  assert.equal(fitContent(glide, { width: 400, height: 300 }, true), false);
  assert.deepEqual(fits, [{ width: 800, height: 600 }]);
});
