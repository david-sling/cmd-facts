import { useState } from 'react'
import { motion } from 'motion/react'
import {
  BadgeCheck,
  ChevronDown,
  Eye,
  EyeOff,
  Fingerprint,
  Globe,
  KeyRound,
  Repeat,
  RotateCcw,
  Zap,
} from 'lucide-react'
import { effectsOf, explain } from 'cmd-facts'
import type { Effect, Facts } from 'cmd-facts'
import { SlideUpText } from '#/components/slide-up-text'

const EXAMPLES = [
  'curl -O https://example.com/app.zip',
  'rm -rf ./build',
  'git push origin main',
  'sudo installer -pkg app.pkg -target /',
  'df -h',
]

type Tone = 'good' | 'bad' | 'neutral'

const TONE_TEXT: Record<Tone, string> = {
  good: 'text-good',
  bad: 'text-bad',
  neutral: 'text-ink-2',
}

const TONE_RING: Record<Tone, string> = {
  good: 'text-good',
  bad: 'text-bad',
  neutral: 'text-ink-3',
}

const SPRING = { type: 'spring', stiffness: 380, damping: 32, mass: 0.85 } as const

/** Collapsed, the body hides inside the circle; open, it is the card below it. */
const BODY = {
  closed: { left: 5, width: 28, height: 8 },
  open: { width: 268, height: 82 },
}
const CIRCLE = 38
const BODY_TOP = 22
/** Room to the left of the circle for a card that opens that way, inside the filter region. */
const PAD = 240

/**
 * A card opens away from the edge it is near: the first circles open to the right, the
 * middle ones open around themselves, the last ones open back to the left. The side the
 * circle sits on gets a square corner, because a rounded one there curves back in under
 * the circle and pinches the silhouette; the open sides keep their radius and the filter
 * gives them the concave join.
 */
type Anchor = 'left' | 'center' | 'right'

const OPEN_LEFT: Record<Anchor, number> = {
  left: 0,
  center: (CIRCLE - BODY.open.width) / 2,
  right: CIRCLE - BODY.open.width,
}

const OPEN_CORNER: Record<Anchor, React.CSSProperties> = {
  left: { borderTopLeftRadius: 0 },
  center: {},
  right: { borderTopRightRadius: 0 },
}

function anchorFor(index: number, count: number): Anchor {
  if (index < count / 3) return 'left'
  if (index < (count * 2) / 3) return 'center'
  return 'right'
}

/**
 * Circle and body are two shapes, not one box, and the goo filter merges them: where the
 * body's top edge runs into the circle's side, the blur-and-threshold leaves the concave
 * fillet a single growing rounded box can never have. Everything inside the filter has to
 * be opaque — the threshold erases a half-transparent fill — so the ring is a second,
 * larger copy of the same two shapes, dimmed by opacity outside the filter.
 */
