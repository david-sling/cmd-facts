import type { CSSProperties, ReactNode } from 'react'

/** What this project passes to the ReactBits component; the component itself takes more. */
export type FluidGlassProps = {
  text?: string
  textColor?: string
  fontFamily?: string
  fontWeight?: number
  fontSize?: number
  /** A URL, or a canvas this project keeps redrawing — see the LOCAL notes in FluidGlass.jsx. */
  src?: string | HTMLCanvasElement
  fit?: 'cover' | 'contain'
  background?: string
  shape?: 'lens' | 'blob' | 'cube' | 'pill' | 'torus' | 'prism' | 'diamond'
  shapes?: readonly FluidGlassProps['shape'][]
  size?: number
  refraction?: number
  dispersion?: number
  reflection?: number
  frost?: number
  color?: string
  tint?: number
  shadow?: number
  elevation?: number
  interaction?: 'follow' | 'drag' | 'static'
  smoothness?: number
  wobble?: number
  spin?: number
  idle?: boolean
  morphOnClick?: boolean
  onShapeChange?: (shape: string) => void
  position?: [number, number]
  intro?: boolean
  maxDevicePixelRatio?: number
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

declare const FluidGlass: (props: FluidGlassProps) => JSX.Element
export default FluidGlass
