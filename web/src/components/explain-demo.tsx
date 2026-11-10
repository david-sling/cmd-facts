import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronDown,
  CornerDownRight,
  Eye,
  EyeOff,
  Fingerprint,
  Globe,
  KeyRound,
  Minus,
  Repeat,
  RotateCcw,
  X,
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

/** The verdict as a mark: the words stay plain, the colour and the mark carry the reading. */
const TONE_MARK: Record<Tone, typeof Check> = {
  good: Check,
  bad: X,
  neutral: Minus,
}

const TONE_RING: Record<Tone, string> = {
  good: 'text-good',
  bad: 'text-bad',
  neutral: 'text-ink-3',
}

const SPRING = { type: 'spring', stiffness: 380, damping: 32, mass: 0.85 } as const

/** Collapsed, the body hides inside the circle; open, it is the card under the pill. */
const BODY = {
  closed: { left: 5, width: 28, height: 8 },
  open: { height: 64 },
}
const CIRCLE = 38
const RADIUS = 19
/** How far the body's top edge rides up under the head, so the two read as one shape. */
const BODY_TOP = 22
/** Narrower than this and the shape stops reading as a card. */
const MIN_CARD = 132
/** Margin around the shapes for the filter's blur to land in. */
const BLUR_ROOM = 22
/** The card always outruns the head by this much, so the two never share an edge. */
const CARD_LEAD = 26
const NAME_LEFT = 40
const NAME_RIGHT = 14
const VALUE_PAD = 18

/**
 * An island opens away from the border it sits nearer, measured where the circle actually
 * is rather than where it falls in the list: the row wraps on a narrow screen, where the
 * last field can be the first on its line. The side the head sits on gets a square corner,
 * because a rounded one there curves back in under the head and pinches the silhouette;
 * the open side keeps its radius and the filter gives it the concave join.
 */
type Side = 'left' | 'right'

const OPEN_CORNER: Record<Side, React.CSSProperties> = {
  left: { borderTopLeftRadius: 0 },
  right: { borderTopRightRadius: 0 },
}

function openLeftFor(side: Side, width: number) {
  return side === 'left' ? 0 : CIRCLE - width
}

