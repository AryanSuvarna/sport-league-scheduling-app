"use client";

import {
  type CSSProperties,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type EntryMode = "single" | "recurring";

type Availability = {
  id: string;
  venueName: string;
  permitDate: string;
  startTime: string;
  endTime: string;
  entryType: EntryMode;
  recurringSeriesId: string | null;
  recurringWeekday: number | null;
  seriesStartDate: string | null;
  seriesEndDate: string | null;
  isPendingInsert: boolean;
};

type AvailabilityForm = {
  mode: EntryMode;
  venueName: string;
  permitDate: string;
  recurringWeekday: string;
  seriesStartDate: string;
  seriesEndDate: string;
  startTime: string;
  endTime: string;
};

type VenueAvailabilityRow = {
  id: string;
  venue_name: string;
  permit_date: string;
  permit_start_time: string;
  permit_end_time: string;
  entry_type: EntryMode | null;
  recurring_series_id: string | null;
  recurring_weekday: number | null;
  series_start_date: string | null;
  series_end_date: string | null;
};

type OccurrenceDraft = {
  venueName: string;
  permitDate: string;
  startTime: string;
  endTime: string;
};

const seasonEndDate = "";

const dayOptions = [
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

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createEmptyForm(): AvailabilityForm {
  const today = new Date();

  return {
    mode: "single",
    venueName: "",
    permitDate: "",
    recurringWeekday: String(today.getDay()),
    seriesStartDate: toDateInputValue(today),
    seriesEndDate: seasonEndDate,
    startTime: "",
    endTime: "",
  };
}

function mapRowToAvailability(row: VenueAvailabilityRow): Availability {
  return {
    id: row.id,
    venueName: row.venue_name,
    permitDate: row.permit_date,
    startTime: row.permit_start_time.slice(0, 5),
    endTime: row.permit_end_time.slice(0, 5),
    entryType: row.entry_type ?? "single",
    recurringSeriesId: row.recurring_series_id,
    recurringWeekday: row.recurring_weekday,
    seriesStartDate: row.series_start_date,
    seriesEndDate: row.series_end_date,
    isPendingInsert: false,
  };
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateFormatter.format(date);
}

function formatTime(value: string) {
  const [hourValue, minute] = value.split(":");
  const hour = Number(hourValue);

  if (Number.isNaN(hour) || minute === undefined) {
    return value;
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${suffix}`;
}

function getDayName(value: string | number) {
  return dayOptions.find((day) => day.value === String(value))?.label ?? "day";
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function generateRecurringDates(
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

function timeRangesOverlap(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string,
) {
  return firstStart < secondEnd && firstEnd > secondStart;
}

function sameVenue(firstVenue: string, secondVenue: string) {
  return firstVenue.trim().toLowerCase() === secondVenue.trim().toLowerCase();
}

function buildInsertRows(availabilitiesToInsert: Availability[]) {
  return availabilitiesToInsert.map((availability) => ({
    venue_name: availability.venueName,
    permit_date: availability.permitDate,
    permit_start_time: availability.startTime,
    permit_end_time: availability.endTime,
    entry_type: availability.entryType,
    recurring_series_id: availability.recurringSeriesId,
    recurring_weekday: availability.recurringWeekday,
    series_start_date: availability.seriesStartDate,
    series_end_date: availability.seriesEndDate,
  }));
}

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [form, setForm] = useState<AvailabilityForm>(createEmptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState<Availability | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [availabilityPanelHeight, setAvailabilityPanelHeight] = useState<number | null>(
    null,
  );

  const sortedAvailabilities = useMemo(
    () =>
      availabilities.toSorted((first, second) => {
        const firstDateTime = `${first.permitDate} ${first.startTime}`;
        const secondDateTime = `${second.permitDate} ${second.startTime}`;

        return firstDateTime.localeCompare(secondDateTime);
      }),
    [availabilities],
  );
  const pendingInsertCount = useMemo(
    () => availabilities.filter((availability) => availability.isPendingInsert).length,
    [availabilities],
  );

  const overlapIds = useMemo(() => {
    const overlappingIds = new Set<string>();

    for (let firstIndex = 0; firstIndex < availabilities.length; firstIndex += 1) {
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < availabilities.length;
        secondIndex += 1
      ) {
        const first = availabilities[firstIndex];
        const second = availabilities[secondIndex];

        if (
          sameVenue(first.venueName, second.venueName) &&
          first.permitDate === second.permitDate &&
          timeRangesOverlap(first.startTime, first.endTime, second.startTime, second.endTime)
        ) {
          overlappingIds.add(first.id);
          overlappingIds.add(second.id);
        }
      }
    }

    return overlappingIds;
  }, [availabilities]);

  const isEditing = editingId !== null;
  const availabilityPanelStyle = useMemo(
    () =>
      ({
        "--availability-panel-height": availabilityPanelHeight
          ? `${availabilityPanelHeight}px`
          : "70svh",
      }) as CSSProperties,
    [availabilityPanelHeight],
  );

  useEffect(() => {
    const formElement = formRef.current;

    if (!formElement || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      const nextHeight = Math.ceil(formElement.getBoundingClientRect().height);

      setAvailabilityPanelHeight((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight,
      );
    });

    observer.observe(formElement);

    return () => observer.disconnect();
  }, []);

  const recurringSummary = useMemo(() => {
    if (
      form.mode !== "recurring" ||
      !form.recurringWeekday ||
      !form.startTime ||
      !form.endTime ||
      !form.seriesEndDate
    ) {
      return "";
    }

    return `Every ${getDayName(form.recurringWeekday)}, ${formatTime(
      form.startTime,
    )} - ${formatTime(form.endTime)}, through ${formatDate(form.seriesEndDate)}`;
  }, [form.endTime, form.mode, form.recurringWeekday, form.seriesEndDate, form.startTime]);

  const loadAvailabilities = useCallback(async (preservePendingInserts = true) => {
    const { data, error } = await supabase
      .from("venue_availability")
      .select(
        [
          "id",
          "venue_name",
          "permit_date",
          "permit_start_time",
          "permit_end_time",
          "entry_type",
          "recurring_series_id",
          "recurring_weekday",
          "series_start_date",
          "series_end_date",
        ].join(", "),
      )
      .order("permit_date", { ascending: true })
      .order("permit_start_time", { ascending: true });

    if (error) {
      setMessage(`Could not load availabilities: ${error.message}`);
      setAvailabilities((currentAvailabilities) =>
        preservePendingInserts
          ? currentAvailabilities.filter((availability) => availability.isPendingInsert)
          : [],
      );
    } else {
      const rows = (data ?? []) as unknown as VenueAvailabilityRow[];
      const databaseAvailabilities = rows.map(mapRowToAvailability);

      setAvailabilities((currentAvailabilities) => [
        ...databaseAvailabilities,
        ...(preservePendingInserts
          ? currentAvailabilities.filter((availability) => availability.isPendingInsert)
          : []),
      ]);
    }

    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    void Promise.resolve().then(() => loadAvailabilities());
  }, [loadAvailabilities]);

  function updateField(field: keyof AvailabilityForm, value: string) {
    setMessage("");
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(createEmptyForm());
    setEditingId(null);
    setEditingSource(null);
  }

  function validateAndBuildOccurrences() {
    if (form.startTime >= form.endTime) {
      return {
        error: "Permit end time must be after the start time.",
        occurrences: [],
      };
    }

    if (form.mode === "single") {
      return {
        error: "",
        occurrences: [
          {
            venueName: form.venueName.trim(),
            permitDate: form.permitDate,
            startTime: form.startTime,
            endTime: form.endTime,
          },
        ],
      };
    }

    if (form.seriesEndDate < form.seriesStartDate) {
      return {
        error: "Recurring series end date must be on or after the start date.",
        occurrences: [],
      };
    }

    const recurringDates = generateRecurringDates(
      form.seriesStartDate,
      form.seriesEndDate,
      Number(form.recurringWeekday),
    );

    if (recurringDates.length === 0) {
      return {
        error: "No permit dates match that recurring rule.",
        occurrences: [],
      };
    }

    return {
      error: "",
      occurrences: recurringDates.map((permitDate) => ({
        venueName: form.venueName.trim(),
        permitDate,
        startTime: form.startTime,
        endTime: form.endTime,
      })),
    };
  }

  function findOverlappingOccurrences(occurrences: OccurrenceDraft[]) {
    return occurrences.filter((occurrence) =>
      availabilities.some(
        (availability) =>
          availability.id !== editingId &&
          sameVenue(availability.venueName, occurrence.venueName) &&
          availability.permitDate === occurrence.permitDate &&
          timeRangesOverlap(
            availability.startTime,
            availability.endTime,
            occurrence.startTime,
            occurrence.endTime,
          ),
      ),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const { error: validationError, occurrences } = validateAndBuildOccurrences();

    if (validationError) {
      setMessage(validationError);
      return;
    }

    const overlappingOccurrences = findOverlappingOccurrences(occurrences);

    if (overlappingOccurrences.length > 0) {
      const firstOverlap = overlappingOccurrences[0];
      setMessage(
        `Overlap found for ${firstOverlap.venueName} on ${formatDate(
          firstOverlap.permitDate,
        )}. Adjust the date or time before saving.`,
      );
      return;
    }

    setIsSaving(true);

    if (isEditing && editingSource) {
      const occurrence = occurrences[0];

      if (editingSource.isPendingInsert) {
        setAvailabilities((currentAvailabilities) =>
          currentAvailabilities.map((availability) =>
            availability.id === editingId
              ? {
                  ...availability,
                  venueName: occurrence.venueName,
                  permitDate: occurrence.permitDate,
                  startTime: occurrence.startTime,
                  endTime: occurrence.endTime,
                }
              : availability,
          ),
        );
        setMessage("Staged availability updated.");
        resetForm();
        setIsSaving(false);
        return;
      }

      const { error } = await supabase
        .from("venue_availability")
        .update({
          venue_name: occurrence.venueName,
          permit_date: occurrence.permitDate,
          permit_start_time: occurrence.startTime,
          permit_end_time: occurrence.endTime,
          entry_type: editingSource.entryType,
          recurring_series_id: editingSource.recurringSeriesId,
          recurring_weekday: editingSource.recurringWeekday,
          series_start_date: editingSource.seriesStartDate,
          series_end_date: editingSource.seriesEndDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingId);

      if (error) {
        setMessage(`Could not update availability: ${error.message}`);
      } else {
        setMessage("Availability updated.");
        resetForm();
        await loadAvailabilities();
      }

      setIsSaving(false);
      return;
    }

    const recurringSeriesId = form.mode === "recurring" ? crypto.randomUUID() : null;
    const stagedAvailabilities = occurrences.map((occurrence) => ({
      id: `pending-${crypto.randomUUID()}`,
      venueName: occurrence.venueName,
      permitDate: occurrence.permitDate,
      startTime: occurrence.startTime,
      endTime: occurrence.endTime,
      entryType: form.mode,
      recurringSeriesId,
      recurringWeekday: form.mode === "recurring" ? Number(form.recurringWeekday) : null,
      seriesStartDate: form.mode === "recurring" ? form.seriesStartDate : null,
      seriesEndDate: form.mode === "recurring" ? form.seriesEndDate : null,
      isPendingInsert: true,
    }));

    setAvailabilities((currentAvailabilities) => [
      ...currentAvailabilities,
      ...stagedAvailabilities,
    ]);
    setMessage(
      form.mode === "recurring"
        ? `${stagedAvailabilities.length} recurring permit occurrences staged.`
        : "Availability staged.",
    );
    resetForm();

    setIsSaving(false);
  }

  function editAvailability(availability: Availability) {
    setForm((currentForm) => ({
      ...currentForm,
      mode: "single",
      venueName: availability.venueName,
      permitDate: availability.permitDate,
      startTime: availability.startTime,
      endTime: availability.endTime,
    }));
    setEditingId(availability.id);
    setEditingSource(availability);
    setMessage("");
  }

  async function deleteAvailability(id: string) {
    setMessage("");

    const availability = availabilities.find(
      (currentAvailability) => currentAvailability.id === id,
    );

    if (availability?.isPendingInsert) {
      setAvailabilities((currentAvailabilities) =>
        currentAvailabilities.filter((currentAvailability) => currentAvailability.id !== id),
      );

      if (editingId === id) {
        resetForm();
      }

      setMessage("Staged availability removed.");
      return;
    }

    const { error } = await supabase.from("venue_availability").delete().eq("id", id);

    if (error) {
      setMessage(`Could not delete availability: ${error.message}`);
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    setMessage("Availability deleted.");
    await loadAvailabilities();
  }

  async function finalSubmit() {
    const pendingAvailabilities = availabilities.filter(
      (availability) => availability.isPendingInsert,
    );

    if (pendingAvailabilities.length === 0) {
      setMessage("No new staged availabilities to submit.");
      return;
    }

    setIsSaving(true);
    const { error } = await supabase
      .from("venue_availability")
      .insert(buildInsertRows(pendingAvailabilities));

    if (error) {
      setMessage(`Could not submit staged availabilities: ${error.message}`);
    } else {
      setMessage(
        `${pendingAvailabilities.length} staged permit occurrence${
          pendingAvailabilities.length === 1 ? "" : "s"
        } submitted.`,
      );
      resetForm();
      await loadAvailabilities(false);
    }

    setIsSaving(false);
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4] text-[#1b241f]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-[#d6ded5] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#637066]">
              <span>Aryan Suvarna</span>
              <span aria-hidden="true">/</span>
              <span>Cricket League - Mississauga</span>
              <span aria-hidden="true">/</span>
              <span className="text-[#1f5b47]">Venue Availability</span>
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-normal text-[#16211b] sm:text-4xl">
                Venue availability
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#58635c] sm:text-base">
                Add permit windows for each venue before generating the league schedule.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={finalSubmit}
            disabled={isSaving || pendingInsertCount === 0}
            className="h-11 w-full rounded-md bg-[#1f5b47] px-5 text-sm font-semibold text-white transition hover:bg-[#164333] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#9aa79f] sm:w-auto"
          >
            {isSaving ? "Submitting..." : "Final submit"}
          </button>
        </header>

        <section className="grid min-h-0 items-stretch gap-6 lg:grid-cols-[minmax(360px,460px)_1fr]">
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="h-fit rounded-lg border border-[#d6ded5] bg-white p-5 shadow-sm"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[#16211b]">
                  {isEditing ? "Edit occurrence" : "Add availability"}
                </h2>
                <p className="mt-1 text-sm leading-5 text-[#627069]">
                  Enter the permitted venue, date, and usable time windows.
                </p>
              </div>
              {isEditing ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="h-9 rounded-md border border-[#cad4cc] px-3 text-sm font-medium text-[#405047] transition hover:bg-[#f1f4ef]"
                >
                  Cancel
                </button>
              ) : null}
            </div>

            <div className="grid gap-4">
              {!isEditing ? (
                <div className="grid grid-cols-2 gap-2 rounded-md bg-[#eef3ee] p-1">
                  {(["single", "recurring"] as EntryMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => updateField("mode", mode)}
                      className={`h-10 rounded-md text-sm font-semibold transition ${
                        form.mode === mode
                          ? "bg-white text-[#1f5b47] shadow-sm"
                          : "text-[#5d6b63] hover:bg-white/70"
                      }`}
                    >
                      {mode === "single" ? "Single date" : "Recurring weekly"}
                    </button>
                  ))}
                </div>
              ) : null}

              <label className="grid gap-2 text-sm font-medium text-[#2f3d34]">
                Venue name
                <input
                  value={form.venueName}
                  onChange={(event) => updateField("venueName", event.target.value)}
                  required
                  placeholder="Example: Maple Grove Field"
                  className="h-11 rounded-md border border-[#cbd5cf] bg-white px-3 text-base text-[#16211b] outline-none transition placeholder:text-[#8a968f] focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20"
                />
              </label>

              {form.mode === "single" ? (
                <label className="grid gap-2 text-sm font-medium text-[#2f3d34]">
                  Permit date
                  <input
                    type="date"
                    value={form.permitDate}
                    onChange={(event) => updateField("permitDate", event.target.value)}
                    required
                    className="h-11 rounded-md border border-[#cbd5cf] bg-white px-3 text-base text-[#16211b] outline-none transition focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20"
                  />
                </label>
              ) : (
                <div className="grid gap-4">
                  <label className="grid gap-2 text-sm font-medium text-[#2f3d34]">
                    Series start date
                    <input
                      type="date"
                      value={form.seriesStartDate}
                      onChange={(event) =>
                        updateField("seriesStartDate", event.target.value)
                      }
                      required
                      className="h-11 rounded-md border border-[#cbd5cf] bg-white px-3 text-base text-[#16211b] outline-none transition focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-[#2f3d34]">
                    Day of week
                    <select
                      value={form.recurringWeekday}
                      onChange={(event) =>
                        updateField("recurringWeekday", event.target.value)
                      }
                      required
                      className="h-11 rounded-md border border-[#cbd5cf] bg-white px-3 text-base text-[#16211b] outline-none transition focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20"
                    >
                      {dayOptions.map((day) => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-[#2f3d34]">
                    Series end date
                    <input
                      type="date"
                      value={form.seriesEndDate}
                      onChange={(event) => updateField("seriesEndDate", event.target.value)}
                      required
                      className="h-11 rounded-md border border-[#cbd5cf] bg-white px-3 text-base text-[#16211b] outline-none transition focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20"
                    />
                  </label>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-[#2f3d34]">
                  Permit start
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(event) => updateField("startTime", event.target.value)}
                    required
                    className="h-11 rounded-md border border-[#cbd5cf] bg-white px-3 text-base text-[#16211b] outline-none transition focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-[#2f3d34]">
                  Permit end
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(event) => updateField("endTime", event.target.value)}
                    required
                    className="h-11 rounded-md border border-[#cbd5cf] bg-white px-3 text-base text-[#16211b] outline-none transition focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20"
                  />
                </label>
              </div>

              {recurringSummary ? (
                <p className="rounded-md bg-[#edf4ea] px-3 py-2 text-sm font-medium leading-6 text-[#2c5c40]">
                  {recurringSummary}
                </p>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={isSaving}
                className="h-11 rounded-md bg-[#1f5b47] px-5 text-sm font-semibold text-white transition hover:bg-[#164333] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2"
              >
                {isSaving
                  ? "Saving..."
                  : isEditing
                    ? "Save changes"
                    : form.mode === "recurring"
                      ? "Add recurring"
                      : "Add venue"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="h-11 rounded-md border border-[#cad4cc] px-5 text-sm font-semibold text-[#405047] transition hover:bg-[#f1f4ef] focus:outline-none focus:ring-2 focus:ring-[#9aa79f] focus:ring-offset-2"
              >
                Clear
              </button>
            </div>

            {message ? (
              <p className="mt-4 rounded-md bg-[#edf4ea] px-3 py-2 text-sm font-medium text-[#2c5c40]">
                {message}
              </p>
            ) : null}
          </form>

          <section
            style={availabilityPanelStyle}
            className="flex h-[min(var(--availability-panel-height),calc(100svh-2rem))] min-h-0 flex-col overflow-hidden rounded-lg border border-[#d6ded5] bg-white shadow-sm lg:h-[var(--availability-panel-height)]"
          >
            <div className="flex shrink-0 flex-col gap-2 border-b border-[#e1e7e2] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#16211b]">
                  Existing availabilities
                </h2>
                <p className="mt-1 text-sm text-[#627069]">
                  {isLoading
                    ? "Loading permit windows..."
                    : `${availabilities.length} permit occurrence${
                        availabilities.length === 1 ? "" : "s"
                      } listed, ${pendingInsertCount} pending submit.`}
                </p>
              </div>
            </div>

            {!isLoading && availabilities.length === 0 ? (
              <div className="p-5 text-sm text-[#627069]">
                No permit windows have been added yet.
              </div>
            ) : null}

            <div className="hidden min-h-0 flex-1 overflow-y-auto md:block">
              <table className="w-full table-fixed border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-[#f2f5f0] text-xs uppercase text-[#5d6b63]">
                  <tr>
                    <th className="w-[28%] px-5 py-3 font-semibold">Venue</th>
                    <th className="w-[18%] px-5 py-3 font-semibold">Date</th>
                    <th className="w-[22%] px-5 py-3 font-semibold">Time</th>
                    <th className="w-[16%] px-5 py-3 font-semibold">Source</th>
                    <th className="w-[16%] px-5 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7ece7]">
                  {sortedAvailabilities.map((availability) => {
                    const hasOverlap = overlapIds.has(availability.id);

                    return (
                      <tr
                        key={availability.id}
                        className={`align-middle ${
                          availability.isPendingInsert ? "bg-[#ecf8ed]" : "bg-white"
                        }`}
                      >
                        <td className="px-5 py-4 text-sm font-semibold text-[#1f2b24]">
                          <div className="flex flex-col gap-1">
                            {availability.venueName}
                            {hasOverlap ? (
                              <span className="w-fit rounded bg-[#fff1ee] px-2 py-0.5 text-xs font-semibold text-[#8a3829]">
                                Overlap
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-[#506057]">
                          {formatDate(availability.permitDate)}
                        </td>
                        <td className="px-5 py-4 text-sm text-[#506057]">
                          {formatTime(availability.startTime)} -{" "}
                          {formatTime(availability.endTime)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded px-2 py-1 text-xs font-semibold ${
                              availability.isPendingInsert
                                ? "bg-[#ccebd1] text-[#235333]"
                                : availability.entryType === "recurring"
                                ? "bg-[#eaf0f7] text-[#34506d]"
                                : "bg-[#edf4ea] text-[#2c5c40]"
                            }`}
                          >
                            {availability.isPendingInsert
                              ? "New"
                              : availability.entryType === "recurring"
                              ? "Recurring"
                              : "Single"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => editAvailability(availability)}
                              aria-label={`Edit ${availability.venueName} availability`}
                              title="Edit"
                              className="flex h-9 w-9 items-center justify-center rounded-md border border-[#cad4cc] text-[#405047] transition hover:bg-[#f1f4ef] focus:outline-none focus:ring-2 focus:ring-[#9aa79f] focus:ring-offset-2"
                            >
                              <Pencil aria-hidden="true" size={16} strokeWidth={2} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteAvailability(availability.id)}
                              aria-label={`Delete ${availability.venueName} availability`}
                              title="Delete"
                              className="flex h-9 w-9 items-center justify-center rounded-md border border-[#e3b7ae] text-[#8a3829] transition hover:bg-[#fff1ee] focus:outline-none focus:ring-2 focus:ring-[#d59184] focus:ring-offset-2"
                            >
                              <Trash2 aria-hidden="true" size={16} strokeWidth={2} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 md:hidden">
              {sortedAvailabilities.map((availability) => {
                const hasOverlap = overlapIds.has(availability.id);

                return (
                  <article
                    key={availability.id}
                    className={`rounded-lg border p-4 ${
                      availability.isPendingInsert
                        ? "border-[#b9dfbf] bg-[#ecf8ed]"
                        : "border-[#e1e7e2] bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-semibold text-[#1f2b24]">
                          {availability.venueName}
                        </h3>
                        <p className="mt-1 text-sm text-[#506057]">
                          {formatDate(availability.permitDate)}
                        </p>
                        <p className="mt-1 text-sm text-[#506057]">
                          {formatTime(availability.startTime)} -{" "}
                          {formatTime(availability.endTime)}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span
                            className={`rounded px-2 py-1 text-xs font-semibold ${
                              availability.isPendingInsert
                                ? "bg-[#ccebd1] text-[#235333]"
                                : availability.entryType === "recurring"
                                ? "bg-[#eaf0f7] text-[#34506d]"
                                : "bg-[#edf4ea] text-[#2c5c40]"
                            }`}
                          >
                            {availability.isPendingInsert
                              ? "New"
                              : availability.entryType === "recurring"
                              ? "Recurring"
                              : "Single"}
                          </span>
                          {hasOverlap ? (
                            <span className="rounded bg-[#fff1ee] px-2 py-1 text-xs font-semibold text-[#8a3829]">
                              Overlap
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => editAvailability(availability)}
                        aria-label={`Edit ${availability.venueName} availability`}
                        title="Edit"
                        className="flex h-10 items-center justify-center rounded-md border border-[#cad4cc] text-[#405047] transition hover:bg-[#f1f4ef] focus:outline-none focus:ring-2 focus:ring-[#9aa79f] focus:ring-offset-2"
                      >
                        <Pencil aria-hidden="true" size={17} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteAvailability(availability.id)}
                        aria-label={`Delete ${availability.venueName} availability`}
                        title="Delete"
                        className="flex h-10 items-center justify-center rounded-md border border-[#e3b7ae] text-[#8a3829] transition hover:bg-[#fff1ee] focus:outline-none focus:ring-2 focus:ring-[#d59184] focus:ring-offset-2"
                      >
                        <Trash2 aria-hidden="true" size={17} strokeWidth={2} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
