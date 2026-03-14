"use client"

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { CountryComparisonData } from "@/lib/relocation-types"

interface ComparisonChartProps {
  countries: CountryComparisonData[]
  className?: string
}

const COLORS = [
  "oklch(0.72 0.14 195)",  // cyan
  "oklch(0.65 0.18 145)",  // emerald
  "oklch(0.75 0.18 60)",   // amber
  "oklch(0.70 0.18 280)",  // violet
  "oklch(0.70 0.20 330)",  // pink
]

const FILL_COLORS = [
  "oklch(0.72 0.14 195 / 0.2)",
  "oklch(0.65 0.18 145 / 0.2)",
  "oklch(0.75 0.18 60 / 0.2)",
  "oklch(0.70 0.18 280 / 0.2)",
  "oklch(0.70 0.20 330 / 0.2)",
]

const AXIS_LABELS: Record<string, string> = {
  overall: "Overall Score",
  geopolitical: "Geopolitical Safety",
  export: "Export Stability",
  infrastructure: "Infrastructure Quality",
  cost: "Cost Efficiency",
}

export function ComparisonChart({ countries, className }: ComparisonChartProps) {
  // Transform data for radar chart
  const chartData = Object.keys(AXIS_LABELS).map((key) => {
    const dataPoint: Record<string, number | string> = {
      metric: AXIS_LABELS[key],
    }
    countries.forEach((country) => {
      dataPoint[country.name] = country.scores[key as keyof typeof country.scores]
    })
    return dataPoint
  })

  return (
    <Card className={cn("border-primary/20 glass-panel shadow-xl floating-panel", className)}>
      <CardHeader className="pb-3 border-b border-border/50">
        <CardTitle className="flex items-center gap-2 text-base">
          Country Comparison
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Multi-dimensional analysis across {countries.length} countries
        </p>
      </CardHeader>
      <CardContent className="p-4">
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={chartData}>
            <PolarGrid
              strokeDasharray="3 3"
              stroke="oklch(0.30 0.020 260)"
              strokeOpacity={0.5}
            />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fill: "oklch(0.70 0.010 250)", fontSize: 10, fontWeight: 500 }}
              tickLine={false}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{ fill: "oklch(0.50 0.015 250)", fontSize: 9 }}
              tickCount={5}
              axisLine={{ stroke: "oklch(0.25 0.018 260)" }}
            />
            {countries.map((country, index) => (
              <Radar
                key={country.countryId}
                name={country.name}
                dataKey={country.name}
                stroke={COLORS[index % COLORS.length]}
                fill={FILL_COLORS[index % FILL_COLORS.length]}
                fillOpacity={0.4}
                strokeWidth={2.5}
                strokeDasharray={index === 0 ? "" : index === 1 ? "5 3" : "2 2"}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 justify-center pt-4 border-t border-border/30">
          {countries.map((country, index) => (
            <div
              key={country.countryId}
              className="flex items-center gap-2 px-2 py-1 rounded-lg bg-muted/20"
            >
              <span
                className="w-3 h-3 rounded-full ring-2 ring-offset-1 ring-offset-background"
                style={{
                  backgroundColor: COLORS[index % COLORS.length],
                  boxShadow: `0 0 8px ${COLORS[index % COLORS.length]}`
                }}
              />
              <span className="text-sm font-medium text-foreground">
                {country.flag} {country.name}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
