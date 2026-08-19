export type VenuePermitForSlot = {
  id: string;
  field_id: string;
  permit_date: string;
  permit_start_time: string;
  permit_end_time: string;
  capacity: number;
};

export type VenueSlot = {
  id: string;
  field_id: string;
  source_permit_id: string;
  starts_at: string;
  ends_at: string;
  date: string;
  capacity: number;
};

export type TeamAvailabilityForSlot = {
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

export type SolverVenueSlot = VenueSlot & {
  allowed_team_ids: string[];
  preferred_team_ids: string[];
};

const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function addMinutes(date: string, time: string, minutes: number) {
  const value = new Date(`${date}T${time.slice(0, 8)}`);
  value.setMinutes(value.getMinutes() + minutes);
  return value;
}

function formatLocalDateTime(value: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}

export function buildVenueSlots(
  permits: VenuePermitForSlot[],
  matchDurationMinutes: number,
): VenueSlot[] {
  return permits.flatMap((permit) => {
    const start = addMinutes(permit.permit_date, permit.permit_start_time, 0);
    const end = addMinutes(permit.permit_date, permit.permit_end_time, 0);
    const slots: VenueSlot[] = [];

    for (
      let cursor = start;
      cursor.getTime() + matchDurationMinutes * 60_000 <= end.getTime();
      cursor = new Date(cursor.getTime() + matchDurationMinutes * 60_000)
    ) {
      const slotEnd = new Date(cursor.getTime() + matchDurationMinutes * 60_000);
      slots.push({
        id: `${String(permit.id)}:${formatLocalDateTime(cursor)}`,
        field_id: permit.field_id,
        source_permit_id: String(permit.id),
        starts_at: formatLocalDateTime(cursor),
        ends_at: formatLocalDateTime(slotEnd),
        date: permit.permit_date,
        capacity: permit.capacity,
      });
    }

    return slots;
  });
}

function teamCanPlayOnDate(availability: TeamAvailabilityForSlot, date: string) {
  if (availability.blackout_dates.includes(date)) return false;
  const insideRange = availability.available_start_date !== null &&
    availability.available_end_date !== null &&
    date >= availability.available_start_date &&
    date <= availability.available_end_date;
  return insideRange || availability.available_dates.includes(date);
}

function teamPrefersSlot(availability: TeamAvailabilityForSlot, startsAt: Date, date: string) {
  const hour = startsAt.getHours();
  const timeOfDay = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
  return teamCanPlayOnDate(availability, date) &&
    (!availability.has_day_preference || availability.preferred_days_of_week.includes(weekdayNames[startsAt.getDay()])) &&
    (!availability.has_time_preference || availability.preferred_times_of_day.includes(timeOfDay));
}

/** Builds the complete, current solver slot universe from permits and team availability. */
export function buildSolverSlots(
  permits: VenuePermitForSlot[],
  matchDurationMinutes: number,
  availabilityByTeamId: Map<string, TeamAvailabilityForSlot>,
): SolverVenueSlot[] {
  return buildVenueSlots(permits, matchDurationMinutes).map((slot) => {
    const startsAt = new Date(slot.starts_at);
    return {
      ...slot,
      allowed_team_ids: [...availabilityByTeamId.entries()]
        .filter(([, availability]) => teamCanPlayOnDate(availability, slot.date))
        .map(([teamId]) => teamId),
      preferred_team_ids: [...availabilityByTeamId.entries()]
        .filter(([, availability]) => teamPrefersSlot(availability, startsAt, slot.date))
        .map(([teamId]) => teamId),
    };
  });
}

export function timestampToSlotId(
  permitId: string | null,
  startsAt: string,
  slots: VenueSlot[],
) {
  const normalized = startsAt.replace(/\.\d+Z?$/, "").slice(0, 19);
  return (
    slots.find(
      (slot) =>
        slot.source_permit_id === permitId &&
        slot.starts_at.replace(/\.\d+Z?$/, "").slice(0, 19) === normalized,
    )?.id ?? null
  );
}
