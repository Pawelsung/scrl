import { zipSync } from "fflate";

export const sliceFilename = (index) => `carousel_${String(index + 1).padStart(2, "0")}.png`;

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

// Render slides one by one straight to PNG Blobs. Only one full-size canvas
// exists at a time and no base64 copies are kept, which keeps high-quality
// exports within iOS Safari's canvas memory limits.
export async function renderSlideBlobs(stage, indices, { singleW, singleH, pixelRatio }) {
  const blobs = [];
  for (const index of indices) {
    const blob = await stage.toBlob({
      x: index * singleW,
      y: 0,
      width: singleW,
      height: singleH,
      pixelRatio,
      mimeType: "image/png",
    });
    if (!blob) throw new Error(`Slide ${index + 1} produced no image`);
    blobs.push(blob);
    await nextFrame();
  }
  return blobs;
}

export async function dataUrlToBlob(dataUrl) {
  return (await fetch(dataUrl)).blob();
}

export async function zipBlobs(blobs) {
  const files = {};
  for (const [index, blob] of blobs.entries()) {
    files[sliceFilename(index)] = new Uint8Array(await blob.arrayBuffer());
  }
  return new Blob([zipSync(files, { level: 0 })], { type: "application/zip" });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
