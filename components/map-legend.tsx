"use client"

interface LegendProduct {
  id: string
  name: string
  color: string
}

interface MapLegendProps {
  products: LegendProduct[]
}

export function MapLegend({ products }: MapLegendProps) {
  return (
    <div className="absolute bottom-4 left-4 z-10 rounded-xl border border-border/50 bg-card/60 p-3 shadow-2xl backdrop-blur-xl max-w-[220px] max-h-[calc(100%-2rem)] flex flex-col">
      <p className="mb-2 text-[10px] font-semibold text-foreground shrink-0">Map Legend</p>

      {/* Risk Levels */}
      <div className="mb-2 shrink-0">
        <p className="mb-1.5 text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Risk Level</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {[
            { color: "#dc2626", label: "Critical" },
            { color: "#ea580c", label: "High" },
            { color: "#eab308", label: "Medium" },
            { color: "#22c55e", label: "Low" },
            { color: "#06b6d4", label: "Minimal" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-[9px] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Products */}
      {products.length > 0 && (
        <div className="mb-2 border-t border-border/30 pt-2 min-h-0 flex flex-col">
          <p className="mb-1.5 text-[9px] font-medium text-muted-foreground uppercase tracking-wider shrink-0">Products</p>
          <div className="space-y-0.5 overflow-y-auto">
            {products.map((product) => (
              <div key={product.id} className="flex items-center gap-1.5">
                <div className="h-1.5 w-3 rounded-full" style={{ backgroundColor: product.color }} />
                <span className="max-w-[140px] truncate text-[9px] text-muted-foreground">
                  {product.name || "Unnamed"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Route Status */}
      <div className="border-t border-border/30 pt-2 shrink-0">
        <p className="mb-1.5 text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Route Status</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <div className="flex items-center gap-1">
            <div className="h-0.5 w-3 rounded-full bg-red-500" />
            <span className="text-[9px] text-red-400">Dangerous</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-0.5 w-3 rounded-full bg-muted-foreground/50" />
            <span className="text-[9px] text-muted-foreground">Safe</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-sm bg-violet-500" />
            <span className="text-[9px] text-muted-foreground">Chokepoint</span>
          </div>
        </div>
      </div>
    </div>
  )
}
