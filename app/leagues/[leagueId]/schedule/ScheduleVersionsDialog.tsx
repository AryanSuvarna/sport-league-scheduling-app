"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

type ScheduleVersion = {
  id: string;
  created_at: string;
  solver_status: "optimal" | "feasible";
  objective_value: number | null;
  fixture_count: number;
};

type Props = {
  leagueId: string;
  onClose: () => void;
  onRestored: () => Promise<void>;
};

export function ScheduleVersionsDialog({ leagueId, onClose, onRestored }: Props) {
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/leagues/${leagueId}/schedule/versions`);
        const result = await response.json() as { versions?: ScheduleVersion[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Could not load previous versions.");
        if (active) setVersions(result.versions ?? []);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load previous versions.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [leagueId]);

  async function restore(version: ScheduleVersion) {
    setRestoringId(version.id);
    try {
      const response = await fetch(`/api/leagues/${leagueId}/schedule/${version.id}/clone`, { method: "POST" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not create a draft from this version.");
      await onRestored();
      toast.success("A new draft was created from the selected version.");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create a draft from this version.");
    } finally { setRestoringId(null); }
  }

  return <div className="fixed inset-0 z-40 bg-[#18211c]/25" onClick={onClose}><aside onClick={(event) => event.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase text-[#637066]">Schedule history</p><h2 className="mt-1 text-xl font-semibold">Previous published versions</h2><p className="mt-1 text-sm text-[#637066]">Choosing a version creates an editable draft. It will not change the current published schedule until you publish that draft.</p></div><button onClick={onClose} className="text-sm font-semibold text-[#1f5b47]">Close</button></div><div className="mt-6 space-y-3">{loading ? <p className="text-sm text-[#637066]">Loading previous versions…</p> : versions.map((version) => <article key={version.id} className="rounded-md border border-[#d6ded5] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Published {formatVersionDate(version.created_at)}</h3><p className="mt-1 text-sm text-[#637066]">{version.fixture_count} fixtures · {version.solver_status} solver result{version.objective_value !== null ? ` · score ${version.objective_value}` : ""}</p></div><button onClick={() => void restore(version)} disabled={restoringId !== null} className="h-10 rounded-md bg-[#1f5b47] px-3 text-sm font-semibold text-white disabled:opacity-50">{restoringId === version.id ? "Creating draft…" : "Use as draft"}</button></div></article>)}{!loading && versions.length === 0 ? <div className="rounded-md border border-dashed border-[#cfd8d0] p-6 text-center text-sm text-[#637066]">No previous published versions are available yet.</div> : null}</div></aside></div>;
}

function formatVersionDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
