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
  match_rules: string[];
  league_teams: LeagueTeam[];
};

export function formatSeason(startDate: string, endDate: string) {
  return `${startDate} to ${endDate}`;
}
