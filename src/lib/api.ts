import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError, badRequest } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";

type Ctx<P> = { params: Promise<P> };
type Handler<P> = (req: Request, ctx: { params: P }) => Promise<unknown>;

/**
 * Wraps a route handler with consistent JSON errors. Returned values are sent as
 * JSON; returning a Response passes it through untouched.
 */
export function route<P = Record<string, string>>(handler: Handler<P>, opts: { rateLimit?: { key: string; limit: number; windowSec: number } } = {}) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      if (opts.rateLimit) {
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
        await enforceRateLimit(`${opts.rateLimit.key}:${ip}`, opts.rateLimit.limit, opts.rateLimit.windowSec);
      }
      const params = ctx?.params ? await ctx.params : ({} as P);
      const result = await handler(req, { params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      if (err instanceof AppError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
      if (err instanceof ZodError) {
        const first = err.issues[0];
        const path = first?.path?.join(".");
        return NextResponse.json(
          { error: first ? `${path ? `${path}: ` : ""}${first.message}` : "Invalid input.", code: "validation" },
          { status: 400 },
        );
      }
      // Re-throw Next.js control-flow errors (redirect/notFound).
      if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_")) throw err;
      console.error("[api] unhandled error", err);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }
  return schema.parse(body);
}
