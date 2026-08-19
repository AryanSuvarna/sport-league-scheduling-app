import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ leagueId: string; runId: string }> };

type MatchRow = {
  home_team_id: string;
  away_team_id: string;
  field_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  match_status: string | null;
  is_locked: boolean | null;
};

function localDate(value: string | null) {
  return value?.slice(0, 10) ?? "Unscheduled";
}

function localTime(value: string | null) {
  return value?.slice(11, 16) ?? "";
}

function filenamePart(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "schedule";
}

export async function GET(_request: Request, context: RouteContext) {
  const { leagueId, runId } = await context.params;
  const supabase = await createClient();

  const [{ data: league, error: leagueError }, { data: run, error: runError }] = await Promise.all([
    supabase.from("leagues").select("id, name, sport").eq("id", leagueId).maybeSingle<{ id: string; name: string; sport: string }>(),
    supabase.from("league_schedule_runs").select("id, schedule_status, created_at").eq("id", runId).eq("league_id", leagueId).maybeSingle<{ id: string; schedule_status: string; created_at: string }>(),
  ]);

  if (leagueError || runError) return NextResponse.json({ error: leagueError?.message ?? runError?.message ?? "Could not load schedule export." }, { status: 500 });
  if (!league) return NextResponse.json({ error: "League not found." }, { status: 404 });
  if (!run) return NextResponse.json({ error: "Schedule run not found." }, { status: 404 });
  if (run.schedule_status !== "published") return NextResponse.json({ error: "Only published schedules can be exported." }, { status: 409 });

  const { data: matches, error: matchesError } = await supabase
    .from("league_matches")
    .select("home_team_id, away_team_id, field_id, starts_at, ends_at, match_status, is_locked")
    .eq("schedule_run_id", run.id)
    .order("starts_at", { ascending: true })
    .returns<MatchRow[]>();
  if (matchesError) return NextResponse.json({ error: matchesError.message }, { status: 500 });

  const teamIds = [...new Set((matches ?? []).flatMap((match) => [match.home_team_id, match.away_team_id]))];
  const fieldIds = [...new Set((matches ?? []).flatMap((match) => match.field_id ? [match.field_id] : []))];
  const [{ data: teams, error: teamsError }, { data: fields, error: fieldsError }] = await Promise.all([
    teamIds.length ? supabase.from("league_teams").select("id, name").in("id", teamIds) : Promise.resolve({ data: [], error: null }),
    fieldIds.length ? supabase.from("fields").select("id, label, venues(name, address)").in("id", fieldIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (teamsError || fieldsError) return NextResponse.json({ error: teamsError?.message ?? fieldsError?.message ?? "Could not load schedule details." }, { status: 500 });

  const teamNames = new Map((teams ?? []).map((team) => [team.id, team.name]));
  const fieldDetails = new Map(((fields ?? []) as Array<{ id: string; label: string; venues: { name: string; address: string } | null }>).map((field) => [field.id, field]));
  const rows = (matches ?? []).map((match) => {
    const field = match.field_id ? fieldDetails.get(match.field_id) : null;
    return {
      Date: localDate(match.starts_at),
      "Start time": localTime(match.starts_at),
      "End time": localTime(match.ends_at),
      "Home team": teamNames.get(match.home_team_id) ?? "Unknown team",
      "Away team": teamNames.get(match.away_team_id) ?? "Unknown team",
      Venue: field?.venues?.name ?? "",
      "Venue address": field?.venues?.address ?? "",
      Field: field?.label ?? "",
      Status: match.match_status ?? "scheduled",
      Locked: match.is_locked ? "Yes" : "No",
    };
  });

  const workbook = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet([
    ["Published schedule"],
    ["League", league.name],
    ["Sport", league.sport],
    ["Published schedule created", run.created_at.slice(0, 19).replace("T", " ")],
    ["Exported", new Date().toLocaleString("en-CA")],
    ["Fixtures", rows.length],
  ]);
  summary["!cols"] = [{ wch: 28 }, { wch: 42 }];
  XLSX.utils.book_append_sheet(workbook, summary, "Schedule summary");

  const schedule = XLSX.utils.json_to_sheet(rows);
  schedule["!cols"] = [
    { wch: 15 }, { wch: 13 }, { wch: 13 }, { wch: 26 }, { wch: 26 }, { wch: 28 }, { wch: 40 }, { wch: 18 }, { wch: 14 }, { wch: 10 },
  ];
  schedule["!autofilter"] = { ref: `A1:J${Math.max(rows.length + 1, 1)}` };
  XLSX.utils.book_append_sheet(workbook, schedule, "Matches");

  const file = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filenamePart(league.name)}-published-schedule.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
