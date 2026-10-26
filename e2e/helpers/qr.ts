import { expect, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import jsQR from "jsqr";

/** Decode the actual rendered SVG screenshot, including its colors and quiet zone. */
export async function readInvitationQr(page: Page, code?: string) {
  const qr = page.getByRole("img", { name: code ? `Scan QR code to join room ${code}` : "Scan QR code to open this assignment", exact: true });
  await expect(qr).toBeVisible();
  const png = PNG.sync.read(await qr.screenshot({ animations: "disabled" }));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(decoded, "An independent decoder must read the displayed QR pixels").not.toBeNull();
  return decoded!.data;
}

export function readDownloadedQr(svg: string) {
  const size = Number(svg.match(/viewBox="0 0 (\d+) (\d+)"/)?.[1]);
  const path = svg.match(/<path[^>]*d="([^"]+)"/)?.[1];
  expect(size).toBeGreaterThan(21); expect(path).toBeTruthy();
  const scale = 6, width = size * scale, pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  for (const cell of path!.matchAll(/M(\d+),(\d+)h1v1h-1z/g)) {
    const x = Number(cell[1]) * scale, y = Number(cell[2]) * scale;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const i = ((y + dy) * width + x + dx) * 4; pixels[i] = 32; pixels[i + 1] = 38; pixels[i + 2] = 75;
    }
  }
  return jsQR(pixels, width, width)?.data;
}
