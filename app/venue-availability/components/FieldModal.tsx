import { X } from "lucide-react";
import type { Venue } from "../types";

type FieldModalProps = {
  label: string;
  selectedVenue: Venue | null;
  isSaving: boolean;
  onChange: (label: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function FieldModal({
  label,
  selectedVenue,
  isSaving,
  onChange,
  onClose,
  onSubmit,
}: FieldModalProps) {
  return (
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
            onClick={onClose}
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
            value={label}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Example: Field 3"
            className="h-11 rounded-md border border-[#cbd5cf] bg-white px-3 text-base text-[#16211b] outline-none transition placeholder:text-[#8a968f] focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20"
          />
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-md border border-[#cad4cc] px-4 text-sm font-semibold text-[#405047] transition hover:bg-[#f1f4ef]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSaving}
            className="h-10 rounded-md bg-[#1f5b47] px-4 text-sm font-semibold text-white transition hover:bg-[#164333] disabled:cursor-not-allowed disabled:bg-[#9aa79f]"
          >
            {isSaving ? "Adding..." : "Add field"}
          </button>
        </div>
      </div>
    </div>
  );
}
