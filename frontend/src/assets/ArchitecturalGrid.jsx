export default function ArchitecturalGrid({ className }) {
  const towers = [
    { x: 40,  w: 90,  h: 300, base: 460 },
    { x: 145, w: 60,  h: 380, base: 460 },
    { x: 220, w: 100, h: 250, base: 460 },
    { x: 335, w: 70,  h: 420, base: 460 },
    { x: 420, w: 85,  h: 200, base: 460 },
  ];

  return (
    <svg
      className={className}
      viewBox="0 0 520 460"
      preserveAspectRatio="xMidYMax slice"
      role="img"
      aria-label="Abstract architectural skyline illustration"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="ag-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1b1c1c" />
          <stop offset="100%" stopColor="#0d0d0d" />
        </linearGradient>
        <linearGradient id="ag-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d0d0d" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.85" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="520" height="460" fill="url(#ag-sky)" />

      {towers.map((t, i) => (
        <g key={i}>
          <rect
            x={t.x}
            y={t.base - t.h}
            width={t.w}
            height={t.h}
            fill="#1f2020"
            stroke="#434849"
            strokeOpacity="0.5"
            strokeWidth="0.5"
          />
          {Array.from({ length: Math.floor(t.h / 22) }, (_, row) =>
            Array.from({ length: Math.floor(t.w / 18) }, (_, col) => {
              const lit = (row * 7 + col * 3 + i) % 5 === 0;
              return (
                <rect
                  key={`${row}-${col}`}
                  x={t.x + 6 + col * 18}
                  y={t.base - t.h + 8 + row * 22}
                  width="9"
                  height="13"
                  fill={lit ? "#e1eff3" : "#2a2a2a"}
                  fillOpacity={lit ? 0.55 : 0.5}
                />
              );
            })
          )}
        </g>
      ))}

      <rect x="0" y="0" width="520" height="460" fill="url(#ag-fade)" />
    </svg>
  );
}
