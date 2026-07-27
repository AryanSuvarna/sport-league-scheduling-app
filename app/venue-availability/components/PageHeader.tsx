type PageHeaderProps = {
  onFinalSubmit: () => void;
};

export function PageHeader({ onFinalSubmit }: PageHeaderProps) {
  return (
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
        onClick={onFinalSubmit}
        className="h-11 w-full rounded-md bg-[#1f5b47] px-5 text-sm font-semibold text-white transition hover:bg-[#164333] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2 sm:w-auto"
      >
        Final submit
      </button>
    </header>
  );
}
