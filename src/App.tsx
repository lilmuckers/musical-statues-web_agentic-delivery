import { useMemo, useState } from 'react'
import { getNextPhase, getPreviousPhase, phaseDefinitions, phaseOrder } from './appShell'
import type { AppPhase } from './types'

const readinessChecks = [
  'Host authenticated with Spotify (placeholder)',
  'Browser playback device prepared (placeholder)',
  'Playlist selected and validated (placeholder)',
]

const futureSlices = [
  'Spotify OAuth and session lifecycle',
  'Playback device readiness and browser constraints',
  'Gameplay state machine and round controls',
  'Reactive visualisation and freeze transition',
]

export function App() {
  const [phase, setPhase] = useState<AppPhase>('setup')

  const definition = phaseDefinitions[phase]
  const nextPhase = useMemo(() => getNextPhase(phase), [phase])
  const previousPhase = useMemo(() => getPreviousPhase(phase), [phase])

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <p className="eyebrow">Musical Statues Web</p>
        <h1>Host control baseline</h1>
        <p className="lede">
          A production-shaped shell for the facilitator flow, ready for Spotify integration and
          gameplay wiring in the next delivery slices.
        </p>

        <div className="panel">
          <h2>Round phases</h2>
          <ol className="phase-list">
            {phaseOrder.map((phaseId) => {
              const item = phaseDefinitions[phaseId]
              const isActive = phaseId === phase

              return (
                <li key={phaseId} className={isActive ? 'is-active' : undefined}>
                  <button type="button" onClick={() => setPhase(phaseId)}>
                    <span>{item.label}</span>
                    <small>{item.heading}</small>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>

        <div className="panel">
          <h2>Readiness scaffold</h2>
          <ul>
            {readinessChecks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="stage" style={{ '--phase-accent': definition.accent } as React.CSSProperties}>
        <section className="hero-card" aria-labelledby="phase-heading">
          <p className="status-pill">Current phase: {definition.label}</p>
          <h2 id="phase-heading">{definition.heading}</h2>
          <p>{definition.summary}</p>

          <div className="hero-card__actions">
            <button type="button" onClick={() => previousPhase && setPhase(previousPhase)} disabled={!previousPhase}>
              Previous state
            </button>
            <button type="button" className="primary" onClick={() => nextPhase && setPhase(nextPhase)} disabled={!nextPhase}>
              {definition.nextActionLabel ?? 'Session complete'}
            </button>
          </div>
        </section>

        <section className="panel panel--grid" aria-label="Delivery baseline details">
          <article>
            <h3>What exists now</h3>
            <p>
              The shell provides a deterministic state scaffold, placeholder facilitator messaging,
              and a clear freeze boundary so later Spotify and visual layers can integrate without
              rewriting the app frame.
            </p>
          </article>
          <article>
            <h3>Next integration slices</h3>
            <ul>
              {futureSlices.map((slice) => (
                <li key={slice}>{slice}</li>
              ))}
            </ul>
          </article>
          <article>
            <h3>Delivery posture</h3>
            <p>
              Tooling includes Vite, TypeScript, ESLint, Vitest, and GitHub Actions so the app can
              grow under the same build/test/lint path locally and in CI.
            </p>
          </article>
        </section>
      </main>
    </div>
  )
}
