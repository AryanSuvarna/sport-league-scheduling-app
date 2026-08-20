import { notFound } from "next/navigation";
import { LeagueDetailClient } from "./LeagueDetailClient";
import type { League } from "@/lib/leagues";
import { createClient } from "@/lib/supabase/server";

type LeaguePageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function LeaguePage({ params }: LeaguePageProps) {
  const { leagueId } = await params;
  const supabase = await createClient();
  const { data: league, error } = await supabase
    .from("leagues")
    .select(
      `
        id,
        name,
        sport,
        season_start_date,
        season_end_date,
        match_duration_minutes,
        max_matches_per_team_per_week,
        scheduler_rules,
        league_teams (
          id,
          name,
          captain_name,
          captain_phone,
          captain_email
        )
      `,
    )
    .eq("id", leagueId)
    .single()
    .returns<League>();

  if (error || !league) {
    notFound();
  }

  return <LeagueDetailClient league={league} />;
}
