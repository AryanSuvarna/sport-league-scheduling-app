import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ScheduleClient,
  type ScheduleLeague,
  type ScheduleMatch,
  type ScheduleRun,
} from "./ScheduleClient";

type SchedulePageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function SchedulePage({ params }: SchedulePageProps) {
  const { leagueId } = await params;
  const supabase = await createClient();
  const [leagueResult, runResult] = await Promise.all([
    supabase
      .from("leagues")
      .select(
        "id, name, sport, season_start_date, season_end_date, league_teams(id, name)",
      )
      .eq("id", leagueId)
      .single()
      .returns<ScheduleLeague>(),
    supabase
      .from("league_schedule_runs")
      .select("id, solver_status, objective_value, created_at")
      .eq("league_id", leagueId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<ScheduleRun>(),
  ]);
  const { data: league, error } = leagueResult;

  if (error || !league) {
    notFound();
  }

  if (runResult.error) {
    return (
      <ScheduleClient
        league={league}
        initialRun={null}
        initialMatches={[]}
        initialLoadError={`Could not load the latest schedule: ${runResult.error.message}`}
      />
    );
  }

  const run = runResult.data;
  if (!run) {
    return (
      <ScheduleClient
        league={league}
        initialRun={null}
        initialMatches={[]}
        initialLoadError=""
      />
    );
  }

  const { data: rawMatches, error: matchesError } = await supabase
    .from("league_matches")
    .select("id, home_team_id, away_team_id, field_id, starts_at, ends_at")
    .eq("schedule_run_id", run.id)
    .order("starts_at", { ascending: true });

  if (matchesError) {
    return (
      <ScheduleClient
        league={league}
        initialRun={run}
        initialMatches={[]}
        initialLoadError={`Could not load schedule matches: ${matchesError.message}`}
      />
    );
  }

  const fieldIds = [...new Set((rawMatches ?? []).map((match) => match.field_id))];
  const { data: fields, error: fieldsError } = fieldIds.length
    ? await supabase
        .from("fields")
        .select("id, label, venues(name)")
        .in("id", fieldIds)
    : { data: [], error: null };
  const teamNames = new Map(league.league_teams.map((team) => [team.id, team.name]));
  const fieldRows = (fields ?? []) as unknown as Array<{
    id: string;
    label: string;
    venues: { name: string } | null;
  }>;
  const fieldById = new Map(
    fieldRows.map((field) => [
      field.id,
      { label: field.label, venue: field.venues?.name ?? "Venue" },
    ]),
  );
  const matches: ScheduleMatch[] = (rawMatches ?? []).map((match) => {
    const field = fieldById.get(match.field_id);
    return {
      ...match,
      home_team_name: teamNames.get(match.home_team_id) ?? "Unknown team",
      away_team_name: teamNames.get(match.away_team_id) ?? "Unknown team",
      field_label: field?.label ?? "Field",
      venue_name: field?.venue ?? "Venue",
    };
  });

  return (
    <ScheduleClient
      league={league}
      initialRun={run}
      initialMatches={matches}
      initialLoadError={
        fieldsError ? `Could not load schedule fields: ${fieldsError.message}` : ""
      }
    />
  );
}
