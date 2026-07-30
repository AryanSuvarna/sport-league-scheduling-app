import Link from "next/link";
import { ArrowRight, ListChecks, Plus } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f7f4] text-[#18211c]">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center gap-8 px-4 py-10 sm:px-6">
        <header className="space-y-3">
          <p className="text-sm font-medium text-[#1f5b47]">League Organizer</p>
          <h1 className="text-3xl font-semibold tracking-normal text-[#16211b] sm:text-4xl">
            What would you like to do?
          </h1>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <HomeOption
            href="/create-league"
            icon={Plus}
            title="Create league"
            description="Add league details, teams, match duration, and scheduling rules."
            action="Start setup"
          />
          <HomeOption
            href="/leagues"
            icon={ListChecks}
            title="View leagues"
            description="Open an existing league and continue toward venue availability."
            action="View leagues"
          />
        </section>
      </div>
    </main>
  );
}

function HomeOption({
  href,
  icon: Icon,
  title,
  description,
  action,
}: {
  href: string;
  icon: typeof Plus;
  title: string;
  description: string;
  action: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-56 flex-col justify-between rounded-md border border-[#d6ded5] bg-white p-6 shadow-sm transition hover:border-[#9fb5a8] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2"
    >
      <span>
        <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[#edf6f1] text-[#1f5b47]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="mt-5 block text-xl font-semibold text-[#16211b]">{title}</span>
        <span className="mt-2 block text-sm leading-6 text-[#637066]">{description}</span>
      </span>
      <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#1f5b47]">
        {action}
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}
