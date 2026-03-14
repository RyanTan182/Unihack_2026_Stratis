export interface DemoComponent {
  id: string
  name: string
  country: string
  supplier: string
  risk: number // 0-100 risk score
  coordinates: [number, number] // [longitude, latitude]
}

export interface DemoRoute {
  id: string
  origin: string
  destination: string
  via?: string[]
  risk: number // 0-100 risk score
  riskSegments?: { from: string; to: string; risk: number }[]
}

export interface DemoProduct {
  id: string
  name: string
  destinationCountry: string
  destinationCoordinates: [number, number]
  components: DemoComponent[]
  routes: DemoRoute[]
}

export const DEMO_PRODUCT: DemoProduct = {
  id: 'iphone-16-pro',
  name: 'iPhone 16 Pro',
  destinationCountry: 'United States',
  destinationCoordinates: [-98.0, 38.0],
  components: [
    {
      id: 'a18-chip',
      name: 'A18 Chip',
      country: 'Taiwan',
      supplier: 'TSMC',
      risk: 35,
      coordinates: [121.0, 23.5],
    },
    {
      id: 'display',
      name: 'Display',
      country: 'South Korea',
      supplier: 'Samsung',
      risk: 25,
      coordinates: [127.5, 36.0],
    },
    {
      id: 'camera-module',
      name: 'Camera Module',
      country: 'Japan',
      supplier: 'Sony',
      risk: 20,
      coordinates: [139.0, 35.5],
    },
    {
      id: 'battery',
      name: 'Battery',
      country: 'China',
      supplier: 'CATL',
      risk: 55,
      coordinates: [116.0, 35.0],
    },
  ],
  routes: [
    {
      id: 'route-taiwan-us-hormuz',
      origin: 'Taiwan',
      destination: 'United States',
      via: ['Strait of Hormuz'],
      risk: 75,
      riskSegments: [
        { from: 'Taiwan', to: 'Strait of Hormuz', risk: 45 },
        { from: 'Strait of Hormuz', to: 'United States', risk: 85 },
      ],
    },
    {
      id: 'route-taiwan-us-malacca',
      origin: 'Taiwan',
      destination: 'United States',
      via: ['Strait of Malacca'],
      risk: 45,
      riskSegments: [
        { from: 'Taiwan', to: 'Strait of Malacca', risk: 30 },
        { from: 'Strait of Malacca', to: 'United States', risk: 50 },
      ],
    },
    {
      id: 'route-taiwan-us-pacific',
      origin: 'Taiwan',
      destination: 'United States',
      risk: 30,
    },
    {
      id: 'route-korea-us-hormuz',
      origin: 'South Korea',
      destination: 'United States',
      via: ['Strait of Hormuz'],
      risk: 75,
      riskSegments: [
        { from: 'South Korea', to: 'Strait of Hormuz', risk: 50 },
        { from: 'Strait of Hormuz', to: 'United States', risk: 85 },
      ],
    },
    {
      id: 'route-korea-us-malacca',
      origin: 'South Korea',
      destination: 'United States',
      via: ['Strait of Malacca'],
      risk: 45,
      riskSegments: [
        { from: 'South Korea', to: 'Strait of Malacca', risk: 35 },
        { from: 'Strait of Malacca', to: 'United States', risk: 50 },
      ],
    },
    {
      id: 'route-korea-us-pacific',
      origin: 'South Korea',
      destination: 'United States',
      risk: 30,
    },
    {
      id: 'route-japan-us-hormuz',
      origin: 'Japan',
      destination: 'United States',
      via: ['Strait of Hormuz'],
      risk: 75,
      riskSegments: [
        { from: 'Japan', to: 'Strait of Hormuz', risk: 55 },
        { from: 'Strait of Hormuz', to: 'United States', risk: 85 },
      ],
    },
    {
      id: 'route-japan-us-malacca',
      origin: 'Japan',
      destination: 'United States',
      via: ['Strait of Malacca'],
      risk: 45,
      riskSegments: [
        { from: 'Japan', to: 'Strait of Malacca', risk: 40 },
        { from: 'Strait of Malacca', to: 'United States', risk: 50 },
      ],
    },
    {
      id: 'route-japan-us-pacific',
      origin: 'Japan',
      destination: 'United States',
      risk: 30,
    },
    {
      id: 'route-china-us-hormuz',
      origin: 'China',
      destination: 'United States',
      via: ['Strait of Hormuz'],
      risk: 75,
      riskSegments: [
        { from: 'China', to: 'Strait of Hormuz', risk: 40 },
        { from: 'Strait of Hormuz', to: 'United States', risk: 85 },
      ],
    },
    {
      id: 'route-china-us-malacca',
      origin: 'China',
      destination: 'United States',
      via: ['Strait of Malacca'],
      risk: 45,
      riskSegments: [
        { from: 'China', to: 'Strait of Malacca', risk: 25 },
        { from: 'Strait of Malacca', to: 'United States', risk: 50 },
      ],
    },
    {
      id: 'route-china-us-pacific',
      origin: 'China',
      destination: 'United States',
      risk: 30,
    },
  ],
}

// Coordinate reference for straits
export const STRAIT_COORDINATES: Record<string, [number, number]> = {
  'Strait of Hormuz': [56.5, 26.5],
  'Strait of Malacca': [101.0, 2.0],
}
