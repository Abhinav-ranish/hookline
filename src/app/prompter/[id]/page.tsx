import { notFound } from "next/navigation";
import { Teleprompter } from "@/components/Teleprompter";
import { getMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PrompterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const message = await getMessage(id);
  if (!message?.script) notFound();
  return <Teleprompter hook={message.script.hook.spoken} beats={message.script.beats.map((b) => b.spoken)} title={message.script.title} />;
}
