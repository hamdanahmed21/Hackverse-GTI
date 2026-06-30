export default function GuardianEye({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 800 450"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="Abstract concentric guardian node illustration"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="ge-core" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#e1eff3" stopOpacity="0.95" />
          <stop offset="35%" stopColor="#7d9aa3" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#0d0d0d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ge-bg" cx="50%" cy="50%" r="75%">
          <stop offset="0%" stopColor="#1f2020" />
          <stop offset="100%" stopColor="#0d0d0d" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="800" height="450" fill="url(#ge-bg)" />

      {Array.from({ length: 14 }, (_, i) => {
        const r = 30 + i * 16;
        const op = 0.06 + (14 - i) * 0.012;
        return (
          <circle
            key={i}
            cx="400"
            cy="225"
            r={r}
            fill="none"
            stroke="#c3c7c9"
            strokeOpacity={op}
            strokeWidth="1"
          />
        );
      })}

      <circle cx="400" cy="225" r="150" fill="url(#ge-core)" />
      <circle cx="400" cy="225" r="92" fill="#0d0d0d" stroke="#e1eff3" strokeOpacity="0.5" strokeWidth="0.5" />
      <circle cx="400" cy="225" r="58" fill="#131314" stroke="#e1eff3" strokeOpacity="0.7" strokeWidth="0.5" />
      <circle cx="400" cy="225" r="26" fill="#e1eff3" fillOpacity="0.85" />
      <circle cx="386" cy="211" r="7" fill="#ffffff" fillOpacity="0.9" />

      <g stroke="#8d9193" strokeOpacity="0.35" strokeWidth="0.5">
        <line x1="400" y1="20" x2="400" y2="100" />
        <line x1="400" y1="350" x2="400" y2="430" />
        <line x1="120" y1="225" x2="200" y2="225" />
        <line x1="600" y1="225" x2="680" y2="225" />
      </g>

      <g fill="#e1eff3" fillOpacity="0.6">
        <circle cx="400" cy="20" r="2" />
        <circle cx="400" cy="430" r="2" />
        <circle cx="120" cy="225" r="2" />
        <circle cx="680" cy="225" r="2" />
      </g>
    </svg>
  );
}
