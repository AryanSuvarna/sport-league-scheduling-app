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
import { Pencil, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type EntryMode = "single" | "recurring";

type Availability = {
  id: string;
  fieldId: string;
  venueId: string;
  venueName: string;
  venueAddress: string;
  fieldLabel: string;
  permitDate: string;
  startTime: string;
  endTime: string;
  entryType: EntryMode;
  recurringSeriesId: string | null;
  recurringWeekday: number | null;
  seriesStartDate: string | null;
  seriesEndDate: string | null;
};

type AvailabilityForm = {
  mode: EntryMode;
  venueSearch: string;
  selectedVenueId: string;
  fieldId: string;
  permitDate: string;
  recurringWeekday: string;
  seriesStartDate: string;
  seriesEndDate: string;
  startTime: string;
  endTime: string;
};

type VenueAvailabilityRow = {
  id: string;
  field_id: string;
  fields: {
    id: string;
    label: string;
    venue_id: string;
    venues: {
      id: string;
      name: string;
      address: string;
    } | null;
  } | null;
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
  fieldId: string;
  venueId: string;
  venueName: string;
  venueAddress: string;
  fieldLabel: string;
  permitDate: string;
  startTime: string;
  endTime: string;
};

type Venue = {
  id: string;
  name: string;
  address: string;
};

type Field = {
  id: string;
  venueId: string;
  label: string;
};

type VenueRow = {
  id: string;
  name: string;
  address: string;
};

type FieldRow = {
  id: string;
  venue_id: string;
  label: string;
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
    venueSearch: "",
    selectedVenueId: "",
    fieldId: "",
    permitDate: "",
    recurringWeekday: String(today.getDay()),
    seriesStartDate: toDateInputValue(today),
    seriesEndDate: seasonEndDate,
    startTime: "",
    endTime: "",
  };
}

