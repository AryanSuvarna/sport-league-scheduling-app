import { X } from "lucide-react";

type VenueModalProps = {
  form: {
    name: string;
    address: string;
  };
  isEditing: boolean;
  isSaving: boolean;
  onChange: (form: { name: string; address: string }) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function VenueModal({
  form,
  isEditing,
  isSaving,
  onChange,
  onClose,
  onSubmit,
}: VenueModalProps) {
  return (
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
              {isEditing ? "Edit venue" : "Add new venue"}
            </h2>
            <p className="mt-1 text-sm text-[#637066]">
              {isEditing
                ? "Update the venue name or address."
                : "Create a venue, then its default Main field will be selected."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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
              value={form.name}
              onChange={(event) =>
                onChange({
                  ...form,
                  name: event.target.value,
                })
              }
              placeholder="Example: Riverside Park"
              className="h-11 rounded-md border border-[#cbd5cf] bg-white px-3 text-base text-[#16211b] outline-none transition placeholder:text-[#8a968f] focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-[#2f3d34]">
            Address
            <input
              value={form.address}
              onChange={(event) =>
                onChange({
                  ...form,
                  address: event.target.value,
                })
              }
              placeholder="Street address"
              className="h-11 rounded-md border border-[#cbd5cf] bg-white px-3 text-base text-[#16211b] outline-none transition placeholder:text-[#8a968f] focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20"
            />
          </label>
        </div>

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
            {isSaving
              ? isEditing
                ? "Saving..."
                : "Adding..."
              : isEditing
                ? "Save venue"
                : "Add venue"}
          </button>
        </div>
      </div>
    </div>
  );
}
