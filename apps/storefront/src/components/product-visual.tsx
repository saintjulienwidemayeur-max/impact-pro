import type { Product, VisualKind } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const TONES = {
  white: { fill: "#FFFFFF", stroke: "#C9D6D4", shade: "#E8EFEE", onLight: true },
  teal: { fill: "#0A716A", stroke: "#0A3D39", shade: "#085F59", onLight: false },
  cyan: { fill: "#42C6F0", stroke: "#1E9CC6", shade: "#2FB5E0", onLight: true },
  sun: { fill: "#FFC93C", stroke: "#D9A21C", shade: "#F2B51A", onLight: true },
} as const;

const LOGO = "/brand/logo-impact-pro.png";
const LOGO_INV = "/brand/logo-impact-pro-inverse.png";
const ICON = "/brand/icon-ip-192.png";

type Tone = keyof typeof TONES;

function Logo({ x, y, w, light }: { x: number; y: number; w: number; light: boolean }) {
  // Logo files are ~3.2:1
  return <image href={light ? LOGO : LOGO_INV} x={x} y={y} width={w} height={w / 3.2} preserveAspectRatio="xMidYMid meet" />;
}

function Icon({ x, y, s }: { x: number; y: number; s: number }) {
  return <image href={ICON} x={x} y={y} width={s} height={s} />;
}

