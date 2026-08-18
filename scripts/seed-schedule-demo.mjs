import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.");
}

const supabase = createClient(supabaseUrl, supabaseKey);
const leagueName = "Schedule Editor Demo — Fall 2026";
const season = { start: "2026-08-16", end: "2026-10-18" };

const teams = [
  ["Toronto Comets", "Avery Patel", "416-555-0101", "comets@example.test", ["Sunday"], ["Afternoon"]],
  ["Lakeshore Lions", "Jordan Lee", "416-555-0102", "lions@example.test", ["Saturday"], ["Afternoon", "Evening"]],
  ["North York Strikers", "Morgan Chen", "416-555-0103", "strikers@example.test", ["Saturday", "Sunday"], ["Morning"]],
  ["Eastside Eagles", "Taylor Brooks", "416-555-0104", "eagles@example.test", ["Sunday"], ["Morning", "Afternoon"]],
  ["Midtown Monarchs", "Riley Singh", "416-555-0105", "monarchs@example.test", ["Wednesday", "Saturday"], ["Evening"]],
  ["Harbour Hawks", "Casey Martin", "416-555-0106", "hawks@example.test", ["Saturday"], ["Morning"]],
  ["West End Wolves", "Jamie Wilson", "416-555-0107", "wolves@example.test", ["Sunday"], ["Evening"]],
  ["Scarborough Spartans", "Quinn Davis", "416-555-0108", "spartans@example.test", ["Saturday", "Sunday"], ["Afternoon"]],
];

const blackouts = ["2026-08-22", "2026-08-23", "2026-08-29", "2026-08-30", "2026-09-05", "2026-09-06", "2026-09-12", "2026-09-13"];

function assertResult(result, description) {
  if (result.error) throw new Error(`${description}: ${result.error.message}`);
  return result.data;
}

function eachDate(start, end, visit) {
  const date = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (date <= last) {
    visit(date.toISOString().slice(0, 10), date.getDay());
    date.setDate(date.getDate() + 1);
  }
}

const existing = assertResult(
  await supabase.from("leagues").select("id").eq("name", leagueName).maybeSingle(),
  "Could not check for the demo league",
);

if (existing) {
  console.log(JSON.stringify({ leagueId: existing.id, reused: true, url: `/leagues/${existing.id}/schedule` }));
  process.exit(0);
}

const league = assertResult(
  await supabase
    .from("leagues")
    .insert({
      name: leagueName,
      sport: "Cricket",
      season_start_date: season.start,
      season_end_date: season.end,
      match_duration_minutes: 120,
      max_matches_per_team_per_week: 1,
      match_rules: ["Round robin", "120-minute matches", "One match per team per week"],
    })
    .select("id")
    .single(),
  "Could not create the demo league",
);

const teamRows = teams.map(([name, captainName, captainPhone, captainEmail]) => ({
  league_id: league.id,
  name,
  captain_name: captainName,
  captain_phone: captainPhone,
  captain_email: captainEmail,
}));
const createdTeams = assertResult(
  await supabase.from("league_teams").insert(teamRows).select("id, name"),
  "Could not create demo teams",
);

const teamIdByName = new Map(createdTeams.map((team) => [team.name, team.id]));
const availabilityRows = teams.map(([name, , , , preferredDays, preferredTimes], index) => ({
  team_id: teamIdByName.get(name),
  available_start_date: season.start,
  available_end_date: season.end,
  available_dates: [],
  blackout_dates: [blackouts[index]],
  has_day_preference: true,
  preferred_days_of_week: preferredDays,
  has_time_preference: true,
  preferred_times_of_day: preferredTimes,
  notes: "Demo availability for schedule editor testing.",
}));
assertResult(
  await supabase.from("team_availability_submissions").insert(availabilityRows),
  "Could not create demo team availability",
);

const venueRows = [
  { name: "Schedule Editor Demo North Grounds", address: "100 Demo Park Way, Toronto", ground_type: "Outdoor cricket ground", capacity: 1 },
  { name: "Schedule Editor Demo South Grounds", address: "200 Demo Park Way, Toronto", ground_type: "Outdoor cricket ground", capacity: 1 },
];
const venues = assertResult(
  await supabase.from("venues").insert(venueRows).select("id, name"),
  "Could not create demo venues",
);

const venueIdByName = new Map(venues.map((venue) => [venue.name, venue.id]));
const northVenueId = venueIdByName.get("Schedule Editor Demo North Grounds");
const southVenueId = venueIdByName.get("Schedule Editor Demo South Grounds");
if (!northVenueId || !southVenueId) throw new Error("Demo venues could not be identified.");

assertResult(
  await supabase.from("fields").insert({ venue_id: northVenueId, label: "Field 2" }).select("id"),
  "Could not create the second north field",
);
const fields = assertResult(
  await supabase
    .from("fields")
    .select("id, label, venue_id")
    .in("venue_id", [northVenueId, southVenueId]),
  "Could not load demo fields",
);

const fieldByKey = new Map(fields.map((field) => [`${field.venue_id}:${field.label}`, field.id]));
const northMain = fieldByKey.get(`${northVenueId}:Main`);
const northTwo = fieldByKey.get(`${northVenueId}:Field 2`);
const southMain = fieldByKey.get(`${southVenueId}:Main`);
if (!northMain || !northTwo || !southMain) throw new Error("Demo fields could not be identified.");

const permits = [];
eachDate(season.start, season.end, (permitDate, weekday) => {
  if (weekday === 6 || weekday === 0) {
    permits.push(
      { league_id: league.id, field_id: northMain, permit_date: permitDate, permit_start_time: "09:00", permit_end_time: "19:00", capacity: 1 },
      { league_id: league.id, field_id: northTwo, permit_date: permitDate, permit_start_time: "09:00", permit_end_time: "19:00", capacity: 1 },
      { league_id: league.id, field_id: southMain, permit_date: permitDate, permit_start_time: "10:00", permit_end_time: "18:00", capacity: 1 },
    );
  }
  if (weekday === 3) {
    permits.push({ league_id: league.id, field_id: northMain, permit_date: permitDate, permit_start_time: "18:00", permit_end_time: "22:00", capacity: 1 });
  }
});
assertResult(
  await supabase.from("venue_availability").insert(permits),
  "Could not create demo venue availability",
);

console.log(JSON.stringify({
  leagueId: league.id,
  reused: false,
  teams: createdTeams.length,
  availabilitySubmissions: availabilityRows.length,
  fields: 3,
  permits: permits.length,
  url: `/leagues/${league.id}/schedule`,
}));
