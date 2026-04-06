// src/lib/file-upload.ts
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

/**
 * 원격 URL의 이미지를 다운로드하여 public/uploads/{folder}/ 에 저장
 * @returns 브라우저에서 접근 가능한 경로 (예: /uploads/carousel/abc.png)
 */
export async function saveRemoteImage(
  url: string,
  folder: string,
  filename?: string
): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`이미지 다운로드 실패: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = url.includes(".webp") ? "webp" : "png";
  const name =
    filename ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const dir = join(process.cwd(), "public", "uploads", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), buffer);

  return `/uploads/${folder}/${name}`;
}
