export type ConstraintSeverity = "conflict" | "warning";

export type ScheduleIssue = {
  id: string;
  matchId: string;
  severity: ConstraintSeverity;
  code: string;
  title: string;
  detail: string;
};

export type EditorTeam = { id: string; name: string };

export type EditorAvailability = {
  team_id: string;
  available_start_date: string | null;
  available_end_date: string | null;
  available_dates: string[];
  blackout_dates: string[];
  has_day_preference: boolean;
  preferred_days_of_week: string[];
  has_time_preference: boolean;
  preferred_times_of_day: string[];
};

export type EditorPermit = {
  id: string;
  field_id: string;
  permit_date: string;
  permit_start_time: string;
  permit_end_time: string;
  capacity: number;
};

export type EditorMatch = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  field_id: string | null;
  venue_availability_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  match_status: "scheduled" | "confirmed" | "played" | "cancelled";
  is_locked: boolean;
  home_team_name: string;
  away_team_name: string;
  field_label: string | null;
  venue_name: string | null;
};

export type ValidationContext = {
  matches: EditorMatch[];
  permits: EditorPermit[];
  availabilityByTeamId: Map<string, EditorAvailability>;
  matchDurationMinutes: number;
  maxMatchesPerTeamPerWeek: number;
  minRestHours?: number;
};

export type SuggestedSlot = {
  startsAt: string;
  endsAt: string;
  fieldId: string;
  permitId: string;
  warningCount: number;
};

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function localDate(value: string) {
  return new Date(value.length === 10 ? `${value}T00:00:00` : value);
}

function datePart(value: string) {
  return value.slice(0, 10);
}

function timePart(value: string) {
  const date = localDate(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:00`;
}

function toDateTime(date: string, time: string) {
  return new Date(`${date}T${time.slice(0, 8)}`);
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

function teamCanPlay(availability: EditorAvailability | undefined, date: string) {
  if (!availability) return false;
  if (availability.blackout_dates.includes(date)) return false;
  return (
    (availability.available_start_date !== null &&
      availability.available_end_date !== null &&
      date >= availability.available_start_date &&
      date <= availability.available_end_date) ||
    availability.available_dates.includes(date)
  );
}

function teamPrefers(availability: EditorAvailability | undefined, startsAt: Date) {
  if (!availability) return false;
  const day = weekdays[startsAt.getDay()];
  const hour = startsAt.getHours();
  const timeOfDay = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
  return (
    (!availability.has_day_preference || availability.preferred_days_of_week.includes(day)) &&
    (!availability.has_time_preference || availability.preferred_times_of_day.includes(timeOfDay))
  );
}

function issue(matchId: string, severity: ConstraintSeverity, code: string, title: string, detail: string): ScheduleIssue {
  return { id: `${matchId}:${code}`, matchId, severity, code, title, detail };
}

export function validateMatchAssignment(
  match: EditorMatch,
  candidate: { startsAt: string | null; fieldId: string | null },
  context: ValidationContext,
) {
  const issues: ScheduleIssue[] = [];
  if (!candidate.startsAt || !candidate.fieldId) {
    return [issue(match.id, "conflict", "unscheduled", "Match is unscheduled", "Choose a date, time, and field to place this fixture.")];
  }

  const startsAt = localDate(candidate.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return [issue(match.id, "conflict", "invalid_time", "Invalid start time", "Choose a valid local date and time.")];
  }
  const endsAt = new Date(startsAt.getTime() + context.matchDurationMinutes * 60_000);
  const date = datePart(candidate.startsAt);
  const permit = context.permits.find((item) => {
    if (item.field_id !== candidate.fieldId || item.permit_date !== date) return false;
    const permitStart = toDateTime(date, item.permit_start_time);
    const permitEnd = toDateTime(date, item.permit_end_time);
    return permitStart <= startsAt && endsAt <= permitEnd;
  });

  if (!permit) {
    issues.push(issue(match.id, "conflict", "venue_unavailable", "Venue unavailable", "This field has no permit covering the full match time."));
  }

  for (const [teamId, teamName] of [[match.home_team_id, match.home_team_name], [match.away_team_id, match.away_team_name]] as const) {
    const availability = context.availabilityByTeamId.get(teamId);
    if (!teamCanPlay(availability, date)) {
      issues.push(issue(match.id, "conflict", `team_unavailable:${teamId}`, `${teamName} unavailable`, `${teamName} is not available on this date.`));
    } else if (!teamPrefers(availability, startsAt)) {
      issues.push(issue(match.id, "warning", `preference:${teamId}`, `${teamName} preference`, `${teamName}'s preferred day or time is not met.`));
    }
  }

  const occupiedFieldMatches = context.matches.filter((other) =>
    other.id !== match.id && other.field_id === candidate.fieldId && other.starts_at && other.ends_at &&
    rangesOverlap(startsAt, endsAt, localDate(other.starts_at), localDate(other.ends_at)),
  );
  if (permit && occupiedFieldMatches.length >= permit.capacity) {
    issues.push(issue(match.id, "conflict", "field_double_booked", "Field double booked", "This field is already at its permitted capacity for this time."));
  }

  const relatedMatches = context.matches.filter((other) =>
    other.id !== match.id && other.starts_at && other.ends_at &&
    (other.home_team_id === match.home_team_id || other.away_team_id === match.home_team_id || other.home_team_id === match.away_team_id || other.away_team_id === match.away_team_id),
  );
  const restMilliseconds = (context.minRestHours ?? 0) * 60 * 60 * 1000;
  for (const other of relatedMatches) {
    const otherStart = localDate(other.starts_at!);
    const otherEnd = localDate(other.ends_at!);
    if (rangesOverlap(startsAt, endsAt, otherStart, otherEnd)) {
      issues.push(issue(match.id, "conflict", `team_overlap:${other.id}`, "Team double booked", "One of these teams already has a match at this time."));
      break;
    }
    if (restMilliseconds > 0 && !(endsAt.getTime() + restMilliseconds <= otherStart.getTime() || otherEnd.getTime() + restMilliseconds <= startsAt.getTime())) {
      issues.push(issue(match.id, "warning", `short_rest:${other.id}`, "Short rest period", "This assignment leaves less recovery time than the configured minimum."));
      break;
    }
  }

  const isoWeek = (value: Date) => {
    const copy = new Date(value);
    copy.setHours(0, 0, 0, 0);
    copy.setDate(copy.getDate() + 3 - ((copy.getDay() + 6) % 7));
    const firstThursday = new Date(copy.getFullYear(), 0, 4);
    return `${copy.getFullYear()}-${1 + Math.round(((copy.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7)}`;
  };
  for (const teamId of [match.home_team_id, match.away_team_id]) {
    const count = relatedMatches.filter((other) =>
      (other.home_team_id === teamId || other.away_team_id === teamId) && isoWeek(localDate(other.starts_at!)) === isoWeek(startsAt),
    ).length + 1;
    if (count > context.maxMatchesPerTeamPerWeek) {
      issues.push(issue(match.id, "warning", `weekly_load:${teamId}`, "Weekly match limit", "This team exceeds the preferred maximum matches for the week."));
    }
  }
  return issues;
}

