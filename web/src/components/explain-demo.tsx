import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
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
import type { ArgSlot, Effect, Facts, Part } from 'cmd-facts'
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

/** How long one example is left up while the demo is playing itself, in seconds. */
const DWELL = 7

/** The words and the values they surround ride in on one movement, so they read as one line. */
const SLIDE = { type: 'tween', ease: [0.625, 0.05, 0, 1], duration: 0.5 } as const
const STAGGER = 0.022

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
  /** The schema keys this one reads, so opening it can point at them in the object beside it. */
  keys: readonly string[]
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
      keys: ['effect', 'effectAtLeast'],
      text: facts.opaque ? `at least ${effectText}` : effectText,
      tone: effectTone(effects),
    },
    {
      icon: RotateCcw,
      field: 'reversibility',
      keys: ['reversible'],
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
      keys: ['network'],
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
      keys: ['privilege'],
      ...(facts.privilege === 'none'
        ? { text: 'unprivileged', tone: 'good' as Tone }
        : facts.privilege === 'admin'
          ? { text: 'needs admin', tone: 'bad' as Tone }
          : { text: 'runs as root', tone: 'bad' as Tone }),
    },
    {
      icon: Fingerprint,
      field: 'credentials',
      keys: ['touchesCredentials'],
      ...(facts.touchesCredentials
        ? { text: 'touches credentials', tone: 'bad' as Tone }
        : { text: 'no credentials', tone: 'good' as Tone }),
    },
    {
      icon: Repeat,
      field: 'repeats',
      keys: ['repeatSafe'],
      ...(facts.repeatSafe
        ? { text: 'repeat-safe', tone: 'good' as Tone }
        : { text: 'not repeat-safe', tone: 'bad' as Tone }),
    },
    {
      icon: facts.opaque ? EyeOff : Eye,
      field: 'visibility',
      keys: ['opaque', 'handsOverTo'],
      ...(facts.opaque
        ? { text: 'hands over to something unseen', tone: 'bad' as Tone }
        : { text: 'nothing hidden', tone: 'good' as Tone }),
    },
    {
      icon: BadgeCheck,
      field: 'confidence',
      keys: ['confidence'],
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

/** Several values read as a list, the way the library joins them for `sentence`. */
const listed = (values: string[]) =>
  values.length <= 1
    ? (values[0] ?? '')
    : `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`

/**
 * One value off the command line, shown as a value rather than as prose: a file named
 * `approved by admin` has to be visibly the command's own text and not the row's words. What is
 * printed can be shorter than what was written — `show: 'host'` keeps the host and drops the rest —
 * so hovering it gives back the argument as it was typed, and the role it was read as.
 */
function Value({
  part,
  args,
  delay,
  spaceAfter,
}: {
  part: Extract<Part, { kind: 'values' }>
  args: ArgSlot[]
  delay: number
  spaceAfter: boolean
}) {
  // the parts carry the shortened text; the line's own arguments are where the whole of it still is
  const of = args.filter((arg) => arg.role === part.role)
  const written = of.length === part.values.length ? of.map((arg) => arg.value) : part.values
  const shortened = written.join(' ') !== part.values.join(' ')

  return (
    <span className={`group relative inline-flex ${spaceAfter ? 'pr-[0.26em]' : ''}`}>
      <span className="inline-flex overflow-hidden">
        <motion.span
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          transition={{ ...SLIDE, delay }}
          className="inline-block"
        >
          <button
            type="button"
            aria-label={`${part.role}: ${written.join(', ')}`}
            className="cursor-help rounded-[0.15em] bg-pink/[0.07] px-[0.14em] font-mono text-[0.78em] text-pink underline decoration-pink/30 decoration-dotted underline-offset-[0.3em] transition-colors group-hover:bg-pink/15 group-hover:decoration-pink"
          >
            {listed(part.values)}
          </button>
        </motion.span>
      </span>

      {/* the clip above would cut this off, so it hangs off the wrapper instead */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 block w-max max-w-[min(26rem,60vw)] rounded-lg border border-line-2 bg-panel-2 px-3 py-2 text-left opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {written.map((value) => (
          <span key={value} className="block break-all font-mono text-[12.5px] leading-snug text-ink">
            {value}
          </span>
        ))}
        <span className="mt-1.5 block font-mono text-[10.5px] tracking-[0.08em] text-ink-3 uppercase">
          {part.role}
          {part.flag ? ` · ${part.flag}` : ''}
          {shortened ? ' · as written' : ''}
        </span>
      </span>
    </span>
  )
}

/**
 * The sentence from `parts`, not from `sentence`: the row's words and the command's own text are
 * rendered apart, which is what the library asks a consumer to do wherever it has somewhere to put
 * the values. A row with no `tell` has one text part, and this is the line it always was.
 */
function Spoken({ parts, args }: { parts: Part[]; args: ArgSlot[] }) {
  // every word already spoken, so a value slides in on the beat its words would have had
  let spoken = 0

  return (
    <>
      {parts.map((part, index) => {
        const delay = spoken * STAGGER

        if (part.kind === 'text') {
          // the space that followed a value belongs to the value, so a line that wraps here
          // starts on the margin instead of a space in
          const text = parts[index - 1]?.kind === 'values' ? part.text.replace(/^ +/, '') : part.text
          spoken += text.split(' ').length
          return (
            <SlideUpText
              key={index}
              delay={delay}
              stagger={STAGGER}
              transition={SLIDE}
              className="font-light"
            >
              {text}
            </SlideUpText>
          )
        }

        spoken += 1
        const next = parts[index + 1]
        return (
          <Value
            key={index}
            part={part}
            args={args}
            delay={delay}
            spaceAfter={next?.kind === 'text' && next.text.startsWith(' ')}
          />
        )
      })}
    </>
  )
}

/**
 * The schema's own order, not the order a row happened to be written in: the object answers the
 * same questions in the same places for every command, the way the circles do.
 */
const FIELD_ORDER = [
  'opaque',
  'effect',
  'effectAtLeast',
  'handsOverTo',
  'reversible',
  'network',
  'privilege',
  'touchesCredentials',
  'repeatSafe',
  'confidence',
  'source',
  'says',
  'tell',
  'note',
  'docs',
] as const

/** Braces, quotes and commas are the furniture; only the values are meant to be read. */
const PUNCT = 'text-ink-3/60'

/** One printed line, hanging-indented so a wrapped sentence stays clear of its own key. */
function Line({ depth, children }: { depth: number; children: React.ReactNode }) {
  return (
    <div
      className="-mx-2 rounded pr-2"
      style={{ paddingLeft: `calc(0.5rem + ${depth * 1.6 + 1.6}ch)`, textIndent: '-1.6ch' }}
    >
      {children}
    </div>
  )
}

function JsonValue({ value }: { value: unknown }) {
  if (typeof value === 'string')
    return (
      <span className={PUNCT}>
        &apos;<span className="text-ink">{value}</span>&apos;
      </span>
    )

  if (typeof value === 'boolean') return <span className="text-pink">{String(value)}</span>

  if (Array.isArray(value))
    // a list of plain values reads at a glance; one with a slot in it is folded, because a
    // sentence cut into pieces costs four lines to say what the line beside it already says
    return value.some((item) => item && typeof item === 'object') ? (
      <FoldedArray key={JSON.stringify(value)} value={value} />
    ) : (
      <span className={PUNCT}>
        [
        {value.map((item, index) => (
          <span key={index}>
            {index > 0 ? ', ' : ''}
            <JsonValue value={item} />
          </span>
        ))}
        ]
      </span>
    )

  // a slot stays on one line: it is a value in a sentence, not a block of its own
  if (value && typeof value === 'object')
    return (
      <span className={PUNCT}>
        {'{ '}
        {Object.entries(value).map(([key, inner], index) => (
          <span key={key}>
            {index > 0 ? ', ' : ''}
            <span className="text-ink-2">{key}</span>: <JsonValue value={inner} />
          </span>
        ))}
        {' }'}
      </span>
    )

  return <span className="text-ink-2">{String(value)}</span>
}

/** Folded, it is the one word `[…]`; open, it is the list, and clicking it anywhere folds it back. */
function FoldedArray({ value }: { value: unknown[] }) {
  const [open, setOpen] = useState(false)

  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={open ? 'fold this list' : `unfold this list of ${value.length}`}
      onClick={() => setOpen((current) => !current)}
      className={`inline cursor-pointer text-left transition-colors hover:text-ink-2 ${PUNCT}`}
    >
      [
      {open
        ? value.map((item, index) => (
            <span key={index}>
              {index > 0 ? ', ' : ''}
              <JsonValue value={item} />
            </span>
          ))
        : '\u2026'}
      ]
    </button>
  )
}

function Field({
  name,
  value,
  depth,
  lit,
  comma,
}: {
  name: string
  value: unknown
  depth: number
  lit: boolean
  comma: boolean
}) {
  return (
    <div
      className={`-mx-2 rounded pr-2 transition-colors duration-200 ${lit ? 'bg-white/[0.05]' : ''}`}
      style={{ paddingLeft: `calc(0.5rem + ${depth * 1.6 + 1.6}ch)`, textIndent: '-1.6ch' }}
    >
      <span className={`transition-colors duration-200 ${lit ? 'text-pink' : 'text-ink-2'}`}>
        {name}
      </span>
      <span className={PUNCT}>: </span>
      <JsonValue value={value} />
      {comma ? <span className={PUNCT}>,</span> : null}
    </div>
  )
}

/**
 * What `explain()` actually handed back. The line beside this is `sentence`, and `sentence` is
 * `says` with this command's own arguments in it wherever the row carries a `tell` — so the two
 * are shown together, with the fields underneath them that a consumer really builds on.
 * Opening a circle lights the keys it was read from: the halves are one object.
 */
function ReturnedObject({
  sentence,
  facts,
  highlight,
}: {
  sentence: string
  facts: Facts
  highlight: readonly string[]
}) {
  // a row that carries no `tell` or `note` has the key with nothing under it; an absent field is
  // absent from the object too, rather than printing as `undefined`
  const rows = FIELD_ORDER.filter(
    (key) => key in facts && (facts as unknown as Record<string, unknown>)[key] !== undefined,
  ).map((key) => [key, (facts as unknown as Record<string, unknown>)[key]] as const)

  return (
    <div className="font-mono text-[11.5px] leading-[1.75] sm:text-[12px]">
      <span className={PUNCT}>{'{'}</span>

      <Field name="sentence" value={sentence} depth={0} lit={false} comma />

      <Line depth={0}>
        <span className="text-ink-2">facts</span>
        <span className={PUNCT}>: {'{'}</span>
      </Line>
      {rows.map(([key, value], index) => (
        <Field
          key={key}
          name={key}
          value={value}
          depth={1}
          lit={highlight.includes(key)}
          comma={index < rows.length - 1}
        />
      ))}
      <Line depth={0}>
        <span className={PUNCT}>{'},'}</span>
      </Line>

      {/* the rest of the explanation is real and is not hidden, only not printed here */}
      <Line depth={0}>
        <span className="text-ink-3/50">// parts, args, program, escalated, attribution</span>
      </Line>

      <span className={PUNCT}>{'}'}</span>
    </div>
  )
}

export function ExplainDemo() {
  const [command, setCommand] = useState(EXAMPLES[0])
  // the demo plays itself until someone takes the dropdown; after that it stays where it was put
  const [picked, setPicked] = useState(false)
  const reduced = useReducedMotion()
  const playing = !picked && !reduced
  // hover opens a card; focus and tap open the same one, so the fields are reachable without a pointer
  const [open, setOpen] = useState<number | null>(null)
  const { sentence, parts, args, facts, attribution } = explain(command)
  const pack = attribution[0]?.pack
  const pills = pillsFor(facts)

  const close = (index: number) =>
    setOpen((current) => (current === index ? null : current))

  return (
    // one console: the two lines you would type, a rule, and what came back, sharing a
    // gutter of prompt marks the way a devtools scrollback does
    <div className="rounded-2xl border border-line bg-panel">
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
                {/* the dashed rule under the command is also the clock: it fills left to right,
                    and the example changes where it runs out */}
                {playing ? (
                  <motion.span
                    key={command}
                    aria-hidden
                    className="absolute inset-x-0 -bottom-px block h-px origin-left bg-pink"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: DWELL, ease: 'linear' }}
                    onAnimationComplete={() =>
                      setCommand(
                        (current) => EXAMPLES[(EXAMPLES.indexOf(current) + 1) % EXAMPLES.length],
                      )
                    }
                  />
                ) : null}
                <select
                  aria-label="Command to explain"
                  value={command}
                  onChange={(event) => {
                    setPicked(true)
                    setCommand(event.target.value)
                  }}
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

      <div className="border-t border-line lg:flex lg:items-stretch">
        <div className="flex min-w-0 flex-1 gap-3.5 px-5 pb-[50px] pt-6 sm:px-7">
          {/* what the line above returned */}
          <CornerDownRight
            aria-hidden
            className="mt-[14px] size-4 shrink-0 text-pink/70"
          />

          <div className="min-w-0 flex-1">
            <p className="flex max-w-[640px] flex-wrap items-baseline text-[clamp(1.75rem,2.9vw,2.75rem)] leading-[1.18] tracking-[-0.025em] text-ink">
              {/* the key replays the slide on every new sentence; the stagger is per word, so a
                  long sentence needs a short one or the last word arrives seconds after the first */}
              <Spoken key={sentence} parts={parts} args={args} />
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

        </div>

        {/* the same answer unrendered: the sentence and the fields it was written from */}
        <aside className="border-t border-line px-5 pb-8 pt-6 sm:px-7 lg:w-[380px] lg:shrink-0 lg:border-l lg:border-t-0 lg:pb-[50px] xl:w-[420px]">
          {/* a console names the source of what it printed; here that is the pack the facts came from */}
          <div className="mb-4 flex items-baseline justify-between gap-4 font-mono text-[11px] text-ink-3/70">
            <span>the object it returned</span>
            {pack ? <span className="shrink-0">{pack}</span> : null}
          </div>

          <ReturnedObject
            sentence={sentence}
            facts={facts}
            highlight={open === null ? [] : pills[open].keys}
          />
        </aside>
      </div>
    </div>
  )
}
