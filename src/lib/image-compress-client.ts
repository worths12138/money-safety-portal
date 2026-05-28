/** 浏览器端上传前压缩，减轻 JSON 体积与多模态 token 压力（部署环境必备） */

const DEFAULT_MAX_EDGE = 1280;
const DEFAULT_QUALITY = 0.82;
const DEFAULT_MAX_BYTES = 2.5 * 1024 * 1024;

const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function isCompressibleImage(file: File) {
  if (COMPRESSIBLE_TYPES.has(file.type)) return true;
  const lower = file.name.toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].some((ext) => lower.endsWith(ext));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片解码失败"));
    img.src = dataUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("图片压缩失败"))),
      type,
      quality,
    );
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export type PreparedUploadMaterial = {
  name: string;
  type: string;
  b64: string;
  compressed: boolean;
  originalBytes: number;
  outputBytes: number;
};

export async function prepareFileForUpload(
  file: File,
  options?: { maxEdge?: number; quality?: number; maxBytes?: number },
): Promise<PreparedUploadMaterial> {
  const maxEdge = options?.maxEdge ?? DEFAULT_MAX_EDGE;
  const quality = options?.quality ?? DEFAULT_QUALITY;
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;

  if (!isCompressibleImage(file)) {
    const dataUrl = await readFileAsDataUrl(file);
    const b64 = dataUrl.split(",")[1] ?? "";
    return {
      name: file.name,
      type: file.type || "application/octet-stream",
      b64,
      compressed: false,
      originalBytes: file.size,
      outputBytes: Math.ceil((b64.length * 3) / 4),
    };
  }

  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("无法创建画布进行压缩");
  }
  ctx.drawImage(img, 0, 0, width, height);

  let q = quality;
  let blob = await canvasToBlob(canvas, "image/jpeg", q);
  while (blob.size > maxBytes && q > 0.45) {
    q -= 0.08;
    blob = await canvasToBlob(canvas, "image/jpeg", q);
  }

  const b64 = await blobToBase64(blob);
  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";

  return {
    name: `${baseName}.jpg`,
    type: "image/jpeg",
    b64,
    compressed: true,
    originalBytes: file.size,
    outputBytes: blob.size,
  };
}
