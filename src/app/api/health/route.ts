import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + database check for the hosting platform's health checks. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    // Which database is in use (not secret): "sqlite" on a hosted server means data is lost on every deploy.
    const database = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "") ? "postgresql" : "sqlite";
    return NextResponse.json({ ok: true, database });
  } catch {
    return NextResponse.json({ ok: false, error: "database unavailable" }, { status: 503 });
  }
}