function Shape({ kind, tone }: { kind: VisualKind; tone: Tone }) {
  const t = TONES[tone];
  const light = t.onLight;
  switch (kind) {
    case "mug":
      return (
        <g>
          <path d="M138 68 h10 a18 18 0 0 1 0 36 h-10" fill="none" stroke={t.stroke} strokeWidth="9" />
          <path d="M138 68 h10 a18 18 0 0 1 0 36 h-10" fill="none" stroke={t.fill} strokeWidth="5" />
          <rect x="58" y="44" width="84" height="88" rx="10" fill={t.fill} stroke={t.stroke} strokeWidth="1.5" />
          <ellipse cx="100" cy="46" rx="42" ry="5" fill={t.shade} />
          <rect x="66" y="52" width="6" height="70" rx="3" fill="#fff" opacity="0.5" />
          <Logo x={66} y={76} w={68} light={light} />
          <text x="100" y="110" textAnchor="middle" fontSize="6.5" fill="#0E2A2E" fontFamily="var(--font-fredoka)" fontWeight="600">
            Votre marque, partout.
          </text>
        </g>
      );
    case "tshirt":
    case "polo":
      return (
        <g>
          <path
            d="M70 30 L50 38 L28 62 L44 76 L56 66 L56 140 L144 140 L144 66 L156 76 L172 62 L150 38 L130 30 Q100 46 70 30 Z"
            fill={t.fill}
            stroke={t.stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {kind === "polo" ? (
            <g>
              <path d="M84 32 L100 54 L116 32 L108 28 L100 40 L92 28 Z" fill={t.shade} stroke={t.stroke} strokeWidth="1" />
              <line x1="100" y1="54" x2="100" y2="74" stroke={t.stroke} strokeWidth="1" />
              <circle cx="100" cy="60" r="1.6" fill={t.stroke} />
              <circle cx="100" cy="68" r="1.6" fill={t.stroke} />
              <Logo x={108} y={62} w={30} light={light} />
            </g>
          ) : (
            <g>
              <path d="M84 33 Q100 44 116 33" fill="none" stroke={t.stroke} strokeWidth="2" />
              <Logo x={66} y={70} w={68} light={false} />
            </g>
          )}
        </g>
      );
    case "cap":
      return (
        <g>
          <path d="M44 104 Q46 46 100 42 Q154 46 156 104 Z" fill={t.fill} stroke={t.stroke} strokeWidth="1.5" />
          <path d="M100 42 L100 104" stroke={t.stroke} strokeWidth="0.8" opacity="0.6" />
          <path d="M44 104 Q100 92 156 104 Q178 112 182 124 Q120 112 44 116 Z" fill={t.shade} stroke={t.stroke} strokeWidth="1.5" />
          <circle cx="100" cy="43" r="3" fill={t.stroke} />
          <Logo x={68} y={66} w={64} light={light} />
        </g>
      );
    case "banner":
      return (
        <g>
          <line x1="14" y1="40" x2="30" y2="48" stroke="#4B6366" strokeWidth="1.2" />
          <line x1="186" y1="40" x2="170" y2="48" stroke="#4B6366" strokeWidth="1.2" />
          <rect x="24" y="44" width="152" height="70" rx="3" fill="#fff" stroke="#C9D6D4" />
          <path d="M120 44 L176 44 L176 114 L108 114 Z" fill="#0A716A" />
          <path d="M120 44 L126 44 L114 114 L108 114 Z" fill="#42C6F0" />
          <Logo x={32} y={54} w={60} light />
          <text x="34" y="88" fontSize="8.5" fill="#0E2A2E" fontFamily="var(--font-fredoka)" fontWeight="700">
            Nous mettons votre
          </text>
          <text x="34" y="98" fontSize="8.5" fill="#0E2A2E" fontFamily="var(--font-fredoka)" fontWeight="700">
            marque sur tout.
          </text>
          <Icon x={134} y={58} s={26} />
          <rect x="128" y="92" width="38" height="9" rx="4.5" fill="#FFC93C" />
          {[30, 170].map((cx) => [50, 108].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.6" fill="#fff" stroke="#4B6366" />))}
        </g>
      );
    case "flag":
      return (
        <g>
          {(["white", "teal", "sun"] as const).map((ft, i) => {
            const f = TONES[ft];
            const x = 46 + i * 46;
            return (
              <g key={ft}>
                <line x1={x} y1="24" x2={x} y2="146" stroke="#0E2A2E" strokeWidth="2" />
                <path d={`M${x} 26 Q${x + 26} 22 ${x + 28} 44 L${x + 26} 118 L${x} 118 Z`} fill={f.fill} stroke={f.stroke} />
                <Icon x={x + 5} y={34} s={18} />
                <rect x={x - 10} y="144" width="20" height="4" rx="2" fill="#0E2A2E" />
              </g>
            );
          })}
        </g>
      );
    case "card":
      return (
        <g>
          <g transform="rotate(-8 90 80)">
            <rect x="34" y="40" width="112" height="64" rx="6" fill={TONES.teal.fill} />
            <circle cx="140" cy="100" r="26" fill="none" stroke="#fff" strokeOpacity="0.15" strokeWidth="8" />
            <Logo x={50} y={52} w={80} light={false} />
            <text x="90" y="92" textAnchor="middle" fontSize="6.5" fill="#fff" fontFamily="var(--font-fredoka)">
              Votre marque, partout.
            </text>
          </g>
          <g transform="rotate(6 110 100)">
            <rect x="62" y="74" width="112" height="64" rx="6" fill="#fff" stroke="#C9D6D4" />
            <rect x="62" y="74" width="4" height="64" fill="#42C6F0" />
            <text x="74" y="92" fontSize="9" fill="#0A716A" fontFamily="var(--font-fredoka)" fontWeight="700">
              Votre nom
            </text>
            <rect x="74" y="98" width="42" height="3" rx="1.5" fill="#C9D6D4" />
            <rect x="74" y="116" width="58" height="3" rx="1.5" fill="#C9D6D4" />
            <rect x="74" y="123" width="48" height="3" rx="1.5" fill="#C9D6D4" />
            <Icon x={148} y={80} s={18} />
          </g>
        </g>
      );
    case "notebook":
      return (
        <g transform="rotate(-6 100 84)">
          <rect x="58" y="28" width="88" height="114" rx="6" fill="#fff" stroke="#C9D6D4" transform="translate(5 4)" />
          <rect x="54" y="26" width="88" height="114" rx="6" fill={t.fill} stroke={t.stroke} strokeWidth="1.5" />
          <rect x="132" y="26" width="5" height="114" fill={t.stroke} opacity="0.5" />
          <rect x="142" y="60" width="6" height="52" rx="3" fill="#C9D6D4" />
          <path d="M70 140 L70 156 L75 150 L80 156 L80 140" fill="#42C6F0" />
          <Logo x={62} y={68} w={66} light={light} />
          <text x="95" y="102" textAnchor="middle" fontSize="6" fill="#42C6F0" fontFamily="var(--font-fredoka)">
            Votre marque, partout.
          </text>
        </g>
      );
    case "pen":
      return (
        <g>
          {[0, 1].map((i) => (
            <g key={i} transform={`translate(${78 + i * 34} 0)`}>
              <rect x="0" y="22" width="14" height="122" rx="7" fill="#fff" stroke="#C9D6D4" />
              <path d="M2 144 L7 156 L12 144 Z" fill="#C9D6D4" />
              <rect x="10" y="24" width="4" height="46" rx="2" fill="#E8EFEE" stroke="#C9D6D4" />
              {i === 0 ? (
                <g transform="translate(9 120) rotate(-90)">
                  <Logo x={0} y={-8} w={36} light />
                </g>
              ) : (
                <Icon x={1} y={36} s={12} />
              )}
            </g>
          ))}
        </g>
      );
    case "photocall":
      return (
        <g>
          <rect x="22" y="28" width="156" height="104" rx="4" fill="#fff" stroke="#C9D6D4" />
          {Array.from({ length: 4 }).map((_, r) =>
            Array.from({ length: 4 }).map((__, c) =>
              (r + c) % 2 === 0 ? (
                <Icon key={`${r}-${c}`} x={34 + c * 38} y={34 + r * 23} s={14} />
              ) : (
                <Logo key={`${r}-${c}`} x={26 + c * 38} y={37 + r * 23} w={30} light />
              ),
            ),
          )}
          <rect x="62" y="56" width="76" height="46" rx="6" fill="#42C6F0" transform="translate(3 3)" />
          <rect x="62" y="56" width="76" height="46" rx="6" fill="#0A716A" />
          <Logo x={70} y={64} w={60} light={false} />
          <rect x="22" y="128" width="120" height="4" fill="#42C6F0" />
          <rect x="142" y="128" width="36" height="4" fill="#FFC93C" />
          <rect x="16" y="132" width="168" height="16" rx="2" fill="#E0464E" opacity="0.85" />
        </g>
      );
    case "sticker":
      return (
        <g>
          <circle cx="78" cy="82" r="44" fill="#FFC93C" />
          <text x="78" y="82" textAnchor="middle" fontSize="18" fill="#0A716A" fontFamily="var(--font-fredoka)" fontWeight="700">
            Merci !
          </text>
          <text x="78" y="96" textAnchor="middle" fontSize="6.5" letterSpacing="1" fill="#0E2A2E" fontFamily="var(--font-inter)" fontWeight="700">
            IMPACT PRO
          </text>
          <circle cx="136" cy="96" r="38" fill="#0A716A" />
          <Icon x={116} y={76} s={40} />
        </g>
      );
  }
}

export function ProductVisual({
  product,
  className,
  title,
}: {
  product: Pick<Product, "visual" | "tone" | "name">;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 200 168"
      role="img"
      aria-label={title ?? `Illustration : ${product.name} personnalisé Impact Pro`}
      className={cn("h-full w-full", className)}
    >
      <ellipse cx="100" cy="152" rx="70" ry="6" fill="#0A3D39" opacity="0.08" />
      <Shape kind={product.visual} tone={product.tone} />
    </svg>
  );
}
