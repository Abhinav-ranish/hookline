import { listConversations } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = async () => Response.json(await listConversations());
