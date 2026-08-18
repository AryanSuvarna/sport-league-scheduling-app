import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type LeagueRow = {
  id: string;
  season_start_date: string;
  season_end_date: string;
  match_duration_minutes: number;
  max_matches_per_team_per_week: number;
  league_teams: LeagueTeamRow[];
};

type LeagueTeamRow = { id: string; name: string };

type TeamAvailabilityRow = {
  team_id: string;
  available_start_date: string | null;
  available_end_date: string | null;
  available_dates: string[];
  blackout_dates: string[];
  has_day_preference: boolean;
  preferred_days_of_week: string[];
  has_time_preference: boolean;
  preferred_times_of_day: string[];
  created_at: string;
};

type VenueAvailabilityRow = {
  id: string;
  field_id: string;
  permit_date: string;
  permit_start_time: string;
  permit_end_time: string;
  capacity: number;
};

type SolverMatch = {
  home_team_id: string;
  away_team_id: string;
  slot_id: string;
  field_id: string;
  starts_at: string;
  ends_at: string;
};

type SolverResponse = {
  status: "optimal" | "feasible" | "infeasible" | "unknown";
  matches: SolverMatch[];
  objective_value: number | null;
};

type GenerateOptions = {
  gamesPerPair?: number;
  maxMatchesPerTeamPerDay?: number;
  minRestHours?: number;
};

const weekdayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function addMinutes(date: string, time: string, minutes: number) {
  // Postgres `time` values can arrive as `18:00:00+00`; permit times are
  // local wall-clock times, so discard the transport timezone suffix before
  // constructing the slot timestamp.
  const localTime = time.slice(0, 8);
  const value = new Date(`${date}T${localTime}`);
  value.setMinutes(value.getMinutes() + minutes);
  return value;
}

function formatLocalDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function teamCanPlayOnDate(availability: TeamAvailabilityRow, date: string) {
  if (availability.blackout_dates.includes(date)) {
    return false;
  }

  const insideRange =
    availability.available_start_date !== null &&
    availability.available_end_date !== null &&
    date >= availability.available_start_date &&
    date <= availability.available_end_date;

  return insideRange || availability.available_dates.includes(date);
}

function teamPrefersSlot(
  availability: TeamAvailabilityRow,
  date: string,
  startsAt: Date,
) {
  const day = weekdayNames[startsAt.getDay()];
  const hour = startsAt.getHours();
  const timeOfDay = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
  const prefersDay =
    !availability.has_day_preference || availability.preferred_days_of_week.includes(day);
  const prefersTime =
    !availability.has_time_preference || availability.preferred_times_of_day.includes(timeOfDay);

  return teamCanPlayOnDate(availability, date) && prefersDay && prefersTime;
}

