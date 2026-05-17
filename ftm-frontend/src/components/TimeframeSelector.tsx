"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

const TIMEFRAMES = ["DAY", "WEEK", "MONTH", "QUARTER", "YEAR"] as const;

export default function TimeframeSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("timeframe") ?? "MONTH";

  function select(tf: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("timeframe", tf);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-0.5 bg-slate-900 rounded-lg p-0.5">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          onClick={() => select(tf)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            current === tf
              ? "bg-blue-600 text-white"
              : "text-slate-400 hover:text-white hover:bg-slate-700"
          }`}
        >
          {tf.charAt(0) + tf.slice(1).toLowerCase()}
        </button>
      ))}
    </div>
  );
}
