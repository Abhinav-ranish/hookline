import { z } from "zod";

export type Tier = "fast" | "hook" | "write";

const MODELS: Record<Tier, { model: string; effort: string }> = {
  fast: { model: "gpt-6-luna", effort: "low" },
  hook: { model: "gpt-6.1-sol", effort: "medium" },
  write: { model: "gpt-6.1-terra", effort: "medium" },
};

type Request = { tier: Tier; system: string; user: string; name: string; schema: Record<string, unknown> };

async function callOpenAI({ tier, system, user, name, schema }: Request): Promise<string> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set.");
  const { model, effort } = MODELS[tier];
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      instructions: system,
      input: user,
      reasoning: { effort },
      text: { format: { type: "json_schema", name, strict: true, schema } },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  const data = (await response.json()) as any;
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${data.error?.message ?? "request failed"}`);
  const text = (data.output ?? [])
    .flatMap((item: any) => item.content ?? [])
    .find((part: any) => part.type === "output_text")?.text;
  if (!text) throw new Error("OpenAI returned no text");
  return text;
}

export async function generate<S extends z.ZodType>(opts: { tier: Tier; system: string; user: string; name: string; schema: S }): Promise<z.infer<S>> {
  const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(opts.schema, { target: "draft-7" }) as Record<string, unknown>;
  const request: Request = { tier: opts.tier, system: opts.system, user: opts.user, name: opts.name, schema: jsonSchema };
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return opts.schema.parse(JSON.parse(await callOpenAI(request)));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
