import "@testing-library/jest-dom/vitest";

if (typeof HTMLCanvasElement !== "undefined") {
  // jsdom's getContext throws "Not implemented"; the tuner only draws a scope.
  HTMLCanvasElement.prototype.getContext = function getContext() {
    const noop = () => undefined;
    return {
      setTransform: noop,
      fillRect: noop,
      beginPath: noop,
      moveTo: noop,
      lineTo: noop,
      stroke: noop,
      canvas: this,
    } as unknown as CanvasRenderingContext2D;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
}
