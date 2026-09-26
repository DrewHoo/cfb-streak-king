import { useRef, useState } from 'react'
import { scaleLinear, scalePoint } from 'd3-scale'
import { max } from 'd3-array'
import { line } from 'd3-shape'
import { MONTHS } from './data/sample.js'

// One hand-rolled SVG line chart: D3 for scales and the path generator, React
// for the DOM. The chart scales with its container via viewBox, and the hover
// is pointer-based so a finger scrub works on a phone.
const W = 720
const H = 320
const M = { top: 16, right: 16, bottom: 32, left: 40 }

export default function Chart({ series }) {
  const svgRef = useRef(null)
  const [hover, setHover] = useState(null)

  const x = scalePoint().domain(MONTHS).range([M.left, W - M.right])
  const y = scaleLinear().domain([0, max(series.values) * 1.1]).nice().range([H - M.bottom, M.top])
  const path = line()
    .x((_, i) => x(MONTHS[i]))
    .y((v) => y(v))(series.values)

  // Map pointer x back to the nearest month. Pointer events cover mouse, pen,
  // and touch; onMouseMove would do nothing on a phone.
  const onPointer = (e) => {
    const rect = svgRef.current.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    let best = 0
    for (let i = 1; i < MONTHS.length; i++) if (Math.abs(x(MONTHS[i]) - px) < Math.abs(x(MONTHS[best]) - px)) best = i
    setHover(best)
  }

  return (
    <figure className="chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${series.label} by month`}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setHover(null)}
      >
        {y.ticks(5).map((t) => (
          <g key={t} transform={`translate(0,${y(t)})`}>
            <line x1={M.left} x2={W - M.right} className="grid" />
            <text x={M.left - 8} dy="0.32em" textAnchor="end" className="tick">
              {t}
            </text>
          </g>
        ))}
        {MONTHS.map((m) => (
          <text key={m} x={x(m)} y={H - 10} textAnchor="middle" className="tick">
            {m}
          </text>
        ))}
        <path d={path} className="series" />
        {hover != null && (
          <g transform={`translate(${x(MONTHS[hover])},0)`}>
            <line y1={M.top} y2={H - M.bottom} className="cursor" />
            <circle cy={y(series.values[hover])} r="5" className="dot" />
          </g>
        )}
      </svg>
      <figcaption>
        {hover != null
          ? `${MONTHS[hover]}: ${series.values[hover]} ${series.label.toLowerCase()}`
          : 'Hover or touch the chart for values.'}
      </figcaption>
    </figure>
  )
}
