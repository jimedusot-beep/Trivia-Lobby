/** Map pointer pixels to natural-image-independent [0,1] coordinates. */
export function normalizedHotspotPoint(
  clientX: number, clientY: number,
  rect: { left: number; top: number; width: number; height: number },
) {
  if (![clientX,clientY,rect.left,rect.top,rect.width,rect.height].every(Number.isFinite) ||
      rect.width<=0 || rect.height<=0) {
    throw new RangeError("Hotspot placement requires a nonempty visible image");
  }
  const clamp = (value: number) => Math.max(0,Math.min(1,value));
  return {
    x:Number(clamp((clientX-rect.left)/rect.width).toFixed(4)),
    y:Number(clamp((clientY-rect.top)/rect.height).toFixed(4)),
  };
}
