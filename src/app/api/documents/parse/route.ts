import { route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { badRequest } from "@/lib/errors";
import { detectDocumentType, extractText } from "@/lib/services/documents";

/** Extract text from an uploaded job description (not stored). */
export const POST = route(
  async (req) => {
    await requireApiUser({ roles: ["student"] });
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw badRequest("Choose a file to upload.");
    const buf = Buffer.from(await file.arrayBuffer());
    const kind = detectDocumentType(file.name, buf);
    const text = await extractText(kind.ext as "pdf" | "docx" | "txt", buf);
    if (!text) throw badRequest("We couldn't read text from that file. Paste the job description instead.");
    return { text: text.slice(0, 20000) };
  },
  { rateLimit: { key: "parse", limit: 40, windowSec: 3600 } },
);
