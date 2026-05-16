"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

const TIMEFRAMES = ["DAY", "WEEK", "MONTH", "QUARTER", "YEAR"] as const;

export default function TimeframeSelector({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(tf: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("timeframe", tf);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex gap-1">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          onClick={() => select(tf)}
          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
            current === tf
              ? "bg-indigo-600 text-white"
              : "text-zinc-400 hover:text-white hover:bg-zinc-700"
          }`}
        >
          {tf.charAt(0) + tf.slice(1).toLowerCase()}
        </button>
      ))}
    </div>
  );
}
