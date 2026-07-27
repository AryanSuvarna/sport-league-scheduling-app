"use client";

import {
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Availability,
  AvailabilityForm,
  Field,
  FieldRow,
  OccurrenceDraft,
  Venue,
  VenueAvailabilityRow,
  VenueRow,
} from "./types";
import {
  createEmptyForm,
  formatDate,
  formatTime,
  generateRecurringDates,
  getDayName,
  mapRowToAvailability,
  timeRangesOverlap,
} from "./utils";

export function useVenueAvailability() {
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

  return {
    availabilityPanelStyle,
    form,
    formRef,
    hasExactVenueMatch,
    isAddingField,
    isAddingVenue,
    isEditing,
    isFieldModalOpen,
    isLoading,
    isSaving,
    isVenueModalOpen,
    message,
    matchingVenues,
    newFieldLabel,
    newVenueForm,
    overlapIds,
    selectedFieldId,
    selectedVenue,
    selectedVenueFields,
    sortedAvailabilities,
    addField,
    addVenue,
    closeVenueModal,
    deleteAvailability,
    editAvailability,
    finalSubmit,
    handleSubmit,
    openAddVenueModal,
    openEditVenueModal,
    recurringSummary,
    resetForm,
    selectVenue,
    setForm,
    setIsFieldModalOpen,
    setNewFieldLabel,
    setNewVenueForm,
    updateField,
    updateVenue,
    editingVenueId,
  };
}
