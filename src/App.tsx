import { useCallback, useEffect, useRef, useState } from 'react'
import { Gallery, ProjectPlaceholder } from './gallery/Gallery'
import {
  getPlaceholderProject,
  type GalleryProject,
} from './gallery/projects'
import { Intro } from './intro/Intro'
import { MobileGridEngine } from './mobile/mobileGridEngine'

type Route =
  | { page: 'intro' }
  | { page: 'gallery' }
  | { page: 'project'; project: GalleryProject }

function getRoute(pathname = window.location.pathname): Route {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'
  if (normalizedPath === '/gallery') return { page: 'gallery' }

  const project = getPlaceholderProject(normalizedPath)
  if (project) return { page: 'project', project }

  return { page: 'intro' }
}

function usePhoneViewport() {
  const [isPhoneViewport, setIsPhoneViewport] = useState(() =>
    window.matchMedia('(max-width: 767px)').matches,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const handleChange = (event: MediaQueryListEvent) => {
      setIsPhoneViewport(event.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return isPhoneViewport
}

function MobileGate() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new MobileGridEngine(canvas)
    return () => engine.destroy()
  }, [])

  return (
    <main
      className="mobile-gate-screen"
      aria-label="My gallery is too large for you, traveller"
    >
      <canvas className="mobile-grid-canvas" ref={canvasRef} aria-hidden="true" />
    </main>
  )
}

export function App() {
  const [route, setRoute] = useState<Route>(() => getRoute())
  const isPhoneViewport = usePhoneViewport()

  useEffect(() => {
    const handlePopState = () => setRoute(getRoute())
    window.addEventListener('popstate', handlePopState)

    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((destination: string) => {
    const destinationUrl = new URL(destination, window.location.origin)
    const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`
    const nextLocation = `${destinationUrl.pathname}${destinationUrl.search}${destinationUrl.hash}`

    if (currentLocation !== nextLocation) {
      window.history.pushState(null, '', nextLocation)
    }

    setRoute(getRoute(destinationUrl.pathname))
  }, [])

  const openGallery = useCallback(() => navigate('/gallery'), [navigate])

  if (isPhoneViewport) return <MobileGate />

  if (route.page === 'gallery') {
    return <Gallery onNavigate={navigate} />
  }

  if (route.page === 'project') {
    return (
      <ProjectPlaceholder project={route.project} onNavigate={navigate} />
    )
  }

  return <Intro onComplete={openGallery} />
}
