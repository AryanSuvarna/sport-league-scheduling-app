import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { loadScheduleEditorData } from "@/lib/scheduling/editor-data";
import { createClient } from "@/lib/supabase/server";
import { ScheduleClient } from "./ScheduleClient";

export default async function SchedulePage({ params }: PageProps<"/leagues/[leagueId]/schedule">) {
  const { leagueId } = await params;
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) notFound();

  const supabase = await createClient();
  const { data: leagueOwner } = await supabase
    .from("leagues")
    .select("id")
    .eq("id", leagueId)
    .eq("owner_clerk_user_id", userId)
    .maybeSingle();
  if (!leagueOwner) notFound();

  const data = await loadScheduleEditorData(leagueId);
  if (!data) notFound();
  return <ScheduleClient initialData={data} />;
}
