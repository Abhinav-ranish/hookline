import { z } from "zod";
import { getMessage, updateScript } from "@/lib/db";
import { beatSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const editSchema = z.object({ hookSpoken: z.string().trim().min(1), beats: z.array(beatSchema).min(1) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const script = (await getMessage(id))?.script;
  if (!script) return Response.json({ error: "Not found" }, { status: 404 });
  const parsed = editSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid edit" }, { status: 400 });
  const updated = { ...script, hook: { ...script.hook, spoken: parsed.data.hookSpoken }, beats: parsed.data.beats };
  await updateScript(id, updated);
  return Response.json(updated);
}
