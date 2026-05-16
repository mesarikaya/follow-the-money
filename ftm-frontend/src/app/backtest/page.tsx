import ComingSoonPage from "@/components/ComingSoonPage";

const MOCK_BACKTEST_RESULT = {
  startDate: "2021-01-01",
  endDate: "2025-12-31",
  totalReturnPercent: 68.4,
  annualizedReturnPercent: 11.2,
  maxDrawdownPercent: -18.7,
  sharpeRatio: 1.34,
  spyReturnPercent: 52.1,
  spySharpeRatio: 0.91,
};

const MOCK_EQUITY_CURVE = [
  100, 103, 108, 106, 112, 118, 115, 122, 128, 125,
  131, 135, 130, 138, 142, 148, 145, 152, 158, 162,
  159, 165, 170, 168,
];

export default function BacktesterPage() {
  const maxValue = Math.max(...MOCK_EQUITY_CURVE);
  const minValue = Math.min(...MOCK_EQUITY_CURVE);
  const range = maxValue - minValue;

  const chartH = 120;
  const chartW = 480;
  const points = MOCK_EQUITY_CURVE.map((value, index) => {
    const x = (index / (MOCK_EQUITY_CURVE.length - 1)) * chartW;
    const y = chartH - ((value - minValue) / range) * chartH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <ComingSoonPage
      title="Backtester"
      milestone="M6"
      description="Simulate the rotation strategy on historical data and compare against SPY buy-and-hold."
    >
      <div className="space-y-6">
        <div className="bg-zinc-800/40 border border-zinc-700 rounded-lg p-4">
          <h3 className="text-xs text-zinc-500 mb-3">Strategy Parameters</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Start Date",           value: MOCK_BACKTEST_RESULT.startDate    },
              { label: "End Date",             value: MOCK_BACKTEST_RESULT.endDate      },
              { label: "Rebalance Frequency",  value: "Monthly"                         },
              { label: "Top-N Categories",     value: "5"                               },
              { label: "Composite Threshold",  value: "0.55"                            },
              { label: "Risk-Free Rate",       value: "FEDFUNDS"                        },
            ].map((field) => (
              <div key={field.label}>
                <p className="text-xs text-zinc-500">{field.label}</p>
                <p className="text-sm text-zinc-300 font-mono">{field.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs text-zinc-500 mb-3">Equity Curve (2021–2025)</h3>
          <div className="bg-zinc-800/40 border border-zinc-700 rounded-lg p-4">
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full">
              <polyline
                points={points}
                fill="none"
                stroke="#22c55e"
                strokeWidth={2}
                strokeLinejoin="round"
              />
            </svg>
            <div className="flex justify-between text-xs text-zinc-600 mt-1">
              <span>Jan 2021</span>
              <span>Dec 2025</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Strategy Return",   value: `+${MOCK_BACKTEST_RESULT.totalReturnPercent}%`,    color: "text-emerald-400" },
            { label: "Annualized Return", value: `+${MOCK_BACKTEST_RESULT.annualizedReturnPercent}%`, color: "text-emerald-400" },
            { label: "Max Drawdown",      value: `${MOCK_BACKTEST_RESULT.maxDrawdownPercent}%`,     color: "text-red-400"     },
            { label: "Sharpe Ratio",      value: MOCK_BACKTEST_RESULT.sharpeRatio.toFixed(2),        color: "text-zinc-300"   },
            { label: "SPY Return",        value: `+${MOCK_BACKTEST_RESULT.spyReturnPercent}%`,       color: "text-zinc-400"   },
            { label: "SPY Sharpe",        value: MOCK_BACKTEST_RESULT.spySharpeRatio.toFixed(2),     color: "text-zinc-400"   },
          ].map((metric) => (
            <div key={metric.label} className="bg-zinc-800/40 border border-zinc-700/50 rounded px-3 py-2">
              <p className="text-xs text-zinc-500">{metric.label}</p>
              <p className={`text-lg font-bold font-mono ${metric.color}`}>{metric.value}</p>
            </div>
          ))}
        </div>
      </div>
    </ComingSoonPage>
  );
}
