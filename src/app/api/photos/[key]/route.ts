import { readFile } from "fs/promises";
import path from "path";

const photoMap: Record<string, string> = {
  start: "start.jpeg",
  "sysu-logo": "sysu-logo-nav.png",
  "sysu-favicon": "sysu-favicon.ico",
  home: "one.jpg",
  one: "one.jpg",
  submit: "u=1321580929,3387142913&fm=253&fmt=auto&app=138&f=JPEG.webp",
  report: "u=2741840025,211186196&fm=253&fmt=auto&app=138&f=JPEG.webp",
  admin: "u=3695863600,1253916828&fm=253&fmt=auto&app=120&f=JPEG.webp",
  rules: "u=49911336,582655209&fm=253&fmt=auto&app=138&f=JPEG.webp",
};

function contentTypeFor(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".ico")) {
    return "image/x-icon";
  }
  return "image/webp";
}

export async function GET(_: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const filename = photoMap[key];

  if (!filename) {
    return new Response("Not found", { status: 404 });
  }

  const filePath = path.join(process.cwd(), "photos", filename);

  try {
    const data = await readFile(filePath);
    return new Response(data, {
      headers: {
        "Content-Type": contentTypeFor(filename),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
