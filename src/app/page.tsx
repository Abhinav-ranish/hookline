import { Chat } from "@/components/Chat";
import { getSetting, latestTrendScan, listConversations } from "@/lib/db";
import { apifyEnabled } from "@/lib/apify";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [conversations, notes, name, latestScan] = await Promise.all([listConversations(), getSetting("notes"), getSetting("name"), latestTrendScan()]);
  return <Chat initialConversations={conversations} initialNotes={notes} initialName={name} latestScan={latestScan} trendsOn={apifyEnabled()} />;
}
