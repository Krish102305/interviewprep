import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { badRequest } from "@/lib/errors";
import { saveFile } from "@/lib/storage";
import { detectDocumentType, extractText } from "@/lib/services/documents";
import { awardPoints, POINTS } from "@/lib/services/gamification";
import { track } from "@/lib/services/analytics";

export const GET = route(async () => {
  const user = await requireApiUser({ roles: ["student"] });
  const resumes = await db.resume.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, sizeBytes: true, isDefault: true, createdAt: true, parsedText: true },
  });
  return { resumes: resumes.map(({ parsedText, ...r }) => ({ ...r, parsed: Boolean(parsedText) })) };
});

export const POST = route(
  async (req) => {
    const user = await requireApiUser({ roles: ["student"] });
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw badRequest("Choose a file to upload.");
    const buf = Buffer.from(await file.arrayBuffer());
    const kind = detectDocumentType(file.name, buf);
    const count = await db.resume.count({ where: { userId: user.id } });
    if (count >= 10) throw badRequest("You can keep up to 10 resumes. Delete an old one first.");
    const storagePath = await saveFile("resumes", kind.ext, buf);
    const parsedText = await extractText(kind.ext as "pdf" | "docx" | "txt", buf);
    const resume = await db.$transaction(async (tx) => {
      await tx.resume.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
      return tx.resume.create({
        data: { userId: user.id, fileName: file.name.slice(0, 180), mimeType: kind.mime, sizeBytes: buf.length, storagePath, parsedText, isDefault: true },
      });
    });
    if (count === 0) await awardPoints(user.id, POINTS.resumeUpload, "Uploaded your resume");
    await track("resume_uploaded", user.id, { parsed: Boolean(parsedText) });
    return { resume: { id: resume.id, fileName: resume.fileName, parsed: Boolean(parsedText), isDefault: true } };
  },
  { rateLimit: { key: "upload", limit: 30, windowSec: 3600 } },
);
