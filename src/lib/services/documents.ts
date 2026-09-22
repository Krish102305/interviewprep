import { badRequest } from "@/lib/errors";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const TYPES = {
  pdf: { mime: "application/pdf", ext: "pdf" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx" },
  txt: { mime: "text/plain", ext: "txt" },
} as const;

/** Validate by content (magic bytes), not just the client-supplied MIME type. */
export function detectDocumentType(name: string, buf: Buffer) {
  if (buf.length === 0) throw badRequest("The file is empty.");
  if (buf.length > MAX_UPLOAD_BYTES) throw badRequest("Files must be 5 MB or smaller.");
  const lower = name.toLowerCase();
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return TYPES.pdf;
  if (buf[0] === 0x50 && buf[1] === 0x4b && lower.endsWith(".docx")) return TYPES.docx;
  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    const sample = buf.subarray(0, 2048);
    if (sample.includes(0)) throw badRequest("That text file looks binary.");
    return TYPES.txt;
  }
  throw badRequest("Upload a PDF, DOCX or TXT file.");
}

/** Extract plain text for AI personalisation. Returns null when extraction isn't possible. */
export async function extractText(kind: keyof typeof TYPES, buf: Buffer): Promise<string | null> {
  try {
    let text = "";
    if (kind === "pdf") {
      const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const result = await pdfText(pdf, { mergePages: true });
      text = Array.isArray(result.text) ? result.text.join("\n") : result.text;
    } else if (kind === "docx") {
      const mammoth = await import("mammoth");
      text = (await mammoth.extractRawText({ buffer: buf })).value;
    } else {
      text = buf.toString("utf8");
    }
    const clean = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    return clean ? clean.slice(0, 30000) : null;
  } catch (err) {
    console.error("[documents] text extraction failed", err);
    return null;
  }
}

export function kindOf(mime: string): keyof typeof TYPES {
  return mime === TYPES.pdf.mime ? "pdf" : mime === TYPES.docx.mime ? "docx" : "txt";
}
