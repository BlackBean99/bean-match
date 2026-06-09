export type CompressImageOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
};

const defaultOptions: Required<CompressImageOptions> = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.8,
};

export async function compressImageFile(file: File, options: CompressImageOptions = {}): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif") return file;

  const resolved = { ...defaultOptions, ...options };
  const image = await loadImage(file);
  const [width, height] = fitWithin(image.width, image.height, resolved.maxWidth, resolved.maxHeight);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;

  context.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, "image/webp", resolved.quality).catch(async () =>
    canvasToBlob(canvas, "image/jpeg", resolved.quality),
  );
  if (!blob) return file;

  const fileName = replaceExtension(file.name || "photo", blob.type === "image/webp" ? ".webp" : ".jpg");
  return new File([blob], fileName, {
    type: blob.type,
    lastModified: Date.now(),
  });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지 로드 실패"));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function fitWithin(width: number, height: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / Math.max(width, 1), maxHeight / Math.max(height, 1), 1);
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))] as const;
}

function replaceExtension(fileName: string, extension: string) {
  return fileName.replace(/\.[^.]+$/, "") + extension;
}
