import { useCallback, useEffect, useState } from 'react'
import { Intro } from './intro/Intro'

type Route = 'intro' | 'gallery'

function getRoute(pathname = window.location.pathname): Route {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'
  return normalizedPath === '/gallery' ? 'gallery' : 'intro'
}

export function App() {
  const [route, setRoute] = useState<Route>(() => getRoute())

  useEffect(() => {
    const handlePopState = () => setRoute(getRoute())
    window.addEventListener('popstate', handlePopState)

    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const openGallery = useCallback(() => {
    if (getRoute() !== 'gallery') {
      window.history.pushState(null, '', '/gallery')
    }

    setRoute('gallery')
  }, [])

  if (route === 'gallery') {
    return <main className="gallery-screen" aria-label="Gallery" />
  }

  return <Intro onComplete={openGallery} />
}
