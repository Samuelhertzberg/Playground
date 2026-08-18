import { useEffect, useRef, useState, type MouseEvent } from 'react'
import {
  galleryProjects,
  type ArtworkVariant,
  type GalleryProject,
  type ProjectId,
} from './projects'

interface GalleryProps {
  onNavigate: (destination: string) => void
}

interface ProjectPlaceholderProps {
  project: GalleryProject
  onNavigate: (destination: string) => void
}

const INTRO_ART = String.raw`       .  +  .
   +-----------+
   | % # @ & * |
   | ? F U N ! |
   | GARBAGE?? |
   | * & @ # % |
   +-----------+
       .  +  .`

function Artwork({ variant }: { variant: ArtworkVariant }) {
  if (variant === 'intro') {
    return (
      <pre className="gallery-artwork-ascii" aria-hidden="true">
        {INTRO_ART}
      </pre>
    )
  }

  if (variant === 'orbit') {
    return (
      <svg
        className="gallery-artwork-svg"
        viewBox="0 0 500 500"
        aria-hidden="true"
      >
        <circle className="art-stroke art-faint" cx="250" cy="250" r="186" />
        <ellipse
          className="art-stroke art-medium"
          cx="250"
          cy="250"
          rx="194"
          ry="74"
          transform="rotate(-24 250 250)"
        />
        <ellipse
          className="art-stroke art-faint"
          cx="250"
          cy="250"
          rx="194"
          ry="74"
          transform="rotate(54 250 250)"
        />
        <circle className="art-fill art-strong" cx="250" cy="250" r="62" />
        <circle className="art-fill art-medium" cx="96" cy="318" r="13" />
        <circle className="art-fill art-faint" cx="384" cy="142" r="8" />
        <path className="art-stroke art-strong" d="M76 390 424 110" />
      </svg>
    )
  }

  if (variant === 'frames') {
    return (
      <svg
        className="gallery-artwork-svg"
        viewBox="0 0 500 500"
        aria-hidden="true"
      >
        <rect
          className="art-stroke art-faint"
          x="72"
          y="72"
          width="246"
          height="246"
        />
        <rect
          className="art-stroke art-medium"
          x="126"
          y="126"
          width="246"
          height="246"
        />
        <rect
          className="art-stroke art-strong"
          x="180"
          y="180"
          width="246"
          height="246"
        />
        <path className="art-stroke art-faint" d="m72 72 108 108M318 72l108 108" />
        <path
          className="art-stroke art-medium"
          d="m72 318 108 108m192-300 54-54M126 372l-54 54"
        />
        <circle className="art-fill art-strong" cx="303" cy="303" r="18" />
      </svg>
    )
  }

  return (
    <svg
      className="gallery-artwork-svg"
      viewBox="0 0 500 500"
      aria-hidden="true"
    >
      <path
        className="art-stroke art-faint"
        d="M34 146c54-96 108 96 162 0s108 96 162 0 108 96 108 0"
      />
      <path
        className="art-stroke art-medium"
        d="M34 214c54-96 108 96 162 0s108 96 162 0 108 96 108 0"
      />
      <path
        className="art-stroke art-strong"
        d="M34 282c54-96 108 96 162 0s108 96 162 0 108 96 108 0"
      />
      <path
        className="art-stroke art-medium"
        d="M34 350c54-96 108 96 162 0s108 96 162 0 108 96 108 0"
      />
      <path className="art-stroke art-faint" d="M88 82v336m108-336v336m108-336v336m108-336v336" />
      <circle className="art-fill art-strong" cx="250" cy="250" r="14" />
    </svg>
  )
}

function getHashProjectId(): ProjectId | null {
  const hashId = window.location.hash.slice(1)
  return galleryProjects.some((project) => project.id === hashId)
    ? (hashId as ProjectId)
    : null
}

