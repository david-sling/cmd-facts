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
export function HeroGlass() {
  const host = useRef<HTMLDivElement>(null)
  const [surface, setSurface] = useState<HTMLCanvasElement | null>(null)

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
      ratio = Math.min(window.devicePixelRatio || 1, 2)
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
    <div ref={host} className="pointer-events-none absolute inset-0">
      {surface && (
        <FluidGlass
          text=""
          src={surface}
          fit="cover"
          shape="torus"
          shapes={['torus']}
          interaction="follow"
          size={220}
          background="transparent"
          morphOnClick={false}
        />
      )}
    </div>
  )
}
