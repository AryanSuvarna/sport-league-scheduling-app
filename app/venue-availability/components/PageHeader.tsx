import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";

type PageHeaderProps = {
  onFinalSubmit: () => void;
};

export function PageHeader({ onFinalSubmit }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-5 border-b border-[#d6ded5] pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#637066]">
          <Link href="/leagues" className="transition hover:text-[#1f5b47]">
            Leagues
          </Link>
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
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/leagues"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#c7d3ca] bg-white px-5 text-sm font-semibold text-[#1f5b47] transition hover:border-[#9fb5a8] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Leagues
        </Link>
        <button
          type="button"
          onClick={onFinalSubmit}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#1f5b47] px-5 text-sm font-semibold text-white transition hover:bg-[#164333] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2"
        >
          Final submit
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
