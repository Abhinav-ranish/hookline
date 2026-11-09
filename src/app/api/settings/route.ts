import { z } from "zod";
import { setSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const parsed = z.object({ notes: z.string().max(4000), name: z.string().trim().max(60) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid settings" }, { status: 400 });
  await Promise.all([setSetting("notes", parsed.data.notes), setSetting("name", parsed.data.name)]);
  return new Response(null, { status: 204 });
}
