import type { CSSProperties } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { Availability } from "../types";
import { formatDate, formatTime } from "../utils";

type AvailabilityListProps = {
  availabilities: Availability[];
  overlapIds: Set<string>;
  isLoading: boolean;
  panelStyle: CSSProperties;
  onEdit: (availability: Availability) => void;
  onDelete: (id: string) => void;
};

export function AvailabilityList({
  availabilities,
  overlapIds,
  isLoading,
  panelStyle,
  onEdit,
  onDelete,
}: AvailabilityListProps) {
  return (
    <section
      style={panelStyle}
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
            {availabilities.map((availability) => {
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
                      {availability.entryType === "recurring" ? "Recurring" : "Single"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(availability)}
                        aria-label={`Edit ${availability.venueName} availability`}
                        title="Edit"
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-[#cad4cc] text-[#405047] transition hover:bg-[#f1f4ef] focus:outline-none focus:ring-2 focus:ring-[#9aa79f] focus:ring-offset-2"
                      >
                        <Pencil aria-hidden="true" size={16} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(availability.id)}
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
        {availabilities.map((availability) => {
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
                      {availability.entryType === "recurring" ? "Recurring" : "Single"}
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
                  onClick={() => onEdit(availability)}
                  aria-label={`Edit ${availability.venueName} availability`}
                  title="Edit"
                  className="flex h-10 items-center justify-center rounded-md border border-[#cad4cc] text-[#405047] transition hover:bg-[#f1f4ef] focus:outline-none focus:ring-2 focus:ring-[#9aa79f] focus:ring-offset-2"
                >
                  <Pencil aria-hidden="true" size={17} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(availability.id)}
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
  );
}