function buildSlots(
  permits: VenueAvailabilityRow[],
  league: LeagueRow,
  availabilityByTeamId: Map<string, TeamAvailabilityRow>,
) {
  return permits.flatMap((permit) => {
    const permitStart = addMinutes(permit.permit_date, permit.permit_start_time, 0);
    const permitEnd = addMinutes(permit.permit_date, permit.permit_end_time, 0);
    const slots = [];

    for (
      let start = permitStart;
      start.getTime() + league.match_duration_minutes * 60_000 <= permitEnd.getTime();
      start = new Date(start.getTime() + league.match_duration_minutes * 60_000)
    ) {
      const end = new Date(start.getTime() + league.match_duration_minutes * 60_000);
      const id = `${permit.id}:${formatLocalDateTime(start)}`;
      const date = permit.permit_date;
      slots.push({
        id,
        field_id: permit.field_id,
        source_permit_id: permit.id,
        starts_at: formatLocalDateTime(start),
        ends_at: formatLocalDateTime(end),
        capacity: permit.capacity,
        date,
        start,
        allowed_team_ids: [...availabilityByTeamId.entries()]
          .filter(([, availability]) => teamCanPlayOnDate(availability, date))
          .map(([teamId]) => teamId),
        preferred_team_ids: [...availabilityByTeamId.entries()]
          .filter(([, availability]) => teamPrefersSlot(availability, date, start))
          .map(([teamId]) => teamId),
      });
    }

    return slots;
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ leagueId: string }> },
) {
  const { leagueId } = await context.params;
  let options: GenerateOptions = {};

  try {
    options = (await request.json()) as GenerateOptions;
  } catch {
    // A request body is optional; default settings create one round robin.
  }

  if (
    (options.gamesPerPair !== undefined && (!Number.isInteger(options.gamesPerPair) || options.gamesPerPair < 1)) ||
    (options.maxMatchesPerTeamPerDay !== undefined &&
      (!Number.isInteger(options.maxMatchesPerTeamPerDay) ||
        options.maxMatchesPerTeamPerDay < 1 ||
        options.maxMatchesPerTeamPerDay > 4)) ||
    (options.minRestHours !== undefined && (!Number.isInteger(options.minRestHours) || options.minRestHours < 0))
  ) {
    return NextResponse.json({ error: "Invalid scheduling options." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select(
      "id, season_start_date, season_end_date, match_duration_minutes, max_matches_per_team_per_week, league_teams(id, name)",
    )
    .eq("id", leagueId)
    .single()
    .returns<LeagueRow>();

  if (leagueError || !league) {
    return NextResponse.json({ error: "League not found." }, { status: 404 });
  }

  const [teamAvailabilityResult, venueAvailabilityResult] = await Promise.all([
    supabase
      .from("team_availability_submissions")
      .select(
        "team_id, available_start_date, available_end_date, available_dates, blackout_dates, has_day_preference, preferred_days_of_week, has_time_preference, preferred_times_of_day, created_at",
      )
      .in(
        "team_id",
        league.league_teams.map((team) => team.id),
      )
      .order("created_at", { ascending: false })
      .returns<TeamAvailabilityRow[]>(),
    supabase
      .from("venue_availability")
      .select("id, field_id, permit_date, permit_start_time, permit_end_time, capacity")
      .eq("league_id", leagueId)
      .gte("permit_date", league.season_start_date)
      .lte("permit_date", league.season_end_date)
      .order("permit_date", { ascending: true })
      .order("permit_start_time", { ascending: true })
      .returns<VenueAvailabilityRow[]>(),
  ]);

  if (teamAvailabilityResult.error || venueAvailabilityResult.error) {
    return NextResponse.json(
      { error: teamAvailabilityResult.error?.message ?? venueAvailabilityResult.error?.message },
      { status: 500 },
    );
  }

  const latestAvailabilityByTeamId = new Map<string, TeamAvailabilityRow>();
  for (const availability of teamAvailabilityResult.data ?? []) {
    if (!latestAvailabilityByTeamId.has(availability.team_id)) {
      latestAvailabilityByTeamId.set(availability.team_id, availability);
    }
  }

  const missingTeams = league.league_teams.filter(
    (team) => !latestAvailabilityByTeamId.has(team.id),
  );
  if (missingTeams.length > 0) {
    return NextResponse.json(
      {
        error: "Every league team needs a matching availability submission before scheduling.",
        missing_teams: missingTeams.map((team) => team.name),
      },
      { status: 409 },
    );
  }

  const availabilityByTeamId = new Map(
    league.league_teams.map((team) => [
      team.id,
      latestAvailabilityByTeamId.get(team.id)!,
    ]),
  );
  const slots = buildSlots(venueAvailabilityResult.data ?? [], league, availabilityByTeamId);
  if (slots.length === 0) {
    return NextResponse.json(
      { error: "No venue permits contain a complete match-duration slot in this league season." },
      { status: 409 },
    );
  }

  const schedulerUrl = process.env.SCHEDULER_SERVICE_URL;
  if (!schedulerUrl) {
    return NextResponse.json({ error: "SCHEDULER_SERVICE_URL is not configured." }, { status: 503 });
  }

  const solverPayload = {
    teams: league.league_teams.map((team) => ({
      id: team.id,
      name: team.name,
      allowed_slot_ids: slots
        .filter((slot) => slot.allowed_team_ids.includes(team.id))
        .map((slot) => slot.id),
      preferred_slot_ids: slots
        .filter((slot) => slot.preferred_team_ids.includes(team.id))
        .map((slot) => slot.id),
    })),
    slots: slots.map((slot) => ({
      id: slot.id,
      field_id: slot.field_id,
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      capacity: slot.capacity,
    })),
    settings: {
      games_per_pair: options.gamesPerPair ?? 1,
      max_matches_per_team_per_week: league.max_matches_per_team_per_week,
      max_matches_per_team_per_day: options.maxMatchesPerTeamPerDay ?? 1,
      min_rest_hours: options.minRestHours ?? 0,
    },
  };

  let solverResponse: SolverResponse;
  try {
    const response = await fetch(`${schedulerUrl.replace(/\/$/, "")}/v1/schedules:generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(solverPayload),
    });
    solverResponse = (await response.json()) as SolverResponse;
    if (!response.ok) {
      return NextResponse.json({ error: "Scheduler rejected the input.", detail: solverResponse }, { status: 422 });
    }
  } catch {
    return NextResponse.json({ error: "Scheduler service is unavailable." }, { status: 503 });
  }

  if (solverResponse.status === "infeasible" || solverResponse.status === "unknown") {
    return NextResponse.json(
      {
        error:
          solverResponse.status === "infeasible"
            ? "No valid schedule fits the current team availability, venue permits, and match limits."
            : "The scheduler could not determine a valid schedule. Please try again or adjust the constraints.",
        detail: solverResponse,
      },
      { status: 422 },
    );
  }

  const { data: scheduleRun, error: scheduleRunError } = await supabase
    .from("league_schedule_runs")
    .insert({
      league_id: league.id,
      solver_status: solverResponse.status,
      schedule_status: "draft",
      input_snapshot: solverPayload,
      objective_value: solverResponse.objective_value,
    })
    .select("id")
    .single<{ id: string }>();

  if (scheduleRunError || !scheduleRun) {
    return NextResponse.json({ error: scheduleRunError?.message ?? "Could not save schedule." }, { status: 500 });
  }

  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const { error: matchesError } = await supabase.from("league_matches").insert(
    solverResponse.matches.map((match) => {
      const slot = slotById.get(match.slot_id)!;
      return {
        schedule_run_id: scheduleRun.id,
        home_team_id: match.home_team_id,
        away_team_id: match.away_team_id,
        field_id: match.field_id,
        venue_availability_id: slot.source_permit_id,
        starts_at: match.starts_at,
        ends_at: match.ends_at,
        match_status: "scheduled",
      };
    }),
  );

  if (matchesError) {
    return NextResponse.json(
      { error: `Schedule run ${scheduleRun.id} was saved, but its matches were not: ${matchesError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ...solverResponse, schedule_run_id: scheduleRun.id }, { status: 201 });
}
