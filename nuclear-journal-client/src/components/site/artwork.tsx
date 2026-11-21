import { cn } from "@/lib/utils";

// Decorative illustrations used wherever an article has no cover image.
// They are drawn in SVG, so there is nothing to download or license, and the
// same seed always produces the same picture.

function hash(text: string) {
  let value = 5381;
  for (let index = 0; index < text.length; index += 1) value = (value * 33) ^ text.charCodeAt(index);
  return value >>> 0;
}

const SKIES = [
  { top: "#b9d3e6", bottom: "#eef3f1", hills: "#a9bfb8", ground: "#7c9e86", near: "#5f8a72" },
  { top: "#b5d8d3", bottom: "#f1f4ee", hills: "#a3c1b6", ground: "#6f9a8a", near: "#4f8172" },
  { top: "#c9d3e6", bottom: "#f4efe6", hills: "#b6bfb4", ground: "#8a9f86", near: "#6b8a6c" },
];

function towerPath(cx: number, base: number, height: number, halfWidth: number) {
  const top = base - height;
  const topHalf = halfWidth * 0.62;
  const waist = halfWidth * 0.52;
  return [
    `M${cx - halfWidth},${base}`,
    `C${cx - halfWidth * 0.6},${base - height * 0.45} ${cx - waist},${base - height * 0.75} ${cx - topHalf},${top}`,
    `L${cx + topHalf},${top}`,
    `C${cx + waist},${base - height * 0.75} ${cx + halfWidth * 0.6},${base - height * 0.45} ${cx + halfWidth},${base}`,
    "Z",
  ].join(" ");
}

function Steam({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <g fill="#ffffff" opacity="0.92">
      <circle cx={x} cy={y - 8 * scale} r={14 * scale} />
      <circle cx={x + 16 * scale} cy={y - 18 * scale} r={17 * scale} />
      <circle cx={x + 38 * scale} cy={y - 26 * scale} r={15 * scale} opacity="0.8" />
      <circle cx={x + 58 * scale} cy={y - 32 * scale} r={12 * scale} opacity="0.6" />
    </g>
  );
}

function PlantScene({ seed, id }: { seed: number; id: string }) {
  const sky = SKIES[seed % SKIES.length]!;
  const shift = (seed >> 3) % 60;
  const towers = [
    { cx: 230 + shift, height: 150, half: 46 },
    { cx: 320 + shift, height: 130, half: 40 },
  ];
  return (
    <>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky.top} />
          <stop offset="1" stopColor={sky.bottom} />
        </linearGradient>
        <linearGradient id={`${id}-tower`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f2f2ee" />
          <stop offset="0.55" stopColor="#d9dcd7" />
          <stop offset="1" stopColor="#a9b0ad" />
        </linearGradient>
      </defs>
      <rect width="400" height="250" fill={`url(#${id}-sky)`} />
      <path d="M0,178 C60,160 120,170 180,162 C250,152 320,166 400,156 L400,250 L0,250 Z" fill={sky.hills} opacity="0.7" />
      {towers.map((tower) => (
        <g key={tower.cx}>
          <path d={towerPath(tower.cx, 200, tower.height, tower.half)} fill={`url(#${id}-tower)`} />
          <Steam x={tower.cx - 12} y={200 - tower.height} scale={1.1} />
        </g>
      ))}
      {/* Reactor building: a cylinder with a dome */}
      <g transform={`translate(${110 + shift / 2} 0)`}>
        <rect x="0" y="150" width="64" height="52" fill="#e7e8e3" />
        <rect x="44" y="150" width="20" height="52" fill="#c3c8c4" />
        <path d="M0,150 A32,26 0 0 1 64,150 Z" fill="#eef0ec" />
        <rect x="-38" y="176" width="40" height="26" fill="#d4d8d3" />
        <rect x="-34" y="182" width="32" height="3" fill="#9aa5a2" />
      </g>
      <path d="M0,204 C80,196 160,206 240,200 C310,195 360,204 400,200 L400,250 L0,250 Z" fill={sky.ground} />
      <path d="M0,226 C90,216 170,230 260,222 C330,216 370,226 400,222 L400,250 L0,250 Z" fill={sky.near} />
    </>
  );
}

function AtomScene({ seed, id }: { seed: number; id: string }) {
  const tilt = (seed % 40) - 20;
  return (
    <>
      <defs>
        <radialGradient id={`${id}-glow`} cx="0.7" cy="0.45" r="0.7">
          <stop offset="0" stopColor="#287c78" stopOpacity="0.55" />
          <stop offset="1" stopColor="#142b4a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="250" fill="#142b4a" />
      <rect width="400" height="250" fill={`url(#${id}-glow)`} />
      <g transform={`translate(270 125) rotate(${tilt})`} fill="none" stroke="#8fbdb9" strokeWidth="2.5" opacity="0.9">
        <ellipse rx="110" ry="38" />
        <ellipse rx="110" ry="38" transform="rotate(60)" />
        <ellipse rx="110" ry="38" transform="rotate(-60)" />
      </g>
      <circle cx="270" cy="125" r="13" fill="#fafaf7" />
      <circle cx="270" cy="125" r="22" fill="#fafaf7" opacity="0.15" />
      <g fill="#ffffff" opacity="0.35">
        <circle cx="40" cy="40" r="1.6" />
        <circle cx="90" cy="190" r="1.2" />
        <circle cx="140" cy="70" r="1.4" />
        <circle cx="60" cy="130" r="1" />
      </g>
    </>
  );
}

export function ArticleArt({
  seed,
  variant,
  className,
}: {
  seed: string;
  variant?: "plant" | "atom";
  className?: string;
}) {
  const value = hash(seed);
  const id = `nj-${value.toString(36)}-${variant ?? "auto"}`;
  const chosen = variant ?? (value % 3 === 2 ? "atom" : "plant");
  return (
    <svg
      viewBox="0 0 400 250"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      className={cn("block h-full w-full", className)}
    >
      {chosen === "atom" ? <AtomScene seed={value} id={id} /> : <PlantScene seed={value} id={id} />}
    </svg>
  );
}
