import { useEffect, useState } from 'react'
import Chart from './Chart.jsx'
import { SERIES } from './data/sample.js'
import { readParam, writeParam } from './urlState.js'

const DEFAULT = SERIES[0].id

export default function App() {
  const [selected, setSelected] = useState(DEFAULT)

  // Apply URL state after mount, and validate it against the data. Seeding
  // useState from the URL breaks the prerender (no window there).
  useEffect(() => {
    const fromUrl = readParam('series')
    if (fromUrl && SERIES.some((s) => s.id === fromUrl)) setSelected(fromUrl)
  }, [])

  const select = (id) => {
    setSelected(id)
    writeParam('series', id === DEFAULT ? null : id)
    // Structured events make "which one did they look at" a one-click report.
    // Optional-chained: the embed is third-party and blockable.
    window.dhAnalytics?.track('Series selected', { id })
  }

  const series = SERIES.find((s) => s.id === selected)

  return (
    <main>
      {/* One h1 that names the subject. The eyebrow and title render as two
          lines but read as a single heading to crawlers. */}
      <h1 className="head">
        <span className="eyebrow">A dataviz project</span>
        <span className="title">Twelve months of something</span>
      </h1>
      <p className="intro">
        This is the sample page from the template. Three series, one chart, a picker that writes the
        selection into the URL so a link lands on the same view. Replace the data in{' '}
        <code>src/data/sample.js</code> and this copy in <code>src/App.jsx</code>.
      </p>

      <div className="controls" role="group" aria-label="Series">
        {SERIES.map((s) => (
          <button key={s.id} type="button" aria-pressed={s.id === selected} onClick={() => select(s.id)}>
            {s.label}
          </button>
        ))}
      </div>

      <section className="card">
        <Chart series={series} />
      </section>

      <p className="note">
        The address bar updates when you pick a series. Reloading that URL restores the view.
      </p>
    </main>
  )
}
