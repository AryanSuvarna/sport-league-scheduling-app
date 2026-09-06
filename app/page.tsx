import Link from "next/link";
import { Show, SignInButton, SignOutButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { ArrowRight, CalendarDays, Check, ChevronRight, Clock3, MapPin, ShieldCheck, Sparkles, UsersRound, WandSparkles } from "lucide-react";

const features = [
  { icon: WandSparkles, title: "Schedule in minutes", description: "Turn your teams, venues, and rules into a game-ready calendar without spreadsheet gymnastics." },
  { icon: ShieldCheck, title: "Rules stay respected", description: "Protect rest windows, home-and-away balance, venue limits, and the details that make a season fair." },
  { icon: UsersRound, title: "Everyone stays aligned", description: "Give captains a clear view of fixtures and handle changes before they turn into group-chat chaos." },
];

export default function Home() {
  return (
    <main className="landing-page min-h-screen overflow-hidden bg-[#f7f7f2] text-[#11251f]">
      <section className="relative isolate overflow-hidden bg-[#102b24] pb-16 text-white sm:pb-24">
        <div className="landing-grid pointer-events-none absolute inset-0 opacity-30" />
        <div className="absolute -right-32 -top-44 h-[31rem] w-[31rem] rounded-full bg-[#d6ff76]/10 blur-3xl" />
        <div className="absolute -bottom-56 left-[28%] h-96 w-96 rounded-full bg-[#2dcf94]/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <nav className="flex items-center justify-between py-6 sm:py-8" aria-label="Main navigation">
            <Link href="/" className="flex items-center gap-2.5" aria-label="LeagueFlow home"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#d6ff76] text-[#102b24] shadow-[0_0_30px_rgba(214,255,118,0.25)]"><span className="text-lg font-black leading-none">L</span></span><span className="text-lg font-semibold tracking-[-0.04em]">LeagueFlow</span></Link>
            <div className="hidden items-center gap-7 text-sm font-medium text-white/70 md:flex"><a className="transition hover:text-white" href="#how-it-works">How it works</a><a className="transition hover:text-white" href="#features">Why LeagueFlow</a><Show when="signed-out"><Link className="transition hover:text-white" href="/leagues">Your leagues</Link></Show></div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Show when="signed-out">
                <SignInButton><button className="rounded-full px-3 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10 sm:px-4">Sign in</button></SignInButton>
                <SignUpButton><button className="inline-flex items-center gap-1.5 rounded-full bg-[#d6ff76] px-4 py-2.5 text-sm font-bold text-[#102b24] transition hover:bg-[#e3ff9b] sm:px-5">Get started <ArrowRight className="h-3.5 w-3.5" /></button></SignUpButton>
              </Show>
              <Show when="signed-in">
                <Link href="/leagues" className="inline-flex items-center rounded-full bg-[#d6ff76] px-3 py-2 text-sm font-bold text-[#102b24] transition hover:bg-[#e3ff9b] sm:px-4"><span className="sm:hidden">Leagues</span><span className="hidden sm:inline">Your leagues</span></Link>
                <UserButton />
                <SignOutButton redirectUrl="/">
                  <button className="rounded-full px-2 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10 sm:px-4">Sign out</button>
                </SignOutButton>
              </Show>
            </div>
          </nav>
          <div className="grid items-center gap-14 pt-14 lg:grid-cols-[1fr_0.9fr] lg:gap-20 lg:pt-20">
            <div className="max-w-2xl">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3.5 py-2 text-xs font-semibold tracking-wide text-[#e4ff9f]"><Sparkles className="h-3.5 w-3.5" />THE SMARTER WAY TO RUN A SEASON</div>
              <h1 className="text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.06em] sm:text-6xl lg:text-7xl">The season starts <span className="text-[#d6ff76]">here.</span></h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-white/70 sm:text-xl">Build balanced fixtures, coordinate every venue, and give your league a schedule everyone can count on.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"><Link href="/create-league" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#d6ff76] px-6 py-3.5 text-sm font-bold text-[#102b24] transition hover:bg-[#e3ff9b] hover:shadow-[0_12px_35px_rgba(214,255,118,0.2)]">Create your league <ArrowRight className="h-4 w-4" /></Link><Link href="/leagues" className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10">See your leagues <ChevronRight className="h-4 w-4" /></Link></div>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/65">{["Balanced by design", "Venue-aware", "Built for organizers"].map((item) => <span key={item} className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#d6ff76]" />{item}</span>)}</div>
            </div>
            <SchedulePreview />
          </div>
        </div>
      </section>
      <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28"><div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24"><div><p className="text-sm font-bold tracking-[0.14em] text-[#23805e]">ONE CALM WORKFLOW</p><h2 className="mt-4 max-w-md text-4xl font-semibold tracking-[-0.05em] text-[#143128] sm:text-5xl">From league idea to opening whistle.</h2></div><div className="grid gap-8 sm:grid-cols-3">{[["01", "Set your season", "Add teams, dates, match length, and the rules that matter."], ["02", "Map availability", "Capture field times and team constraints in one shared source of truth."], ["03", "Make it official", "Generate, refine, and publish a fixture list with confidence."]].map(([number, title, description]) => <div key={number} className="border-t border-[#cdd9cf] pt-5"><p className="text-sm font-bold text-[#23805e]">{number}</p><h3 className="mt-7 text-xl font-semibold tracking-[-0.03em] text-[#143128]">{title}</h3><p className="mt-3 text-sm leading-6 text-[#617369]">{description}</p></div>)}</div></div></section>
      <section id="features" className="border-y border-[#dce3db] bg-white"><div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28"><div className="max-w-xl"><p className="text-sm font-bold tracking-[0.14em] text-[#23805e]">BUILT FOR THE REAL WORLD</p><h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#143128] sm:text-5xl">Less admin. More game day.</h2></div><div className="mt-12 grid gap-5 md:grid-cols-3">{features.map(({ icon: Icon, title, description }) => <article key={title} className="rounded-3xl border border-[#e2e8e1] bg-[#fbfcfa] p-7 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-[#143128]/5"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e9f7ec] text-[#187450]"><Icon className="h-5 w-5" /></span><h3 className="mt-8 text-xl font-semibold tracking-[-0.03em] text-[#143128]">{title}</h3><p className="mt-3 text-sm leading-6 text-[#617369]">{description}</p></article>)}</div></div></section>
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28"><div className="relative overflow-hidden rounded-[2rem] bg-[#d6ff76] px-7 py-14 text-[#102b24] sm:px-12 sm:py-16"><div className="absolute -right-8 -top-24 h-64 w-64 rounded-full border-[28px] border-[#102b24]/10" /><div className="relative max-w-2xl"><p className="text-sm font-bold tracking-[0.14em] text-[#276047]">YOUR NEXT FIXTURE IS WAITING</p><h2 className="mt-4 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Give your league the smooth season it deserves.</h2><Link href="/create-league" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#102b24] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#1d4438]">Start scheduling <ArrowRight className="h-4 w-4" /></Link></div></div></section>
    </main>
  );
}

function SchedulePreview() {
  const matches = [["6:00", "Harbour FC", "Northside", "S1"], ["7:15", "Rovers", "United 89", "S2"], ["8:30", "Eastwood", "The Belles", "S1"]];
  return <div className="relative mx-auto w-full max-w-lg lg:max-w-none"><div className="absolute -left-5 top-14 hidden rounded-2xl border border-white/15 bg-[#174438] px-3 py-3 shadow-xl sm:block"><div className="flex items-center gap-2 text-xs font-semibold text-[#d6ff76]"><Clock3 className="h-3.5 w-3.5" />98% balanced</div></div><div className="relative rounded-[1.7rem] border border-white/15 bg-[#f8fbf7] p-3 text-[#173128] shadow-[0_30px_80px_rgba(0,0,0,0.28)] sm:p-4"><div className="rounded-[1.15rem] bg-[#eaf0e9] p-4 sm:p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-bold tracking-[0.12em] text-[#5b7167]">MATCHDAY 06</p><h3 className="mt-1 text-lg font-bold tracking-[-0.035em]">Saturday, June 14</h3></div><span className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-[#277b5b]"><CalendarDays className="mr-1 inline h-3.5 w-3.5" />3 games</span></div><div className="mt-5 space-y-2">{matches.map(([time, home, away, field]) => <div key={time} className="grid grid-cols-[2.8rem_1fr_auto] items-center gap-2 rounded-xl bg-white px-3 py-3 shadow-sm sm:grid-cols-[3.2rem_1fr_1fr_auto]"><span className="text-xs font-bold text-[#277b5b]">{time}</span><span className="text-sm font-semibold">{home}<span className="hidden sm:inline"> <span className="text-[#94a39c]">vs</span> {away}</span></span><span className="text-right text-sm font-semibold sm:hidden">{away}</span><span className="rounded-md bg-[#edf7ed] px-2 py-1 text-[10px] font-bold text-[#427360]"><MapPin className="mr-0.5 inline h-2.5 w-2.5" />{field}</span></div>)}</div></div><div className="mt-3 flex items-center justify-between px-2 pb-1 text-xs font-semibold text-[#557066]"><span>12 teams synced</span><span className="text-[#277b5b]">Ready to publish</span></div></div></div>;
}
