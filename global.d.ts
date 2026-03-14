// Global type declarations for CSS imports
declare module "*.css" {
  const content: { [className: string]: string }
  export default content
}

declare module "*.scss" {
  const content: { [className: string]: string }
  export default content
}

declare module "*.sass" {
  const content: { [className: string]: string }
  export default content
}

declare module "*.less" {
  const content: { [className: string]: string }
  export default content
}

// Declare side-effect CSS imports (for mapbox-gl, etc.)
declare module "mapbox-gl/dist/mapbox-gl.css"
