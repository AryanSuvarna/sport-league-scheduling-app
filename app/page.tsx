"use client";

import { FormEvent, useMemo, useState } from "react";

type Availability = {
  id: number;
  groundName: string;
  permitDate: string;
  startTime: string;
  endTime: string;
};

type AvailabilityForm = Omit<Availability, "id">;

const emptyForm: AvailabilityForm = {
  groundName: "",
  permitDate: "",
  startTime: "",
  endTime: "",
};

const initialAvailabilities: Availability[] = [
  {
    id: 1,
    groundName: "Central Park Ground",
    permitDate: "2026-08-01",
    startTime: "09:00",
    endTime: "13:00",
  },
  {
    id: 2,
    groundName: "Lakeside Turf",
    permitDate: "2026-08-03",
    startTime: "18:00",
    endTime: "21:00",
  },
];

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

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
  const [availabilities, setAvailabilities] = useState(initialAvailabilities);
  const [form, setForm] = useState<AvailabilityForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (form.startTime >= form.endTime) {
      setMessage("Permit end time must be after the start time.");
      return;
    }

    if (isEditing) {
      setAvailabilities((currentAvailabilities) =>
        currentAvailabilities.map((availability) =>
          availability.id === editingId ? { ...availability, ...form } : availability,
        ),
      );
      setMessage("Availability updated.");
      resetForm();
      return;
    }

    setAvailabilities((currentAvailabilities) => [
      ...currentAvailabilities,
      {
        id: Date.now(),
        ...form,
      },
    ]);
    setMessage("Availability added.");
    resetForm();
  }

  function editAvailability(availability: Availability) {
    setForm({
      groundName: availability.groundName,
      permitDate: availability.permitDate,
      startTime: availability.startTime,
      endTime: availability.endTime,
    });
    setEditingId(availability.id);
    setMessage("");
  }

  function deleteAvailability(id: number) {
    setAvailabilities((currentAvailabilities) =>
      currentAvailabilities.filter((availability) => availability.id !== id),
    );

    if (editingId === id) {
      resetForm();
    }

    setMessage("Availability deleted.");
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
              <span>LO Name</span>
              <span aria-hidden="true">/</span>
              <span>League Name</span>
              <span aria-hidden="true">/</span>
              <span className="text-[#1f5b47]">Ground Availability</span>
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-normal text-[#16211b] sm:text-4xl">
                Ground availability
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
                  Enter the permitted ground, date, and usable time window.
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
                Ground name
                <input
                  value={form.groundName}
                  onChange={(event) => updateField("groundName", event.target.value)}
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
                className="h-11 rounded-md bg-[#1f5b47] px-5 text-sm font-semibold text-white transition hover:bg-[#164333] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2"
              >
                {isEditing ? "Save changes" : "Add ground"}
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
                  {availabilities.length} permit window
                  {availabilities.length === 1 ? "" : "s"} currently added.
                </p>
              </div>
            </div>

            <div className="hidden md:block">
              <table className="w-full table-fixed border-collapse text-left">
                <thead className="bg-[#f2f5f0] text-xs uppercase text-[#5d6b63]">
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
                        {availability.groundName}
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

            <div className="grid gap-3 p-4 md:hidden">
              {sortedAvailabilities.map((availability) => (
                <article
                  key={availability.id}
                  className="rounded-lg border border-[#e1e7e2] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-[#1f2b24]">
                        {availability.groundName}
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
