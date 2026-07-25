"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Availability = {
  id: string;
  venueName: string;
  permitDate: string;
  startTime: string;
  endTime: string;
};

type AvailabilityForm = Omit<Availability, "id">;

type VenueAvailabilityRow = {
  id: string;
  venue_name: string;
  permit_date: string;
  permit_start_time: string;
  permit_end_time: string;
};

const emptyForm: AvailabilityForm = {
  venueName: "",
  permitDate: "",
  startTime: "",
  endTime: "",
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function mapRowToAvailability(row: VenueAvailabilityRow): Availability {
  return {
    id: row.id,
    venueName: row.venue_name,
    permitDate: row.permit_date,
    startTime: row.permit_start_time.slice(0, 5),
    endTime: row.permit_end_time.slice(0, 5),
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

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [form, setForm] = useState<AvailabilityForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const sortedAvailabilities = useMemo(
    () =>
      availabilities.toSorted((first, second) => {
        const firstDateTime = `${first.permitDate} ${first.startTime}`;
        const secondDateTime = `${second.permitDate} ${second.startTime}`;

        return firstDateTime.localeCompare(secondDateTime);
      }),
    [availabilities],
  );

  const isEditing = editingId !== null;
  const shouldScrollAvailabilityList = sortedAvailabilities.length > 5;

  const loadAvailabilities = useCallback(async () => {
    const { data, error } = await supabase
      .from("venue_availability")
      .select("id, venue_name, permit_date, permit_start_time, permit_end_time")
      .order("permit_date", { ascending: true })
      .order("permit_start_time", { ascending: true });

    if (error) {
      setMessage(`Could not load availabilities: ${error.message}`);
      setAvailabilities([]);
    } else {
      setAvailabilities((data ?? []).map(mapRowToAvailability));
    }

    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    void Promise.resolve().then(loadAvailabilities);
  }, [loadAvailabilities]);

  function updateField(field: keyof AvailabilityForm, value: string) {
    setMessage("");
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (form.startTime >= form.endTime) {
      setMessage("Permit end time must be after the start time.");
      return;
    }

    setIsSaving(true);

    if (isEditing) {
      const { error } = await supabase
        .from("venue_availability")
        .update({
          venue_name: form.venueName.trim(),
          permit_date: form.permitDate,
          permit_start_time: form.startTime,
          permit_end_time: form.endTime,
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

    const { error } = await supabase.from("venue_availability").insert({
      venue_name: form.venueName.trim(),
      permit_date: form.permitDate,
      permit_start_time: form.startTime,
      permit_end_time: form.endTime,
    });

    if (error) {
      setMessage(`Could not add availability: ${error.message}`);
    } else {
      setMessage("Availability added.");
      resetForm();
      await loadAvailabilities();
    }

    setIsSaving(false);
  }

  function editAvailability(availability: Availability) {
    setForm({
      venueName: availability.venueName,
      permitDate: availability.permitDate,
      startTime: availability.startTime,
      endTime: availability.endTime,
    });
    setEditingId(availability.id);
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

        <section className="grid gap-6 lg:grid-cols-[minmax(320px,420px)_1fr]">
          <form
            onSubmit={handleSubmit}
            className="h-fit rounded-lg border border-[#d6ded5] bg-white p-5 shadow-sm"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[#16211b]">
                  {isEditing ? "Edit availability" : "Add availability"}
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
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={isSaving}
                className="h-11 rounded-md bg-[#1f5b47] px-5 text-sm font-semibold text-white transition hover:bg-[#164333] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2"
              >
                {isSaving ? "Saving..." : isEditing ? "Save changes" : "Add venue"}
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

          <section className="rounded-lg border border-[#d6ded5] bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-[#e1e7e2] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#16211b]">
                  Existing availabilities
                </h2>
                <p className="mt-1 text-sm text-[#627069]">
                  {isLoading
                    ? "Loading permit windows..."
                    : `${availabilities.length} permit window${
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

            <div
              className={`hidden md:block ${
                shouldScrollAvailabilityList ? "max-h-[355px] overflow-y-auto" : ""
              }`}
            >
              <table className="w-full table-fixed border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-[#f2f5f0] text-xs uppercase text-[#5d6b63]">
                  <tr>
                    <th className="w-[34%] px-5 py-3 font-semibold">Ground</th>
                    <th className="w-[22%] px-5 py-3 font-semibold">Permit date</th>
                    <th className="w-[24%] px-5 py-3 font-semibold">Permit time</th>
                    <th className="w-[20%] px-5 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7ece7]">
                  {sortedAvailabilities.map((availability) => (
                    <tr key={availability.id} className="align-middle">
                      <td className="px-5 py-4 text-sm font-semibold text-[#1f2b24]">
                        {availability.venueName}
                      </td>
                      <td className="px-5 py-4 text-sm text-[#506057]">
                        {formatDate(availability.permitDate)}
                      </td>
                      <td className="px-5 py-4 text-sm text-[#506057]">
                        {formatTime(availability.startTime)} -{" "}
                        {formatTime(availability.endTime)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => editAvailability(availability)}
                            className="h-9 rounded-md border border-[#cad4cc] px-3 text-sm font-medium text-[#405047] transition hover:bg-[#f1f4ef]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteAvailability(availability.id)}
                            className="h-9 rounded-md border border-[#e3b7ae] px-3 text-sm font-medium text-[#8a3829] transition hover:bg-[#fff1ee]"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              className={`grid gap-3 p-4 md:hidden ${
                shouldScrollAvailabilityList ? "max-h-[520px] overflow-y-auto" : ""
              }`}
            >
              {sortedAvailabilities.map((availability) => (
                <article
                  key={availability.id}
                  className="rounded-lg border border-[#e1e7e2] p-4"
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
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => editAvailability(availability)}
                      className="h-10 rounded-md border border-[#cad4cc] px-3 text-sm font-medium text-[#405047] transition hover:bg-[#f1f4ef]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteAvailability(availability.id)}
                      className="h-10 rounded-md border border-[#e3b7ae] px-3 text-sm font-medium text-[#8a3829] transition hover:bg-[#fff1ee]"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
