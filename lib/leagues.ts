export type LeagueTeam = {
  id: string;
  name: string;
  captain_name: string;
  captain_phone: string;
  captain_email: string | null;
};

export type League = {
  id: string;
  name: string;
  sport: string;
  season_start_date: string;
  season_end_date: string;
  match_duration_minutes: number;
  max_matches_per_team_per_week: number;
  scheduler_rules: import("@/lib/scheduling/rules").SchedulerRule[];
  league_teams: LeagueTeam[];
};

export function formatSeason(startDate: string, endDate: string) {
  return `${formatDate(startDate)} to ${formatDate(endDate)}`;
}

function formatDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    return date;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}
