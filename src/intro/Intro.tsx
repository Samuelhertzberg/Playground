import { useEffect, useRef } from 'react'
import '@fontsource/jersey-10/latin-400.css'
import { AsciiGridEngine } from './gridEngine'

interface IntroProps {
  onComplete: () => void
}

export function Intro({ onComplete }: IntroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let engine: AsciiGridEngine | null = null
    let cancelled = false

    const handlePointerDown = (event: PointerEvent) => {
      if (!event.isPrimary) return
      if (event.pointerType === 'mouse' && event.button !== 0) return

      engine?.setPointer(event.clientX, event.clientY)
      engine?.advance(event.clientX, event.clientY)
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!event.isPrimary) return
      engine?.setPointer(event.clientX, event.clientY)
    }

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)

    void document.fonts
      .load('400 20px "Jersey 10"')
      .catch(() => [])
      .then(() => {
        if (!cancelled) engine = new AsciiGridEngine(canvas, onComplete)
      })

    return () => {
      cancelled = true
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      engine?.destroy()
    }
  }, [onComplete])

  return (
    <main className="intro-screen" aria-label="Interactive ASCII introduction">
      <canvas className="intro-canvas" ref={canvasRef} aria-hidden="true" />
    </main>
  )
}
