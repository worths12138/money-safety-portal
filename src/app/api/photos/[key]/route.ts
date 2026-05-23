import { readFile } from "fs/promises";
import path from "path";

const photoMap: Record<string, string> = {
  home: "u=1273165082,3285821078&fm=253&fmt=auto&app=138&f=JPEG.webp",
  submit: "u=1321580929,3387142913&fm=253&fmt=auto&app=138&f=JPEG.webp",
  report: "u=2741840025,211186196&fm=253&fmt=auto&app=138&f=JPEG.webp",
  admin: "u=3695863600,1253916828&fm=253&fmt=auto&app=120&f=JPEG.webp",
  rules: "u=49911336,582655209&fm=253&fmt=auto&app=138&f=JPEG.webp",
};

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
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
