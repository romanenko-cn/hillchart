const imageWidth = 1376;
const imageHeight = 768;

export async function copySvgChartAsPng(
  svg: SVGSVGElement,
  filename: string,
): Promise<"copied" | "downloaded"> {
  const png = await renderSvgToPng(svg);

  if (navigator.clipboard && "ClipboardItem" in window) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          [png.type]: png,
        }),
      ]);
      return "copied";
    } catch {
      downloadBlob(png, filename);
      return "downloaded";
    }
  }

  downloadBlob(png, filename);
  return "downloaded";
}

export function sanitizeImageFilename(title: string): string {
  const safeTitle = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${safeTitle || "hillchart"}.png`;
}

async function renderSvgToPng(svg: SVGSVGElement): Promise<Blob> {
  const serializedSvg = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([serializedSvg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = imageWidth;
    canvas.height = imageHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas rendering is unavailable.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvasToBlob(canvas, "image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to render the chart image."));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Unable to generate the chart image."));
    }, type);
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
