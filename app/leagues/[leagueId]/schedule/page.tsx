import { notFound } from "next/navigation";
import { loadScheduleEditorData } from "@/lib/scheduling/editor-data";
import { ScheduleClient } from "./ScheduleClient";

export default async function SchedulePage({ params }: PageProps<"/leagues/[leagueId]/schedule">) {
  const { leagueId } = await params;
  const data = await loadScheduleEditorData(leagueId);
  if (!data) notFound();
  return <ScheduleClient initialData={data} />;
}