export function Gallery({ onNavigate }: GalleryProps) {
  const scrollContainerRef = useRef<HTMLElement>(null)
  const [activeProjectId, setActiveProjectId] = useState<ProjectId>(
    () => getHashProjectId() ?? galleryProjects[0].id,
  )

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    let animationFrame: number | null = null

    const updateActiveProject = () => {
      animationFrame = null
      const containerBounds = scrollContainer.getBoundingClientRect()
      const targetY = containerBounds.top + containerBounds.height * 0.46
      let nearestProjectId: ProjectId = galleryProjects[0].id
      let nearestDistance = Number.POSITIVE_INFINITY

      for (const project of galleryProjects) {
        const section = document.getElementById(project.id)
        if (!section) continue

        const bounds = section.getBoundingClientRect()
        const distance = Math.abs((bounds.top + bounds.bottom) / 2 - targetY)
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestProjectId = project.id
        }
      }

      setActiveProjectId(nearestProjectId)
    }

    const handleScroll = () => {
      if (animationFrame === null) {
        animationFrame = window.requestAnimationFrame(updateActiveProject)
      }
    }

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    updateActiveProject()

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll)
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame)
    }
  }, [])

  useEffect(() => {
    const hashProjectId = getHashProjectId()
    if (!hashProjectId) return

    const animationFrame = window.requestAnimationFrame(() => {
      document.getElementById(hashProjectId)?.scrollIntoView({ block: 'start' })
      setActiveProjectId(hashProjectId)
    })

    return () => window.cancelAnimationFrame(animationFrame)
  }, [])

  const handleMenuClick = (
    event: MouseEvent<HTMLAnchorElement>,
    projectId: ProjectId,
  ) => {
    event.preventDefault()
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    document.getElementById(projectId)?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    })
    window.history.replaceState(null, '', `/gallery#${projectId}`)
    setActiveProjectId(projectId)
  }

  const handleProjectClick = (
    event: MouseEvent<HTMLAnchorElement>,
    project: GalleryProject,
  ) => {
    event.preventDefault()
    window.history.replaceState(null, '', `/gallery#${project.id}`)
    onNavigate(project.route)
  }

  return (
    <main
      className="gallery-screen"
      aria-label="Gallery"
      ref={scrollContainerRef}
    >
      <nav className="gallery-menu" aria-label="Gallery projects">
        <ol className="gallery-menu-list">
          {galleryProjects.map((project) => (
            <li key={project.id}>
              <a
                className="gallery-menu-link"
                href={`/gallery#${project.id}`}
                aria-current={
                  activeProjectId === project.id ? 'location' : undefined
                }
                onClick={(event) => handleMenuClick(event, project.id)}
              >
                {project.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="gallery-projects">
        {galleryProjects.map((project, projectIndex) => (
          <section
            className={`gallery-project${projectIndex % 2 === 1 ? ' gallery-project--reversed' : ''}`}
            id={project.id}
            key={project.id}
            aria-labelledby={`${project.id}-title`}
          >
            <a
              className="gallery-project-card"
              href={project.route}
              onClick={(event) => handleProjectClick(event, project)}
            >
              <div className="gallery-artwork">
                <Artwork variant={project.artwork} />
              </div>
              <div className="gallery-project-copy">
                <span className="gallery-project-index" aria-hidden="true">
                  {project.index} / 04
                </span>
                <h2 id={`${project.id}-title`}>{project.title}</h2>
                <p>{project.description}</p>
              </div>
            </a>
          </section>
        ))}
      </div>
    </main>
  )
}

export function ProjectPlaceholder({
  project,
  onNavigate,
}: ProjectPlaceholderProps) {
  const galleryDestination = `/gallery#${project.id}`

  return (
    <main className="project-placeholder-screen">
      <a
        className="project-placeholder-back"
        href={galleryDestination}
        onClick={(event) => {
          event.preventDefault()
          onNavigate(galleryDestination)
        }}
      >
        ← Gallery
      </a>
      <p>This is a placeholder text</p>
    </main>
  )
}
