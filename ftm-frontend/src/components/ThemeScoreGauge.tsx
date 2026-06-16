const CX = 100;
const CY = 100;
const R_OUTER = 80;
const R_INNER = 60;

function toSvgPoint(angleDeg: number, r: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY - r * Math.sin(rad) };
}

function arcPath(angleDegStart: number, angleDegEnd: number): string {
  const outer1 = toSvgPoint(angleDegStart, R_OUTER);
  const outer2 = toSvgPoint(angleDegEnd, R_OUTER);
  const inner2 = toSvgPoint(angleDegEnd, R_INNER);
  const inner1 = toSvgPoint(angleDegStart, R_INNER);
  const diff = Math.abs(angleDegStart - angleDegEnd);
  const largeArc = diff > 180 ? 1 : 0;
  return [
    `M ${outer1.x.toFixed(2)} ${outer1.y.toFixed(2)}`,
    `A ${R_OUTER} ${R_OUTER} 0 ${largeArc} 0 ${outer2.x.toFixed(2)} ${outer2.y.toFixed(2)}`,
    `L ${inner2.x.toFixed(2)} ${inner2.y.toFixed(2)}`,
    `A ${R_INNER} ${R_INNER} 0 ${largeArc} 1 ${inner1.x.toFixed(2)} ${inner1.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

const ZONES = [
  { scoreLo: 0,    scoreHi: 0.35, label: "REDUCE", fill: "#7f1d1d", activeFill: "#ef4444" },
  { scoreLo: 0.35, scoreHi: 0.50, label: "HOLD",   fill: "#422006", activeFill: "#f59e0b" },
  { scoreLo: 0.50, scoreHi: 0.65, label: "WATCH",  fill: "#0c4a6e", activeFill: "#22d3ee" },
  { scoreLo: 0.65, scoreHi: 1.0,  label: "BUY",    fill: "#14532d", activeFill: "#34d399" },
];

function scoreToAngle(score: number): number {
  return 180 - score * 180;
}

type Props = {
  score: number | null;
  signal: string | null;
};

export default function ThemeScoreGauge({ score, signal }: Props) {
  const scorePct = score != null ? Math.round(score * 100) : null;
  const needleAngle = score != null ? scoreToAngle(Math.max(0, Math.min(1, score))) : null;

  return (
    <div data-testid="theme-score-gauge" className="flex flex-col items-center">
      <svg
        viewBox="0 0 200 112"
        className="w-40 h-auto"
        aria-label={`Score gauge: ${scorePct ?? "—"} out of 100`}
      >
        {ZONES.map((zone) => {
          const angleStart = scoreToAngle(zone.scoreLo);
          const angleEnd = scoreToAngle(zone.scoreHi);
          const isActive = score != null && score >= zone.scoreLo;
          return (
            <path
              key={zone.label}
              d={arcPath(angleStart, angleEnd)}
              fill={isActive ? zone.activeFill : zone.fill}
              opacity={isActive ? 0.9 : 0.4}
            />
          );
        })}

        {needleAngle != null && (() => {
          const tip = toSvgPoint(needleAngle, R_INNER - 4);
          const left = toSvgPoint(needleAngle + 90, 5);
          const right = toSvgPoint(needleAngle - 90, 5);
          return (
            <>
              <polygon
                points={`${tip.x.toFixed(1)},${tip.y.toFixed(1)} ${left.x.toFixed(1)},${left.y.toFixed(1)} ${right.x.toFixed(1)},${right.y.toFixed(1)}`}
                fill="#f8fafc"
              />
              <circle cx={CX} cy={CY} r="5" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
            </>
          );
        })()}

        {scorePct != null && (
          <text
            x={CX}
            y={CY + 24}
            textAnchor="middle"
            fontSize="18"
            fontWeight="700"
            fill="#f1f5f9"
            fontFamily="monospace"
          >
            {scorePct}
          </text>
        )}

        {scorePct == null && (
          <text x={CX} y={CY + 24} textAnchor="middle" fontSize="14" fill="#64748b">—</text>
        )}

        <text x="20" y="108" textAnchor="middle" fontSize="7" fill="#7f1d1d" fontWeight="600">0</text>
        <text x="100" y="16" textAnchor="middle" fontSize="7" fill="#64748b">50</text>
        <text x="180" y="108" textAnchor="middle" fontSize="7" fill="#14532d" fontWeight="600">100</text>
      </svg>

      <div className="flex gap-3 text-[9px] mt-0.5">
        {ZONES.map((z) => (
          <span
            key={z.label}
            className="font-semibold"
            style={{ color: signal === z.label ? z.activeFill : "#475569" }}
          >
            {z.label}
          </span>
        ))}
      </div>
    </div>
  );
}
