import { NextResponse } from "next/server";
import { loadScheduleEditorData } from "@/lib/scheduling/editor-data";

export async function GET(_request: Request, context: RouteContext<"/api/leagues/[leagueId]/schedule/editor">) {
  const { leagueId } = await context.params;
  const data = await loadScheduleEditorData(leagueId);
  if (!data) return NextResponse.json({ error: "League not found." }, { status: 404 });
  return NextResponse.json(data);
}