function mapRowToAvailability(row: VenueAvailabilityRow): Availability {
  const field = row.fields;
  const venue = field?.venues;

  return {
    id: row.id,
    fieldId: row.field_id,
    venueId: venue?.id ?? field?.venue_id ?? "",
    venueName: venue?.name ?? "Unknown venue",
    venueAddress: venue?.address ?? "",
    fieldLabel: field?.label ?? "Main",
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

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [form, setForm] = useState<AvailabilityForm>(createEmptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState<Availability | null>(null);
  const [newVenueForm, setNewVenueForm] = useState({ name: "", address: "" });
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [isVenueModalOpen, setIsVenueModalOpen] = useState(false);
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null);
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [isAddingVenue, setIsAddingVenue] = useState(false);
  const [isAddingField, setIsAddingField] = useState(false);
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
  const selectedVenue = useMemo(
    () => venues.find((venue) => venue.id === form.selectedVenueId) ?? null,
    [form.selectedVenueId, venues],
  );
  const selectedVenueFields = useMemo(
    () => fields.filter((field) => field.venueId === form.selectedVenueId),
    [fields, form.selectedVenueId],
  );
  const matchingVenues = useMemo(() => {
    const query = form.venueSearch.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return venues
      .filter(
        (venue) =>
          venue.name.toLowerCase().includes(query) ||
          venue.address.toLowerCase().includes(query),
      )
      .slice(0, 6);
  }, [form.venueSearch, venues]);
  const hasExactVenueMatch = useMemo(() => {
    const query = form.venueSearch.trim().toLowerCase();

    return venues.some((venue) => venue.name.trim().toLowerCase() === query);
  }, [form.venueSearch, venues]);
  const selectedFieldId = form.fieldId || selectedVenueFields[0]?.id || "";

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
          first.fieldId === second.fieldId &&
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

  const loadAvailabilities = useCallback(async () => {
    const { data, error } = await supabase
      .from("venue_availability")
      .select(
        [
          "id",
          "field_id",
          "fields(id, label, venue_id, venues(id, name, address))",
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
      setAvailabilities([]);
    } else {
      const rows = (data ?? []) as unknown as VenueAvailabilityRow[];
      setAvailabilities(rows.map(mapRowToAvailability));
    }

    setIsLoading(false);
  }, [supabase]);

  const loadVenueReferences = useCallback(async () => {
    const [venuesResult, fieldsResult] = await Promise.all([
      supabase.from("venues").select("id, name, address").order("name", { ascending: true }),
      supabase.from("fields").select("id, venue_id, label").order("label", { ascending: true }),
    ]);

    if (venuesResult.error) {
      setMessage(`Could not load venues: ${venuesResult.error.message}`);
    } else {
      const rows = (venuesResult.data ?? []) as unknown as VenueRow[];
      setVenues(rows);
    }

    if (fieldsResult.error) {
      setMessage(`Could not load fields: ${fieldsResult.error.message}`);
    } else {
      const rows = (fieldsResult.data ?? []) as unknown as FieldRow[];
      setFields(
        rows.map((row) => ({
          id: row.id,
          venueId: row.venue_id,
          label: row.label,
        })),
      );
    }
  }, [supabase]);

  useEffect(() => {
    void Promise.resolve().then(() =>
      Promise.all([loadVenueReferences(), loadAvailabilities()]),
    );
  }, [loadAvailabilities, loadVenueReferences]);

  function updateField(field: keyof AvailabilityForm, value: string) {
    setMessage("");
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function selectVenue(venue: Venue) {
    setMessage("");
    setNewVenueForm({ name: "", address: "" });
    setForm((currentForm) => ({
      ...currentForm,
      venueSearch: venue.name,
      selectedVenueId: venue.id,
      fieldId: "",
    }));
  }

  function openAddVenueModal() {
    setEditingVenueId(null);
    setNewVenueForm((currentForm) => ({
      ...currentForm,
      name: currentForm.name || form.venueSearch.trim(),
    }));
    setIsVenueModalOpen(true);
  }

  function openEditVenueModal(venue: Venue) {
    setEditingVenueId(venue.id);
    setNewVenueForm({
      name: venue.name,
      address: venue.address,
    });
    setIsVenueModalOpen(true);
  }

  function closeVenueModal() {
    setIsVenueModalOpen(false);
    setEditingVenueId(null);
    setNewVenueForm({ name: "", address: "" });
  }

  function resetForm() {
    setForm(createEmptyForm());
    setEditingId(null);
    setEditingSource(null);
    setNewVenueForm({ name: "", address: "" });
    setEditingVenueId(null);
    setNewFieldLabel("");
  }

  async function addVenue() {
    const name = newVenueForm.name.trim() || form.venueSearch.trim();
    const address = newVenueForm.address.trim();

    if (!name) {
      setMessage("Venue name is required.");
      return;
    }

    setIsAddingVenue(true);

    const { data: venueData, error: venueError } = await supabase
      .from("venues")
      .insert({ name, address })
      .select("id, name, address")
      .single();

    if (venueError) {
      setMessage(`Could not add venue: ${venueError.message}`);
      setIsAddingVenue(false);
      return;
    }

    const venue = venueData as unknown as VenueRow;
    const { data: existingFields, error: existingFieldsError } = await supabase
      .from("fields")
      .select("id, venue_id, label")
      .eq("venue_id", venue.id);

    if (existingFieldsError) {
      setMessage(`Venue added, but fields could not be loaded: ${existingFieldsError.message}`);
      setIsAddingVenue(false);
      return;
    }

    let fieldRows = (existingFields ?? []) as unknown as FieldRow[];

    if (fieldRows.length === 0) {
      const { data: fieldData, error: fieldError } = await supabase
        .from("fields")
        .insert({ venue_id: venue.id, label: "Main" })
        .select("id, venue_id, label")
        .single();

      if (fieldError) {
        setMessage(`Venue added, but default field could not be created: ${fieldError.message}`);
        setIsAddingVenue(false);
        return;
      }

      fieldRows = [fieldData as unknown as FieldRow];
    }

    await loadVenueReferences();
    setForm((currentForm) => ({
      ...currentForm,
      venueSearch: venue.name,
      selectedVenueId: venue.id,
      fieldId: fieldRows[0]?.id ?? "",
    }));
    setNewVenueForm({ name: "", address: "" });
    setIsVenueModalOpen(false);
    setMessage("Venue added.");
    setIsAddingVenue(false);
  }

  async function updateVenue() {
    const name = newVenueForm.name.trim();
    const address = newVenueForm.address.trim();

    if (!editingVenueId || !name) {
      setMessage("Venue name is required.");
      return;
    }

    setIsAddingVenue(true);

    const { data, error } = await supabase
      .from("venues")
      .update({
        name,
        address,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingVenueId)
      .select("id, name, address")
      .single();

    if (error) {
      setMessage(`Could not update venue: ${error.message}`);
      setIsAddingVenue(false);
      return;
    }

    const venue = data as unknown as VenueRow;

    await Promise.all([loadVenueReferences(), loadAvailabilities()]);
    setForm((currentForm) =>
      currentForm.selectedVenueId === venue.id
        ? {
            ...currentForm,
            venueSearch: venue.name,
          }
        : currentForm,
    );
    closeVenueModal();
    setMessage("Venue updated.");
    setIsAddingVenue(false);
  }

  async function addField() {
    const label = newFieldLabel.trim();

    if (!form.selectedVenueId || !label) {
      setMessage("Choose a venue and enter a field label.");
      return;
    }

    setIsAddingField(true);

    const { data, error } = await supabase
      .from("fields")
      .insert({ venue_id: form.selectedVenueId, label })
      .select("id, venue_id, label")
      .single();

    if (error) {
      setMessage(`Could not add field: ${error.message}`);
      setIsAddingField(false);
      return;
    }

    const field = data as unknown as FieldRow;

    await loadVenueReferences();
    setForm((currentForm) => ({
      ...currentForm,
      fieldId: field.id,
    }));
    setNewFieldLabel("");
    setIsFieldModalOpen(false);
    setMessage("Field added.");
    setIsAddingField(false);
  }

  function validateAndBuildOccurrences() {
    const selectedField = fields.find((field) => field.id === selectedFieldId) ?? null;
    const venue = selectedVenue;

    if (!venue || !selectedField) {
      return {
        error: "Choose an existing venue and field before adding availability.",
        occurrences: [],
      };
    }

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
            fieldId: selectedField.id,
            venueId: venue.id,
            venueName: venue.name,
            venueAddress: venue.address,
            fieldLabel: selectedField.label,
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
        fieldId: selectedField.id,
        venueId: venue.id,
        venueName: venue.name,
        venueAddress: venue.address,
        fieldLabel: selectedField.label,
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
          availability.fieldId === occurrence.fieldId &&
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

      const { error } = await supabase
        .from("venue_availability")
        .update({
          field_id: occurrence.fieldId,
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
    const rows = occurrences.map((occurrence) => ({
      field_id: occurrence.fieldId,
      venue_name: occurrence.venueName,
      permit_date: occurrence.permitDate,
      permit_start_time: occurrence.startTime,
      permit_end_time: occurrence.endTime,
      entry_type: form.mode,
      recurring_series_id: recurringSeriesId,
      recurring_weekday: form.mode === "recurring" ? Number(form.recurringWeekday) : null,
      series_start_date: form.mode === "recurring" ? form.seriesStartDate : null,
      series_end_date: form.mode === "recurring" ? form.seriesEndDate : null,
    }));

    const { error } = await supabase.from("venue_availability").insert(rows);

    if (error) {
      setMessage(`Could not add availability: ${error.message}`);
    } else {
      setMessage(
        form.mode === "recurring"
          ? `${rows.length} recurring permit occurrences added.`
          : "Availability added.",
      );
      resetForm();
      await loadAvailabilities();
    }

    setIsSaving(false);
  }

  function editAvailability(availability: Availability) {
    setForm((currentForm) => ({
      ...currentForm,
      mode: "single",
      venueSearch: availability.venueName,
      selectedVenueId: availability.venueId,
      fieldId: availability.fieldId,
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

  function finalSubmit() {
    setMessage(`${availabilities.length} availabilities ready for scheduling.`);
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
            className="h-11 w-full rounded-md bg-[#1f5b47] px-5 text-sm font-semibold text-white transition hover:bg-[#164333] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2 sm:w-auto"
          >
            Final submit
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

              <div className="relative grid gap-2">
                <label className="grid gap-2 text-sm font-medium text-[#2f3d34]">
                  Venue
                  <input
                    value={form.venueSearch}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        venueSearch: event.target.value,
                        selectedVenueId: "",
                        fieldId: "",
                      }))
                    }
                    required
                    placeholder="Search venues"
                    className="h-11 rounded-md border border-[#cbd5cf] bg-white px-3 text-base text-[#16211b] outline-none transition placeholder:text-[#8a968f] focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20"
                  />
                </label>

                {!selectedVenue && (matchingVenues.length > 0 || form.venueSearch.trim()) ? (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-md border border-[#dce5dd] bg-white p-2 shadow-lg">
                    {matchingVenues.length > 0 ? (
                      <div className="grid gap-1">
                        {matchingVenues.map((venue) => (
                          <button
                            key={venue.id}
                            type="button"
                            onClick={() => selectVenue(venue)}
                            className="rounded px-3 py-2 text-left text-sm transition hover:bg-[#edf4ea]"
                          >
                            <span className="block font-semibold text-[#1f2b24]">
                              {venue.name}
                            </span>
                            {venue.address ? (
                              <span className="block text-xs text-[#637066]">
                                {venue.address}
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {form.venueSearch.trim() && !hasExactVenueMatch ? (
                      <div className="mt-2 border-t border-[#e1e7e2] pt-2">
                        <button
                          type="button"
                          onClick={openAddVenueModal}
                          className="w-full rounded px-3 py-2 text-left text-sm font-semibold text-[#1f5b47] transition hover:bg-[#edf4ea]"
                        >
                          + Add new venue
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : selectedVenue ? (
                  <div className="rounded-md border border-[#cfe0d2] bg-[#ecf8ed] px-3 py-2 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#1f2b24]">{selectedVenue.name}</p>
                        {selectedVenue.address ? (
                          <p className="mt-0.5 text-xs text-[#637066]">
                            {selectedVenue.address}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-3">
                        <button
                          type="button"
                          onClick={() => openEditVenueModal(selectedVenue)}
                          className="text-xs font-semibold text-[#1f5b47] hover:text-[#164333]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((currentForm) => ({
                              ...currentForm,
                              venueSearch: "",
                              selectedVenueId: "",
                              fieldId: "",
                            }))
                          }
                          className="text-xs font-semibold text-[#1f5b47] hover:text-[#164333]"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {selectedVenue ? (
                <div className="grid gap-2">
                  {selectedVenueFields.length > 0 ? (
                    <label className="grid gap-2 text-sm font-medium text-[#2f3d34]">
                      Field
                      <select
                        value={selectedFieldId}
                        onChange={(event) => updateField("fieldId", event.target.value)}
                        required
                        className="h-11 rounded-md border border-[#cbd5cf] bg-white px-3 text-base text-[#16211b] outline-none transition focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20"
                      >
                        {selectedVenueFields.map((field) => (
                          <option key={field.id} value={field.id}>
                            {field.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setIsFieldModalOpen(true)}
                    className="h-10 rounded-md border border-[#cad4cc] px-4 text-sm font-semibold text-[#1f5b47] transition hover:bg-[#f1f4ef]"
                  >
                    + Add new field
                  </button>
                </div>
              ) : null}

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
                      } currently added.`}
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
                    <th className="w-[28%] px-5 py-3 font-semibold">Venue / Field</th>
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
                      <tr key={availability.id} className="align-middle">
                        <td className="px-5 py-4 text-sm font-semibold text-[#1f2b24]">
                          <div className="flex flex-col gap-1">
                            {availability.venueName}
                            <span className="text-xs font-medium text-[#637066]">
                              {availability.fieldLabel}
                            </span>
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
                              availability.entryType === "recurring"
                                ? "bg-[#eaf0f7] text-[#34506d]"
                                : "bg-[#edf4ea] text-[#2c5c40]"
                            }`}
                          >
                            {availability.entryType === "recurring"
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
                    className="rounded-lg border border-[#e1e7e2] bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-semibold text-[#1f2b24]">
                          {availability.venueName}
                        </h3>
                        <p className="mt-1 text-sm font-medium text-[#405047]">
                          {availability.fieldLabel}
                        </p>
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
                              availability.entryType === "recurring"
                                ? "bg-[#eaf0f7] text-[#34506d]"
                                : "bg-[#edf4ea] text-[#2c5c40]"
                            }`}
                          >
                            {availability.entryType === "recurring"
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

      {isVenueModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#16211b]/45 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="venue-modal-title"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="venue-modal-title" className="text-lg font-semibold text-[#16211b]">
                  {editingVenueId ? "Edit venue" : "Add new venue"}
                </h2>
                <p className="mt-1 text-sm text-[#637066]">
                  {editingVenueId
                    ? "Update the venue name or address."
                    : "Create a venue, then its default Main field will be selected."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeVenueModal}
                aria-label="Close venue modal"
                title="Close"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-[#cad4cc] text-[#405047] transition hover:bg-[#f1f4ef]"
              >
                <X aria-hidden="true" size={16} strokeWidth={2} />
              </button>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-[#2f3d34]">
                Venue name
                <input
                  value={newVenueForm.name}
                  onChange={(event) =>
                    setNewVenueForm((currentForm) => ({
                      ...currentForm,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Example: Riverside Park"
                  className="h-11 rounded-md border border-[#cbd5cf] bg-white px-3 text-base text-[#16211b] outline-none transition placeholder:text-[#8a968f] focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-[#2f3d34]">
                Address
                <input
                  value={newVenueForm.address}
                  onChange={(event) =>
                    setNewVenueForm((currentForm) => ({
                      ...currentForm,
                      address: event.target.value,
                    }))
                  }
                  placeholder="Street address"
                  className="h-11 rounded-md border border-[#cbd5cf] bg-white px-3 text-base text-[#16211b] outline-none transition placeholder:text-[#8a968f] focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeVenueModal}
                className="h-10 rounded-md border border-[#cad4cc] px-4 text-sm font-semibold text-[#405047] transition hover:bg-[#f1f4ef]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={editingVenueId ? updateVenue : addVenue}
                disabled={isAddingVenue}
                className="h-10 rounded-md bg-[#1f5b47] px-4 text-sm font-semibold text-white transition hover:bg-[#164333] disabled:cursor-not-allowed disabled:bg-[#9aa79f]"
              >
                {isAddingVenue
                  ? editingVenueId
                    ? "Saving..."
                    : "Adding..."
                  : editingVenueId
                    ? "Save venue"
                    : "Add venue"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isFieldModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#16211b]/45 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-field-title"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="add-field-title" className="text-lg font-semibold text-[#16211b]">
                  Add new field
                </h2>
                <p className="mt-1 text-sm text-[#637066]">
                  {selectedVenue
                    ? `Add a field for ${selectedVenue.name}.`
                    : "Choose a venue before adding a field."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFieldModalOpen(false)}
                aria-label="Close add field"
                title="Close"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-[#cad4cc] text-[#405047] transition hover:bg-[#f1f4ef]"
              >
                <X aria-hidden="true" size={16} strokeWidth={2} />
              </button>
            </div>

            <label className="grid gap-2 text-sm font-medium text-[#2f3d34]">
              Field label
              <input
                value={newFieldLabel}
                onChange={(event) => setNewFieldLabel(event.target.value)}
                placeholder="Example: Field 3"
                className="h-11 rounded-md border border-[#cbd5cf] bg-white px-3 text-base text-[#16211b] outline-none transition placeholder:text-[#8a968f] focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20"
              />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsFieldModalOpen(false)}
                className="h-10 rounded-md border border-[#cad4cc] px-4 text-sm font-semibold text-[#405047] transition hover:bg-[#f1f4ef]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addField}
                disabled={isAddingField}
                className="h-10 rounded-md bg-[#1f5b47] px-4 text-sm font-semibold text-white transition hover:bg-[#164333] disabled:cursor-not-allowed disabled:bg-[#9aa79f]"
              >
                {isAddingField ? "Adding..." : "Add field"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