type Pill = {
  icon: typeof Zap
  field: string
  text: string
  tone: Tone
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

  const pills: Pill[] = [
    {
      icon: Zap,
      field: 'effect',
      text: facts.opaque ? `at least ${effectText}` : effectText,
      tone: effectTone(effects),
    },
    {
      icon: RotateCcw,
      field: 'reversibility',
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

function IslandShape({
  isOpen,
  corner,
  headLeft,
  headWidth,
  openLeft,
  openWidth,
  outset,
  className,
  style,
}: {
  isOpen: boolean
  corner: Side | null
  headLeft: number
  headWidth: number
  openLeft: number
  openWidth: number
  outset: number
  className: string
  style?: React.CSSProperties
}) {
  const body = isOpen
    ? { left: openLeft, width: openWidth, height: BODY.open.height }
    : BODY.closed
  // the layer is only as wide as the shapes it holds: a box that reached far past the
  // card would widen the page itself, however little of it is ever painted
  const layerLeft = Math.min(0, openLeft, headLeft) - BLUR_ROOM
  const origin = -layerLeft
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute top-0 block h-[130px] ${className}`}
      style={{
        left: layerLeft,
        width:
          Math.max(CIRCLE, headLeft + headWidth, openLeft + openWidth) -
          Math.min(0, openLeft, headLeft) +
          BLUR_ROOM * 2,
        filter: 'url(#island-goo)',
        ...style,
      }}
    >
      <motion.span
        className="absolute block bg-current"
        style={{
          top: -outset,
          height: CIRCLE + outset * 2,
          borderRadius: RADIUS + outset,
        }}
        initial={false}
        animate={{
          left: origin + (isOpen ? headLeft : 0) - outset,
          width: (isOpen ? headWidth : CIRCLE) + outset * 2,
        }}
        transition={SPRING}
      />
      <motion.span
        className="absolute block bg-current"
        style={{
          top: BODY_TOP - outset,
          borderRadius: RADIUS + outset,
          ...(corner ? OPEN_CORNER[corner] : {}),
        }}
        initial={false}
        animate={{
          left: origin + body.left - outset,
          width: body.width + outset * 2,
          height: body.height + outset * 2,
        }}
        transition={SPRING}
      />
    </span>
  )
}

/**
 * One field. The head carries the icon and the field's name; the card under it carries the
 * reading. Both are measured, because their words are painted outside the filter that
 * draws their shapes and the two layers have to agree on one width.
 */
function IslandField({
  pill,
  index,
  count,
  isOpen,
  onOpen,
  onClose,
  onToggle,
}: {
  pill: Pill
  index: number
  count: number
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  onToggle: () => void
}) {
  const { icon: Icon, field, text, tone } = pill
  const Mark = TONE_MARK[tone]
  const itemRef = useRef<HTMLLIElement>(null)
  const nameRef = useRef<HTMLSpanElement>(null)
  const valueRef = useRef<HTMLSpanElement>(null)
  const [size, setSize] = useState({ head: CIRCLE, card: MIN_CARD })
  const [row, setRow] = useState({ offset: 0, width: 0 })

  useEffect(() => {
    const name = nameRef.current
    const value = valueRef.current
    if (!name || !value) return
    const measure = () => {
      const head = Math.max(
        CIRCLE,
        NAME_LEFT + Math.ceil(name.scrollWidth) + NAME_RIGHT,
      )
      setSize({
        head,
        card: Math.max(
          MIN_CARD,
          head + CARD_LEAD,
          VALUE_PAD * 2 + Math.ceil(value.scrollWidth),
        ),
      })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    // the words are measured again once the webfont lands, or they size to the fallback
    const observer = new ResizeObserver(measure)
    observer.observe(name)
    observer.observe(value)
    return () => observer.disconnect()
  }, [field, text])

  // where this circle sits among the icons, so an open card can be kept inside them:
  // the row wraps on a narrow screen, where an index near the end is no longer near
  // the right. The bounds are the circles' own span, not the list box, which stretches
  // the full width of the console and would let a card run past the last icon.
  useEffect(() => {
    const item = itemRef.current
    const list = item?.parentElement
    if (!item || !list) return
    // rects, not offsetLeft: the circle's offsetParent is not the row, so the two
    // numbers would be measured from different origins
    const measure = () => {
      const seat = item.getBoundingClientRect()
      let first = Infinity
      let last = -Infinity
      for (const circle of list.children) {
        const box = circle.getBoundingClientRect()
        first = Math.min(first, box.left)
        last = Math.max(last, box.right)
      }
      if (!Number.isFinite(first)) return
      setRow({ offset: seat.left - first, width: last - first })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [])

  // nearer the icons’ left border than their right? then open rightwards. Before the
  // first measurement the list order is the only clue there is
  const side: Side = row.width
    ? row.offset + CIRCLE / 2 > row.width / 2
      ? 'right'
      : 'left'
    : index < count / 2
      ? 'left'
      : 'right'

  const wanted = openLeftFor(side, size.card)
  const leftmost = -row.offset
  const rightmost = Math.max(leftmost, row.width - row.offset - size.card)
  const openLeft = row.width
    ? Math.min(Math.max(wanted, leftmost), rightmost)
    : wanted

  // the squared corner follows where the head ended up on the card, not where the side
  // wanted it: clamping can move the card out from under its own head, and then neither
  // corner belongs to it
  const corner: Side | null =
    openLeft > -0.5
      ? 'left'
      : openLeft < CIRCLE - size.card + 0.5
        ? 'right'
        : null

  const body = isOpen
    ? { left: openLeft, width: size.card, height: BODY.open.height }
    : BODY.closed

  // the head opens the same way the card does, or the two would pull apart. Opening
  // leftward it keeps the icon at its right end; otherwise the icon travels to its left
  // end, which for a centred head means moving out of the seat the circle sat in.
  const wantedHead = openLeftFor(side, size.head)
  const headLeft = row.width
    ? Math.min(
        Math.max(wantedHead, leftmost),
        Math.max(leftmost, row.width - row.offset - size.head),
      )
    : wantedHead
  const iconAtRight = side === 'right'
  const iconLeft = iconAtRight
    ? headLeft + size.head - CIRCLE + 10
    : headLeft + 10

  return (
    <li
      ref={itemRef}
      className={`relative size-[38px] ${isOpen ? 'z-20' : 'z-10'}`}
    >
      {/* the shapes are painted, never pointed at: an open card covers the circles
          to its right, and the pointer has to reach them to open theirs */}
      <IslandShape
        isOpen={isOpen}
        corner={corner}
        headLeft={headLeft}
        headWidth={size.head}
        openLeft={openLeft}
        openWidth={size.card}
        outset={2}
        className={TONE_RING[tone]}
        style={{ opacity: 0.45 }}
      />
      <IslandShape
        isOpen={isOpen}
        corner={corner}
        headLeft={headLeft}
        headWidth={size.head}
        openLeft={openLeft}
        openWidth={size.card}
        outset={0}
        className="text-panel"
      />

      <motion.span
        aria-hidden
        className={`pointer-events-none absolute left-[10px] top-[10px] block ${TONE_TEXT[tone]}`}
        initial={false}
        animate={{ x: isOpen ? iconLeft - 10 : 0 }}
        transition={SPRING}
      >
        <Icon className="size-[17px]" />
      </motion.span>

      {/* each set of words rides in a box running the same spring as the shape under it,
          so they are clipped to it at every frame instead of landing outside while it grows */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute top-0 block h-[38px] overflow-hidden"
        style={{ borderRadius: RADIUS }}
        initial={false}
        animate={{
          left: isOpen ? headLeft : 0,
          width: isOpen ? size.head : CIRCLE,
        }}
        transition={SPRING}
      >
        <span
          ref={nameRef}
          className={`absolute top-1/2 block -translate-y-1/2 whitespace-nowrap font-mono text-[12.5px] transition-opacity duration-200 ${TONE_TEXT[tone]} ${
            isOpen ? 'opacity-100 delay-[90ms]' : 'opacity-0'
          }`}
          style={{ left: iconAtRight ? NAME_RIGHT : NAME_LEFT }}
        >
          {field}
        </span>
      </motion.span>

      <motion.span
        aria-hidden
        className="pointer-events-none absolute block overflow-hidden"
        style={{
          top: BODY_TOP,
          borderRadius: RADIUS,
          ...(corner ? OPEN_CORNER[corner] : {}),
        }}
        initial={false}
        animate={{ left: body.left, width: body.width, height: body.height }}
        transition={SPRING}
      >
        <span
          ref={valueRef}
          className={`absolute flex items-center gap-2 whitespace-nowrap text-[15.5px] leading-[1.4] text-ink transition-opacity duration-200 ${
            isOpen ? 'opacity-100 delay-[90ms]' : 'opacity-0'
          }`}
          style={{ left: VALUE_PAD, top: 22 }}
        >
          <Mark className={`size-[15px] shrink-0 ${TONE_TEXT[tone]}`} />
          {text}
        </span>
      </motion.span>

      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={`${field}: ${text}`}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') onOpen()
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') onClose()
        }}
        onFocus={(event) => {
          // a tap focuses the button too; only a keyboard focus should open the card,
          // or the tap's own click would toggle it straight back shut
          if (event.target.matches(':focus-visible')) onOpen()
        }}
        onBlur={onClose}
        onClick={onToggle}
        className="absolute inset-0 rounded-full"
      />
    </li>
  )
}

export function ExplainDemo() {
  const [command, setCommand] = useState(EXAMPLES[0])
  // hover opens a card; focus and tap open the same one, so the fields are reachable without a pointer
  const [open, setOpen] = useState<number | null>(null)
  const { sentence, facts, attribution } = explain(command)
  const pack = attribution[0]?.pack
  const pills = pillsFor(facts)

  const close = (index: number) =>
    setOpen((current) => (current === index ? null : current))

  return (
    // one console: the two lines you would type, a rule, and what came back, sharing a
    // gutter of prompt marks the way a devtools scrollback does
    <div className="max-w-[820px] rounded-2xl border border-line bg-panel">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 rounded-t-2xl bg-white/[0.015] px-5 pb-4 pt-5 sm:px-7">
        <div className="min-w-0 font-mono text-[12.5px] leading-relaxed sm:text-[14px]">
          <div className="flex gap-3.5">
            <span aria-hidden className="select-none text-ink-3/60">
              &rsaquo;
            </span>
            <span className="text-ink-3">
              <span className="text-pink">import</span> {'{ explain }'}{' '}
              <span className="text-pink">from</span>{' '}
              <span className="text-ink-2">&apos;cmd-facts&apos;</span>
            </span>
          </div>

          <div className="mt-3 flex gap-3.5">
            <span aria-hidden className="select-none text-ink-3/60">
              &rsaquo;
            </span>
            <span className="flex items-center whitespace-nowrap">
              <span className="text-pink">explain</span>
              <span className="text-ink-2">(&quot;</span>
              {/* the visible text sizes the control; the native select sits invisibly on top of it */}
              <span className="relative inline-flex items-center border-b border-dashed border-line-2 py-0.5 pr-6 transition-colors hover:border-white/40 focus-within:border-white/65">
                {/* a phone has no room for the longest command; the picker still shows it whole */}
                <span className="block max-w-[48vw] overflow-hidden text-ellipsis whitespace-pre text-ink sm:max-w-none">
                  {command}
                </span>
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
            </span>
          </div>
        </div>

        {/* the five examples are a menu; the playground is where you bring your own */}
        <a
          href="/playground"
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line-2 px-3.5 py-1.5 font-mono text-[11.5px] text-ink-2 transition-colors hover:border-pink/50 hover:text-ink"
        >
          run your own
          <ArrowUpRight
            aria-hidden
            className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </a>
      </div>

      <div className="flex gap-3.5 border-t border-line px-5 pb-[50px] pt-6 sm:px-7">
        {/* what the line above returned */}
        <CornerDownRight
          aria-hidden
          className="mt-[14px] size-4 shrink-0 text-pink/70"
        />

        <div className="min-w-0 flex-1">
          <p className="text-[clamp(1.75rem,2.9vw,2.75rem)] leading-[1.18] tracking-[-0.025em] text-ink">
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
            {pills.map((pill, index) => (
              <IslandField
                key={pill.field}
                pill={pill}
                index={index}
                count={pills.length}
                isOpen={open === index}
                onOpen={() => setOpen(index)}
                onClose={() => close(index)}
                onToggle={() =>
                  setOpen((current) => (current === index ? null : index))
                }
              />
            ))}
          </ul>
        </div>

        {/* a console names the source of the line it printed; here that is the pack the
            facts came from */}
        {pack ? (
          <span className="hidden shrink-0 self-start pt-2 font-mono text-[11px] text-ink-3/70 sm:block">
            {pack}
          </span>
        ) : null}
      </div>
    </div>
  )
}
