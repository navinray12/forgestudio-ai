import { useEffect, useRef } from "react";

export type WebsiteStartMode = "ai" | "template" | "blank";

const options = [
  { mode: "ai", title: "AI site builder", description: "Turn a brief into an editable proposal. Review before applying.", icon: "✦", color: "from-indigo-950 via-violet-700 to-indigo-400" },
  { mode: "template", title: "Template", description: "Browse your template library and insert a design in the editor.", icon: "▤", color: "from-emerald-950 via-teal-700 to-emerald-300" },
  { mode: "blank", title: "Blank site", description: "Build a custom site from scratch with visual editing tools.", icon: "+", color: "from-slate-300 via-slate-100 to-white" },
] as const;

export function WebsiteStartChooser({ onSelect, onClose }: {
  onSelect: (mode: WebsiteStartMode) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialog} aria-labelledby="website-start-title" onCancel={onClose}
    className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-slate-950/40">
    <div className="mb-5 flex items-center justify-between gap-4">
      <h2 id="website-start-title" className="text-xl font-semibold">Select a way to get started</h2>
      <button type="button" onClick={onClose} aria-label="Close website chooser" className="rounded-lg px-3 py-2 hover:bg-slate-100 focus-visible:outline-indigo-600">×</button>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      {options.map(option => <button key={option.mode} type="button" onClick={() => onSelect(option.mode)}
        className="group rounded-xl border border-slate-200 bg-slate-50 p-5 text-center transition hover:border-indigo-400 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
        <span aria-hidden="true" className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br text-4xl shadow-md ${option.mode === "blank" ? "text-slate-500" : "text-white"} ${option.color}`}>{option.icon}</span>
        <span className="block text-sm font-semibold">{option.title}</span>
        <span className="mt-2 block text-xs leading-relaxed text-slate-600">{option.description}</span>
      </button>)}
    </div>
    <p className="mt-4 text-xs text-slate-500">All options create an editable draft. Publishing is always a separate action.</p>
  </dialog>;
}
