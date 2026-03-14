declare module 'react-simple-maps' {
  import { ComponentType, ReactNode } from 'react'

  export interface Geography {
    rsmKey: string
    type: string
    geometry: {
      type: string
      coordinates: unknown
    }
    properties: {
      name: string
      [key: string]: unknown
    }
  }

  export interface GeographiesProps {
    geography: string | unknown
    children?: (props: { geographies: Geography[] }) => ReactNode
  }

  export interface GeographyProps {
    geography: Geography
    fill?: string
    stroke?: string
    strokeWidth?: number
    className?: string
    style?: React.CSSProperties
    onClick?: () => void
    onMouseEnter?: () => void
    onMouseLeave?: () => void
  }

  export interface MarkerProps {
    coordinates: [number, number]
    children?: ReactNode
  }

  export interface LineProps {
    from: [number, number]
    to: [number, number]
    stroke?: string
    strokeWidth?: number
    strokeLinecap?: string
    strokeDasharray?: string
    className?: string
    style?: React.CSSProperties
    onClick?: () => void
  }

  export interface ZoomableGroupProps {
    zoom: number
    center: [number, number]
    onMoveEnd?: (position: { coordinates: [number, number]; zoom: number }) => void
    minZoom?: number
    maxZoom?: number
    children?: ReactNode
  }

  export interface ComposableMapProps {
    projection?: string
    projectionConfig?: {
      scale?: number
      center?: [number, number]
    }
    className?: string
    children?: ReactNode
  }

  export function ComposableMap(props: ComposableMapProps): JSX.Element
  export function Geographies(props: GeographiesProps): JSX.Element
  export function Geography(props: GeographyProps): JSX.Element
  export function Marker(props: MarkerProps): JSX.Element
  export function Line(props: LineProps): JSX.Element
  export function ZoomableGroup(props: ZoomableGroupProps): JSX.Element
}
