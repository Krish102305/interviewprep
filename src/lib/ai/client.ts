import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod/v4";

/**
 * Claude integration. The API key lives only on the server (ANTHROPIC_API_KEY).
 * When it is missing, callers use the rule-based development engine and the UI
 * labels results accordingly, nothing pretends to be AI when it is not.
 */

export const AI_MODEL = process.env.AI_MODEL || "claude-opus-5";

export function isAiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ maxRetries: 2, timeout: 120_000 });
  return client;
}

export class AiUnavailableError extends Error {}

type Effort = "low" | "medium" | "high";

/**
 * One structured-output call. Returns the parsed object validated by the Zod
 * schema, or throws (callers fall back to the development engine).
 */
export async function generateStructured<T extends z.ZodType>(opts: {
  system: string;
  prompt: string;
  schema: T;
  effort?: Effort;
  maxTokens?: number;
}): Promise<z.infer<T>> {
  if (!isAiConfigured()) throw new AiUnavailableError("ANTHROPIC_API_KEY is not set");
  const response = await getClient().beta.messages.parse({
    model: AI_MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    // Server-side refusal fallback: if a request is declined, the API re-runs it
    // on Anthropic's recommended fallback model within the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(opts.schema) },
    system: `${opts.system}\n\nStyle: never use em dashes (—). Use commas, periods or colons instead.`,
    messages: [{ role: "user", content: opts.prompt }],
  });
  if (response.stop_reason === "refusal") throw new Error("The AI declined this request.");
  if (response.stop_reason === "max_tokens") throw new Error("The AI response was truncated.");
  if (response.parsed_output == null) throw new Error("The AI returned an unparseable response.");
  return withoutEmDashes(response.parsed_output) as z.infer<T>;
}

/** House style: no em dashes anywhere in the app, including AI-written text. */
export function withoutEmDashes<V>(value: V): V {
  if (typeof value === "string") return value.replace(/\s*—\s*/g, ", ").replace(/ – /g, ", ") as V;
  if (Array.isArray(value)) return value.map(withoutEmDashes) as V;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withoutEmDashes(v)])) as V;
  return value;
}
