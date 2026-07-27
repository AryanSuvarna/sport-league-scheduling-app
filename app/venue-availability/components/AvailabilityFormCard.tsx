import type { FormEvent, RefObject } from "react";
import type { AvailabilityForm, EntryMode, Field, Venue } from "../types";
import { dayOptions } from "../utils";

type AvailabilityFormCardProps = {
  form: AvailabilityForm;
  formRef: RefObject<HTMLFormElement | null>;
  isEditing: boolean;
  isSaving: boolean;
  message: string;
  recurringSummary: string;
  selectedVenue: Venue | null;
  selectedVenueFields: Field[];
  selectedFieldId: string;
  matchingVenues: Venue[];
  hasExactVenueMatch: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
  onUpdateField: (field: keyof AvailabilityForm, value: string) => void;
  onSetForm: (updater: (form: AvailabilityForm) => AvailabilityForm) => void;
  onSelectVenue: (venue: Venue) => void;
  onOpenAddVenue: () => void;
  onOpenEditVenue: (venue: Venue) => void;
  onOpenAddField: () => void;
};

export function AvailabilityFormCard({
  form,
  formRef,
  isEditing,
  isSaving,
  message,
  recurringSummary,
  selectedVenue,
  selectedVenueFields,
  selectedFieldId,
  matchingVenues,
  hasExactVenueMatch,
  onSubmit,
  onReset,
  onUpdateField,
  onSetForm,
  onSelectVenue,
  onOpenAddVenue,
  onOpenEditVenue,
  onOpenAddField,
}: AvailabilityFormCardProps) {
  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
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
            onClick={onReset}
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
                onClick={() => onUpdateField("mode", mode)}
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
                onSetForm((currentForm) => ({
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
                      onClick={() => onSelectVenue(venue)}
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
                      <span className="mt-1 block text-xs text-[#637066]">
                        {venue.groundType || "Unspecified surface"} · Capacity{" "}
                        {venue.capacity}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              {form.venueSearch.trim() && !hasExactVenueMatch ? (
                <div className="mt-2 border-t border-[#e1e7e2] pt-2">
                  <button
                    type="button"
                    onClick={onOpenAddVenue}
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
                  <p className="mt-1 text-xs text-[#637066]">
                    {selectedVenue.groundType || "Unspecified surface"} · Capacity{" "}
                    {selectedVenue.capacity}
                  </p>
                </div>
                <div className="flex shrink-0 gap-3">
                  <button
                    type="button"
                    onClick={() => onOpenEditVenue(selectedVenue)}
                    className="text-xs font-semibold text-[#1f5b47] hover:text-[#164333]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onSetForm((currentForm) => ({
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
                  onChange={(event) => onUpdateField("fieldId", event.target.value)}
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
              onClick={onOpenAddField}
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
              onChange={(event) => onUpdateField("permitDate", event.target.value)}
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
                onChange={(event) => onUpdateField("seriesStartDate", event.target.value)}
                required
                className="h-11 rounded-md border border-[#cbd5cf] bg-white px-3 text-base text-[#16211b] outline-none transition focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-[#2f3d34]">
              Day of week
              <select
                value={form.recurringWeekday}
                onChange={(event) => onUpdateField("recurringWeekday", event.target.value)}
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
                onChange={(event) => onUpdateField("seriesEndDate", event.target.value)}
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
              onChange={(event) => onUpdateField("startTime", event.target.value)}
              required
              className="h-11 rounded-md border border-[#cbd5cf] bg-white px-3 text-base text-[#16211b] outline-none transition focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-[#2f3d34]">
            Permit end
            <input
              type="time"
              value={form.endTime}
              onChange={(event) => onUpdateField("endTime", event.target.value)}
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
          onClick={onReset}
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
  );
}
