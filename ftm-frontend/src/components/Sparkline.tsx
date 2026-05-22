export default function Sparkline({
  values,
  width = 56,
  height = 18,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return <span className="text-slate-700 text-[9px]">—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 0.001;
  const toX = (i: number) => (i / (values.length - 1)) * width;
  const toY = (v: number) => height - ((v - min) / range) * height;
  const points = values
    .map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
    .join(" ");
  const last = values[values.length - 1];
  const first = values[0];
  const trending = last > first + 0.01 ? "up" : last < first - 0.01 ? "down" : "flat";
  const stroke =
    trending === "up" ? "#34d399" : trending === "down" ? "#f87171" : "#64748b";
  const endX = toX(values.length - 1);
  const endY = toY(last);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="overflow-visible"
      title={`30-day composite score trend. Latest: ${Math.round(last * 100)}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.8"
      />
      <circle cx={endX.toFixed(1)} cy={endY.toFixed(1)} r="1.5" fill={stroke} />
    </svg>
  );
}