export function getScheduleIssues(matches: EditorMatch[], context: ValidationContext) {
  return matches.flatMap((match) => validateMatchAssignment(match, { startsAt: match.starts_at, fieldId: match.field_id }, context));
}

export function validSlotCount(match: EditorMatch, context: ValidationContext) {
  return context.permits.reduce((count, permit) => {
    const start = `${permit.permit_date}T${permit.permit_start_time.slice(0, 8)}`;
    const end = toDateTime(permit.permit_date, permit.permit_end_time);
    const slotEnd = new Date(localDate(start).getTime() + context.matchDurationMinutes * 60_000);
    if (slotEnd > end) return count;
    return validateMatchAssignment(match, { startsAt: start, fieldId: permit.field_id }, context).some((item) => item.severity === "conflict") ? count : count + 1;
  }, 0);
}

export function getSuggestedSlots(match: EditorMatch, context: ValidationContext, limit = 6): SuggestedSlot[] {
  const candidates: SuggestedSlot[] = [];
  for (const permit of context.permits) {
    const permitEnd = toDateTime(permit.permit_date, permit.permit_end_time);
    for (let startsAt = toDateTime(permit.permit_date, permit.permit_start_time); startsAt.getTime() + context.matchDurationMinutes * 60_000 <= permitEnd.getTime(); startsAt = new Date(startsAt.getTime() + context.matchDurationMinutes * 60_000)) {
      const candidateStart = formatLocalDateTime(startsAt);
      const validation = validateMatchAssignment(match, { startsAt: candidateStart, fieldId: permit.field_id }, context);
      if (validation.some((entry) => entry.severity === "conflict")) continue;
      candidates.push({ startsAt: candidateStart, endsAt: assignmentEnd(candidateStart, context.matchDurationMinutes), fieldId: permit.field_id, permitId: permit.id, warningCount: validation.length });
    }
  }
  return candidates.toSorted((first, second) => first.warningCount - second.warningCount || first.startsAt.localeCompare(second.startsAt)).slice(0, limit);
}

export function assignmentEnd(startsAt: string, durationMinutes: number) {
  const end = new Date(localDate(startsAt).getTime() + durationMinutes * 60_000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}:${pad(end.getSeconds())}`;
}

export function assignmentTime(value: string) {
  return timePart(value);
}

function formatLocalDateTime(value: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}
