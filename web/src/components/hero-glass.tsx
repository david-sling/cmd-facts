import { useEffect, useRef, useState } from 'react'
import { domToCanvas } from 'modern-screenshot'
import FluidGlass from '#/components/FluidGlass'

/**
 * The hero, handed to the glass.
 *
 * FluidGlass refracts what it is given and nothing else, so everything meant to bend has to reach
 * it as one picture: this keeps a canvas with the gradient painted fresh each frame and the hero's
 * own words — the real elements, taken as they are laid out — printed over it. The words then go
 * to `opacity: 0` in the page, where they stay selectable, clickable and readable aloud while the
 * glass draws what you see. Anything marked `data-no-glass`, the install card, is left out of the
 * picture and goes on living as itself above the canvas.
 */
type Lens = 'torus' | 'blob' | 'pill'

/** What each shape is worth across the lens, in page pixels. */
const SIZE: Record<Lens, number> = { torus: 380, blob: 400, pill: 200 }

/** Where the lens waits when the pointer is elsewhere, as a fraction of the hero. */
const REST: [number, number] = [0.82, 0.5]

export function HeroGlass() {
  const host = useRef<HTMLDivElement>(null)
  const [surface, setSurface] = useState<HTMLCanvasElement | null>(null)
  const [lens, setLens] = useState<Lens>('torus')
  const [size, setSize] = useState(SIZE.torus)
  const sized = useRef(SIZE.torus)

  // the shape morphs on its own clock; the size would otherwise snap, so it is eased to meet it
  useEffect(() => {
    const want = SIZE[lens]
    let frame = 0
    const close = () => {
      sized.current += (want - sized.current) * 0.14
      if (Math.abs(want - sized.current) < 0.5) sized.current = want
      setSize(sized.current)
      if (sized.current !== want) frame = requestAnimationFrame(close)
    }
    frame = requestAnimationFrame(close)
    return () => cancelAnimationFrame(frame)
  }, [lens])

  // what the pointer is over decides the shape: the words say so themselves
  useEffect(() => {
    const hero = host.current?.parentElement
    if (!hero) return
    let waiting = 0

    const read = (event: PointerEvent) => {
      const over = (event.target as Element | null)?.closest?.('[data-lens]')
      const name = over instanceof HTMLElement ? over.dataset.lens : undefined
      window.clearTimeout(waiting)
      if (name === 'blob' || name === 'pill') {
        setLens(name)
        return
      }
      // crossing the gap between the title and the words under it is not a visit to the gap, so
      // the shape in between is only taken up by someone who stays there
      waiting = window.setTimeout(() => setLens('torus'), 180)
    }

    const away = () => {
      window.clearTimeout(waiting)
      setLens('torus')
    }

    hero.addEventListener('pointermove', read)
    hero.addEventListener('pointerleave', away)
    return () => {
      window.clearTimeout(waiting)
      hero.removeEventListener('pointermove', read)
      hero.removeEventListener('pointerleave', away)
    }
  }, [])

  useEffect(() => {
    const hero = host.current?.parentElement
    const words = hero?.querySelector<HTMLElement>('[data-glass-text]')
    if (!hero || !words) return
    // the gradient's own canvas; mine is inside `host` and is not a thing to refract
    const waves = Array.from(hero.querySelectorAll('canvas')).find(
      (one) => !host.current?.contains(one),
    )
    if (!waves) return

    const sheet = document.createElement('canvas')
    const ink = sheet.getContext('2d')
    if (!ink) return
    ink.imageSmoothingQuality = 'high'

    let printed: HTMLCanvasElement | null = null
    let ratio = 1
    let frame = 0
    let timer = 0
    let gone = false

    const paint = () => {
      if (gone) return
      ink.clearRect(0, 0, sheet.width, sheet.height)
      ink.drawImage(waves, 0, 0, sheet.width, sheet.height)
      if (printed) ink.drawImage(printed, 0, 0, sheet.width, sheet.height)
      frame = requestAnimationFrame(paint)
    }

    const print = async () => {
      const box = hero.getBoundingClientRect()
      if (box.width < 1 || box.height < 1) return
      // text that is photographed rather than typed needs the pixels: at the page's own scale its
      // edges come back thin, so the sheet is kept at twice the page even on a screen that is not
      ratio = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3)
      sheet.width = Math.round(box.width * ratio)
      sheet.height = Math.round(box.height * ratio)

      // the words have to be in the page to be photographed, so they go back before each shot
      delete hero.dataset.glass
      await new Promise(requestAnimationFrame)
      if (gone) return

      printed = await domToCanvas(words, {
        width: box.width,
        height: box.height,
        scale: ratio,
        backgroundColor: null,
        // hidden rather than dropped: a card taken out of the copy takes its own box with it, and
        // everything laid out beside it slides over to fill the gap
        onCloneEachNode: (node) => {
          if (node instanceof HTMLElement && node.hasAttribute('data-no-glass')) {
            node.style.visibility = 'hidden'
          }
        },
      })
      if (gone) return
      hero.dataset.glass = 'on'
      setSurface(sheet)
    }

    const again = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(print, 180)
    }

    void print()
    paint()
    const watcher = new ResizeObserver(again)
    watcher.observe(hero)

    return () => {
      gone = true
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
      watcher.disconnect()
      delete hero.dataset.glass
    }
  }, [])

  return (
    // the component's own stylesheet owns `.fluid-glass`, position included, so the box it fills
    // is one this file puts around it; it reads the pointer off the window, not off itself, so
    // taking it out of the way of the hero's own links costs it nothing
    <div ref={host} data-lens-now={lens} className="pointer-events-none absolute inset-0">
      {surface && (
        <FluidGlass
          text=""
          src={surface}
          fit="fill"
          shape={lens}
          interaction="follow"
          size={size}
          position={REST}
          background="transparent"
          shadow={0}
          morphOnClick={false}
        />
      )}
    </div>
  )
}
