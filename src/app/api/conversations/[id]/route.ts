import { deleteConversation, listMessages } from "@/lib/db";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  return Response.json(await listMessages((await params).id));
}

export async function DELETE(_request: Request, { params }: Context) {
  await deleteConversation((await params).id);
  return new Response(null, { status: 204 });
}
