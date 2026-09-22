import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Private file storage. Files live outside /public and are only served through
 * authorised API routes. Swap this module for S3/GCS/Supabase Storage in production.
 */
const ROOT = path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), "storage"));

export async function saveFile(folder: string, ext: string, data: Buffer) {
  const safeFolder = folder.replace(/[^a-z0-9_-]/gi, "");
  const name = `${crypto.randomUUID()}.${ext.replace(/[^a-z0-9]/gi, "")}`;
  const dir = path.join(ROOT, safeFolder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), data, { mode: 0o600 });
  return `${safeFolder}/${name}`;
}

function resolveSafe(relPath: string) {
  const full = path.resolve(ROOT, relPath);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Invalid storage path");
  return full;
}

export const readFile = (relPath: string) => fs.readFile(resolveSafe(relPath));
export const deleteFile = (relPath: string) => fs.rm(resolveSafe(relPath), { force: true });
