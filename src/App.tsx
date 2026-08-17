const projectSlots = [
  {
    number: '01',
    title: 'Visual experiments',
    description: 'Interactive sketches and simulations will live here.',
  },
  {
    number: '02',
    title: 'Small tools',
    description: 'Useful browser-sized ideas, built to be shared.',
  },
  {
    number: '03',
    title: 'Works in progress',
    description: 'A place for unfinished thoughts worth keeping around.',
  },
]

export function App() {
  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="Web Gallery home">
          SH<span aria-hidden="true">↗</span>
        </a>
        <p>Web Gallery</p>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Samuel Hertzberg · Experiments for the browser</p>
        <h1 id="page-title">
          A clean space for
          <span> curious things.</span>
        </h1>
        <p className="intro">
          The new gallery foundation is ready. Projects will return one at a
          time as they are revisited, refined, and made worth sharing again.
        </p>
      </section>

      <section className="project-grid" aria-label="Gallery sections">
        {projectSlots.map((project) => (
          <article className="project-card" key={project.number}>
            <div className="card-meta">
              <span>{project.number}</span>
              <span>Coming soon</span>
            </div>
            <div>
              <h2>{project.title}</h2>
              <p>{project.description}</p>
            </div>
          </article>
        ))}
      </section>

      <footer>
        <p>Built quietly. Released when ready.</p>
        <p>{new Date().getFullYear()}</p>
      </footer>
    </main>
  )
}