function IslandShape({
  isOpen,
  anchor,
  outset,
  className,
  style,
}: {
  isOpen: boolean
  anchor: Anchor
  outset: number
  className: string
  style?: React.CSSProperties
}) {
  const body = isOpen
    ? { ...BODY.open, left: OPEN_LEFT[anchor] }
    : BODY.closed
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute top-0 block h-[130px] ${className}`}
      style={{
        left: -PAD,
        width: PAD + BODY.open.width + 20,
        filter: 'url(#island-goo)',
        ...style,
      }}
    >
      <span
        className="absolute block rounded-full bg-current"
        style={{
          left: PAD - outset,
          top: -outset,
          width: CIRCLE + outset * 2,
          height: CIRCLE + outset * 2,
        }}
      />
      <motion.span
        className="absolute block bg-current"
        style={{
          top: BODY_TOP - outset,
          borderRadius: 19 + outset,
          ...OPEN_CORNER[anchor],
        }}
        initial={false}
        animate={{
          left: PAD + body.left - outset,
          width: body.width + outset * 2,
          height: body.height + outset * 2,
        }}
        transition={SPRING}
      />
    </span>
  )
}

const EFFECT_WORD: Record<Effect, string> = {
  read: 'reads',
  write: 'writes',
  create: 'creates',
  delete: 'deletes',
  terminate: 'stops things',
  install: 'installs',
  configure: 'configures',
  transmit: 'sends data',
  execute: 'runs code',
  elevate: 'elevates',
}

/** The widest effects decide the tone; reading alone is the only one that leaves nothing behind. */
function effectTone(effects: Effect[]): Tone {
  if (effects.some((e) => e === 'delete' || e === 'elevate' || e === 'execute')) return 'bad'
  if (effects.every((e) => e === 'read')) return 'good'
  return 'neutral'
}

/**
 * Every field the library returns becomes one word the reader already knows, not a label with a yes/no beside it.
 * The list is the same length for every command: this is a fixed set of questions, answered or answered `unknown`.
 */
function pillsFor(facts: Facts) {
  const effects = effectsOf(facts)
  const effectText = effects.map((e) => EFFECT_WORD[e]).join(', ')

  const pills: Array<{ icon: typeof Zap; field: string; text: string; tone: Tone }> = [
    {
      icon: Zap,
      field: 'effect',
      text: facts.opaque ? `at least ${effectText}` : effectText,
      tone: effectTone(effects),
    },
    {
      icon: RotateCcw,
      field: 'reversible',
      ...(facts.reversible === 'yes'
        ? { text: 'reversible', tone: 'good' as Tone }
        : facts.reversible === 'no'
          ? { text: 'irreversible', tone: 'bad' as Tone }
          : facts.reversible === 'with-backup'
            ? { text: 'reversible from a backup', tone: 'neutral' as Tone }
            : { text: 'reversibility unknown', tone: 'neutral' as Tone }),
    },
    {
      icon: Globe,
      field: 'network',
      ...(facts.network === 'none'
        ? { text: 'no network', tone: 'good' as Tone }
        : facts.network === 'known-host'
          ? { text: 'one known host', tone: 'neutral' as Tone }
          : facts.network === 'listens'
            ? { text: 'listens for connections', tone: 'bad' as Tone }
            : { text: 'any host', tone: 'bad' as Tone }),
    },
    {
      icon: KeyRound,
      field: 'privilege',
      ...(facts.privilege === 'none'
        ? { text: 'unprivileged', tone: 'good' as Tone }
        : facts.privilege === 'admin'
          ? { text: 'needs admin', tone: 'bad' as Tone }
          : { text: 'runs as root', tone: 'bad' as Tone }),
    },
    {
      icon: Fingerprint,
      field: 'credentials',
      ...(facts.touchesCredentials
        ? { text: 'touches credentials', tone: 'bad' as Tone }
        : { text: 'no credentials', tone: 'good' as Tone }),
    },
    {
      icon: Repeat,
      field: 'repeats',
      ...(facts.repeatSafe
        ? { text: 'repeat-safe', tone: 'good' as Tone }
        : { text: 'not repeat-safe', tone: 'bad' as Tone }),
    },
    {
      icon: facts.opaque ? EyeOff : Eye,
      field: 'visibility',
      ...(facts.opaque
        ? { text: 'hands over to something unseen', tone: 'bad' as Tone }
        : { text: 'nothing hidden', tone: 'good' as Tone }),
    },
    {
      icon: BadgeCheck,
      field: 'confidence',
      ...(facts.confidence === 'verified'
        ? { text: 'verified', tone: 'good' as Tone }
        : facts.confidence === 'derived'
          ? { text: 'derived from flags', tone: 'neutral' as Tone }
          : { text: 'confidence unknown', tone: 'neutral' as Tone }),
    },
  ]

  return pills
}

export function ExplainDemo() {
  const [command, setCommand] = useState(EXAMPLES[0])
  // hover opens a card; focus and tap open the same one, so the fields are reachable without a pointer
  const [open, setOpen] = useState<number | null>(null)
  const { sentence, facts } = explain(command)
  const pills = pillsFor(facts)

  const close = (index: number) =>
    setOpen((current) => (current === index ? null : current))

  return (
    <div className="max-w-[780px]">
      <div className="w-fit min-w-[340px] rounded-xl border border-line bg-panel px-5 py-4 font-mono text-[14px] leading-relaxed">
        <div className="text-ink-3">
          <span className="text-pink">import</span> {'{ explain }'}{' '}
          <span className="text-pink">from</span>{' '}
          <span className="text-ink-2">&apos;cmd-facts&apos;</span>
        </div>

        <div className="mt-4 flex items-center whitespace-nowrap">
          <span className="text-pink">explain</span>
          <span className="text-ink-2">(&quot;</span>
          {/* the visible text sizes the control; the native select sits invisibly on top of it */}
          <span className="relative inline-flex items-center border-b border-dashed border-line-2 py-0.5 pr-6 transition-colors hover:border-white/40 focus-within:border-white/65">
            <span className="whitespace-pre text-ink">{command}</span>
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute right-1 size-3.5 text-ink-3"
            />
            <select
              aria-label="Command to explain"
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              className="absolute inset-0 w-full cursor-pointer opacity-0 outline-none focus:outline-none focus-visible:outline-none"
            >
              {EXAMPLES.map((example) => (
                <option key={example} value={example}>
                  {example}
                </option>
              ))}
            </select>
          </span>
          <span className="text-ink-2">&quot;)</span>
        </div>
      </div>

      <p className="mt-11 text-[clamp(1.75rem,2.9vw,2.75rem)] leading-[1.18] tracking-[-0.025em] text-ink">
        {/* the key replays the slide on every new sentence; the stagger is per word, so a
            long sentence needs a short one or the last word arrives seconds after the first */}
        <SlideUpText
          key={sentence}
          stagger={0.022}
          transition={{ type: 'tween', ease: [0.625, 0.05, 0, 1], duration: 0.5 }}
          className="font-light"
        >
          {sentence}
        </SlideUpText>
      </p>

      {/* `note` is a consequence the fields cannot carry; not every row has one */}
      <p className="mt-5 max-w-[52ch] text-[15px] leading-relaxed text-ink-3">
        {facts.note}
      </p>

      {/* one circle per field. Opening one grows the circle itself into a card, the way a
          notification unfolds: the icon never moves, so the card reads as the same object. */}
      <svg aria-hidden className="pointer-events-none absolute size-0">
        <defs>
          <filter
            id="island-goo"
            x="-12%"
            y="-12%"
            width="124%"
            height="124%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -12"
            />
          </filter>
        </defs>
      </svg>

      <ul className="mt-10 flex flex-wrap gap-2.5">
        {pills.map(({ icon: Icon, field, text, tone }, index) => {
          const isOpen = open === index
          const anchor = anchorFor(index, pills.length)
          return (
            <li
              key={field}
              className={`relative size-[38px] ${isOpen ? 'z-20' : 'z-10'}`}
            >
              {/* the shapes are painted, never pointed at: an open card covers the circles
                  to its right, and the pointer has to reach them to open theirs */}
              <IslandShape
                isOpen={isOpen}
                anchor={anchor}
                outset={2}
                className={TONE_RING[tone]}
                style={{ opacity: 0.45 }}
              />
              <IslandShape
                isOpen={isOpen}
                anchor={anchor}
                outset={0}
                className="text-panel"
              />

              <Icon
                aria-hidden
                className={`pointer-events-none absolute left-[10px] top-[10px] size-[17px] ${TONE_TEXT[tone]}`}
              />
              <span
                aria-hidden
                style={{ left: OPEN_LEFT[anchor] + 14 }}
                className={`pointer-events-none absolute top-[50px] pr-5 transition-opacity duration-200 ${
                  isOpen ? 'opacity-100 delay-[90ms]' : 'opacity-0'
                }`}
              >
                <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
                  {field}
                </span>
                <span
                  className={`mt-1.5 block whitespace-nowrap text-[15px] ${TONE_TEXT[tone]}`}
                >
                  {text}
                </span>
              </span>

              <button
                type="button"
                aria-expanded={isOpen}
                aria-label={`${field}: ${text}`}
                onMouseEnter={() => setOpen(index)}
                onMouseLeave={() => close(index)}
                onFocus={() => setOpen(index)}
                onBlur={() => close(index)}
                onClick={() => setOpen((current) => (current === index ? null : index))}
                className="absolute inset-0 rounded-full"
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
