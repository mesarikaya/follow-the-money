import { ReactNode } from "react";

type Props = {
  title: string;
  milestone: string;
  description: string;
  children?: ReactNode;
};

export default function ComingSoonPage({ title, milestone, description, children }: Props) {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-6 py-3 border-b border-slate-700 bg-slate-800 sticky top-0 z-10 shrink-0">
        <h1 className="text-sm font-semibold text-slate-200">{title}</h1>
        <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full border border-slate-600">
          {milestone} — Preview
        </span>
      </header>
      <main className="flex-1 p-6 overflow-auto max-w-2xl">
        <p className="text-sm text-slate-500 mb-6">{description}</p>
        {children}
      </main>
    </div>
  );
}
