import type { Availability, AvailabilityForm, VenueAvailabilityRow } from "./types";

const seasonEndDate = "";

export const dayOptions = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function createEmptyForm(): AvailabilityForm {
  const today = new Date();

  return {
    mode: "single",
    venueSearch: "",
    selectedVenueId: "",
    fieldId: "",
    capacity: "1",
    permitDate: "",
    recurringWeekday: String(today.getDay()),
    seriesStartDate: toDateInputValue(today),
    seriesEndDate: seasonEndDate,
    startTime: "",
    endTime: "",
  };
}

export function mapRowToAvailability(row: VenueAvailabilityRow): Availability {
  const field = row.fields;
  const venue = field?.venues;

  return {
    id: row.id,
    fieldId: row.field_id,
    venueId: venue?.id ?? field?.venue_id ?? "",
    venueName: venue?.name ?? "Unknown venue",
    venueAddress: venue?.address ?? "",
    fieldLabel: field?.label ?? "Main",
    capacity: row.capacity,
    permitDate: row.permit_date,
    startTime: row.permit_start_time.slice(0, 5),
    endTime: row.permit_end_time.slice(0, 5),
    entryType: row.entry_type ?? "single",
    recurringSeriesId: row.recurring_series_id,
    recurringWeekday: row.recurring_weekday,
    seriesStartDate: row.series_start_date,
    seriesEndDate: row.series_end_date,
  };
}

export function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateFormatter.format(date);
}

export function formatTime(value: string) {
  const [hourValue, minute] = value.split(":");
  const hour = Number(hourValue);

  if (Number.isNaN(hour) || minute === undefined) {
    return value;
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${suffix}`;
}

export function getDayName(value: string | number) {
  return dayOptions.find((day) => day.value === String(value))?.label ?? "day";
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

export function generateRecurringDates(
  seriesStartDate: string,
  seriesEndDate: string,
  weekday: number,
) {
  const startDate = new Date(`${seriesStartDate}T00:00:00`);
  const endDate = new Date(`${seriesEndDate}T00:00:00`);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return [];
  }

  const dayOffset = (weekday - startDate.getDay() + 7) % 7;
  const dates: string[] = [];

  for (
    let currentDate = addDays(startDate, dayOffset);
    currentDate <= endDate;
    currentDate = addDays(currentDate, 7)
  ) {
    dates.push(toDateInputValue(currentDate));
  }

  return dates;
}

export function timeRangesOverlap(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string,
) {
  return firstStart < secondEnd && firstEnd > secondStart;
}
