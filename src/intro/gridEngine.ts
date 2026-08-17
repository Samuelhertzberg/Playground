import {
  createWordMask,
  getWordDimensions,
  type WordOrientation,
} from './glyphMasks'

type Phase =
  | 'idle'
  | 'revealing-fun'
  | 'fun'
  | 'revealing-garbage'
  | 'garbage'
  | 'clearing'
  | 'gallery'

type SettledPhase = 'fun' | 'garbage' | 'gallery'

interface Point {
  x: number
  y: number
}

interface GridLayout {
  width: number
  height: number
  columns: number
  rows: number
  originX: number
  originY: number
  pitchX: number
  pitchY: number
  fontSize: number
  orientation: WordOrientation
}

interface CellTransition {
  startAt: number
  nextWaveAt: number
  waveIndex: number
  targetFilled: boolean
  keepFlippingAfter: boolean
  started: boolean
}

interface Cell {
  column: number
  row: number
  x: number
  y: number
  glyph: string
  waveGlyph: string | null
  keepsFlipping: boolean
  nextIdleAt: number
  transition?: CellTransition
}

interface ActiveTransition {
  word: 'FUN' | 'GARBAGE' | null
  runningPhase: Phase
  settledPhase: SettledPhase
  origin: Point
}

const SCREEN_BLUE = '#0000aa'
const SCREEN_WHITE = '#fff'
const FONT_STACK =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'

const BASE_CELL_WIDTH = 9
const BASE_CELL_HEIGHT = 15
const BASE_GAP_X = 2
const BASE_GAP_Y = 2
const BASE_PITCH_X = BASE_CELL_WIDTH + BASE_GAP_X
const BASE_PITCH_Y = BASE_CELL_HEIGHT + BASE_GAP_Y
const WORD_PADDING = 1
const IDLE_MIN_MS = 400
const IDLE_MAX_MS = 1000
const WAVE_TRAVEL_MS = 930
const WAVE_JITTER_MS = 35
const WAVE_BLOCK_INTERVAL_MS = 27
const WAVE_BLOCK_GLYPHS = ['░', '▓', '█', '▓', '░'] as const
const MASK_GLYPH = '█'

function randomBetween(minimum: number, maximum: number) {
  return minimum + Math.random() * (maximum - minimum)
}

function randomAscii() {
  return String.fromCharCode(Math.floor(randomBetween(33, 127)))
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function createLayout(width: number, height: number): GridLayout {
  const baseColumns = Math.max(1, Math.floor(width / BASE_PITCH_X))
  const baseRows = Math.max(1, Math.floor(height / BASE_PITCH_Y))
  const orientation: WordOrientation =
    baseRows > baseColumns ? 'vertical' : 'horizontal'
  const longestWord = getWordDimensions('GARBAGE', orientation)
  const requiredColumns = longestWord.width + WORD_PADDING * 2
  const requiredRows = longestWord.height + WORD_PADDING * 2
  const fitScale = Math.min(
    1,
    width / (requiredColumns * BASE_PITCH_X),
    height / (requiredRows * BASE_PITCH_Y),
  )
  const scale = fitScale < 1 ? fitScale * 0.995 : 1
  const pitchX = BASE_PITCH_X * scale
  const pitchY = BASE_PITCH_Y * scale
  const columns = Math.max(requiredColumns, Math.floor(width / pitchX))
  const rows = Math.max(requiredRows, Math.floor(height / pitchY))
  const gridWidth = columns * pitchX
  const gridHeight = rows * pitchY

  return {
    width,
    height,
    columns,
    rows,
    originX: (width - gridWidth) / 2,
    originY: (height - gridHeight) / 2,
    pitchX,
    pitchY,
    fontSize: BASE_CELL_HEIGHT * scale,
    orientation,
  }
}

export class AsciiGridEngine {
  private readonly canvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D
  private readonly onComplete: () => void
  private layout: GridLayout
  private cells: Cell[] = []
  private phase: Phase = 'idle'
  private activeTransition: ActiveTransition | null = null
  private animationFrame: number | null = null
  private resizeFrame: number | null = null
  private idleTimer: number | null = null
  private destroyed = false

  constructor(canvas: HTMLCanvasElement, onComplete: () => void) {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D is unavailable')

    this.canvas = canvas
    this.context = context
    this.onComplete = onComplete
    this.layout = createLayout(1, 1)

    this.configureCanvas()
    this.populateIdle()
    window.addEventListener('resize', this.handleResize)
  }

  advance(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect()
    const origin = {
      x: clamp((clientX - rect.left) / rect.width, 0, 1),
      y: clamp((clientY - rect.top) / rect.height, 0, 1),
    }

    if (this.phase === 'idle') {
      this.beginTransition('FUN', 'revealing-fun', 'fun', origin)
    } else if (this.phase === 'fun') {
      this.beginTransition('GARBAGE', 'revealing-garbage', 'garbage', origin)
    } else if (this.phase === 'garbage') {
      this.beginTransition(null, 'clearing', 'gallery', origin)
    }
  }

  destroy() {
    this.destroyed = true
    window.removeEventListener('resize', this.handleResize)
    this.cancelScheduledWork()
  }

  private readonly handleResize = () => {
    if (this.resizeFrame !== null) return

    this.resizeFrame = window.requestAnimationFrame(() => {
      this.resizeFrame = null
      this.rebuildAfterResize()
    })
  }

  private rebuildAfterResize() {
    const transition = this.activeTransition
    this.cancelAnimationAndIdle()
    this.configureCanvas()

    if (transition) {
      this.populateSourceFor(transition.runningPhase)
      this.beginTransition(
        transition.word,
        transition.runningPhase,
        transition.settledPhase,
        transition.origin,
      )
      return
    }

    if (this.phase === 'idle') {
      this.populateIdle()
    } else if (this.phase === 'fun') {
      this.populateSettledWord('FUN')
    } else if (this.phase === 'garbage') {
      this.populateSettledWord('GARBAGE')
    } else {
      this.populateBlank()
    }
  }

  private configureCanvas() {
    const rect = this.canvas.getBoundingClientRect()
    const width = Math.max(1, rect.width)
    const height = Math.max(1, rect.height)
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)

    this.canvas.width = Math.round(width * pixelRatio)
    this.canvas.height = Math.round(height * pixelRatio)
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    this.context.textAlign = 'center'
    this.context.textBaseline = 'middle'
    this.layout = createLayout(width, height)
    this.context.font = `${this.layout.fontSize}px ${FONT_STACK}`
  }

  private createCells(
    glyphs?: readonly string[],
    flippingCells?: readonly boolean[],
  ) {
    const now = performance.now()
    const cells: Cell[] = []

    for (let row = 0; row < this.layout.rows; row += 1) {
      for (let column = 0; column < this.layout.columns; column += 1) {
        const index = row * this.layout.columns + column
        cells.push({
          column,
          row,
          x: this.layout.originX + (column + 0.5) * this.layout.pitchX,
          y: this.layout.originY + (row + 0.5) * this.layout.pitchY,
          glyph: glyphs?.[index] ?? '',
          waveGlyph: null,
          keepsFlipping: flippingCells?.[index] ?? false,
          nextIdleAt: now + randomBetween(IDLE_MIN_MS, IDLE_MAX_MS),
        })
      }
    }

    this.cells = cells
  }

  private populateIdle() {
    const count = this.layout.columns * this.layout.rows
    this.createCells(
      Array.from({ length: count }, randomAscii),
      Array.from({ length: count }, () => true),
    )
    this.drawAll()
    this.scheduleAmbientTick()
  }

  private populateBlank() {
    this.createCells()
    this.drawAll()
  }

  private populateSettledWord(word: 'FUN' | 'GARBAGE') {
    const target = this.createTarget(word)
    const glyphs = target.map((filled) =>
      filled ? MASK_GLYPH : randomAscii(),
    )
    this.createCells(
      glyphs,
      target.map((filled) => !filled),
    )
    this.drawAll()
    this.scheduleAmbientTick()
  }

  private populateSourceFor(runningPhase: Phase) {
    if (runningPhase === 'revealing-fun') {
      const count = this.layout.columns * this.layout.rows
      this.createCells(
        Array.from({ length: count }, randomAscii),
        Array.from({ length: count }, () => true),
      )
    } else if (runningPhase === 'revealing-garbage') {
      const target = this.createTarget('FUN')
      this.createCells(
        target.map((filled) => (filled ? MASK_GLYPH : randomAscii())),
        target.map((filled) => !filled),
      )
    } else if (runningPhase === 'clearing') {
      const target = this.createTarget('GARBAGE')
      this.createCells(
        target.map((filled) => (filled ? MASK_GLYPH : randomAscii())),
        target.map((filled) => !filled),
      )
    } else {
      this.createCells()
    }

    this.drawAll()
  }

  private createTarget(word: 'FUN' | 'GARBAGE' | null) {
    const target = Array.from(
      { length: this.layout.columns * this.layout.rows },
      () => false,
    )
    if (!word) return target

    const mask = createWordMask(word, this.layout.orientation)
    const startColumn = Math.floor((this.layout.columns - mask.width) / 2)
    const startRow = Math.floor((this.layout.rows - mask.height) / 2)

    for (const coordinate of mask.filled) {
      const [maskColumn, maskRow] = coordinate.split(':').map(Number)
      const column = startColumn + maskColumn
      const row = startRow + maskRow
      target[row * this.layout.columns + column] = true
    }

    return target
  }

  private beginTransition(
    word: 'FUN' | 'GARBAGE' | null,
    runningPhase: Phase,
    settledPhase: SettledPhase,
    origin: Point,
  ) {
    this.cancelAnimationAndIdle()
    this.phase = runningPhase
    this.activeTransition = { word, runningPhase, settledPhase, origin }

    const target = this.createTarget(word)
    const originInPixels = {
      x: origin.x * this.layout.width,
      y: origin.y * this.layout.height,
    }
    const maximumDistance = Math.max(
      ...this.cells.map((cell) =>
        Math.hypot(cell.x - originInPixels.x, cell.y - originInPixels.y),
      ),
      1,
    )
    const now = performance.now()

    for (const [index, cell] of this.cells.entries()) {
      const distance = Math.hypot(
        cell.x - originInPixels.x,
        cell.y - originInPixels.y,
      )
      const startAt =
        now +
        (distance / maximumDistance) * WAVE_TRAVEL_MS +
        Math.random() * WAVE_JITTER_MS
      const targetFilled = target[index]
      const keepFlippingAfter =
        settledPhase !== 'gallery' && targetFilled === false

      cell.transition = {
        startAt,
        nextWaveAt: startAt + WAVE_BLOCK_INTERVAL_MS,
        waveIndex: 0,
        targetFilled,
        keepFlippingAfter,
        started: false,
      }
    }

    this.animationFrame = window.requestAnimationFrame(this.animateTransition)
  }

  private readonly animateTransition = (now: number) => {
    let hasActiveCells = false

    for (const cell of this.cells) {
      const transition = cell.transition
      if (!transition) {
        if (cell.keepsFlipping && now >= cell.nextIdleAt) {
          cell.glyph = randomAscii()
          cell.nextIdleAt = now + randomBetween(IDLE_MIN_MS, IDLE_MAX_MS)
          this.drawCell(cell)
        }
        continue
      }
      hasActiveCells = true
      let changed = false

      if (cell.keepsFlipping && now >= cell.nextIdleAt) {
        cell.glyph = randomAscii()
        cell.nextIdleAt = now + randomBetween(IDLE_MIN_MS, IDLE_MAX_MS)
        changed = true
      }

      if (!transition.started && now >= transition.startAt) {
        transition.started = true
        cell.waveGlyph = WAVE_BLOCK_GLYPHS[0]

        if (transition.keepFlippingAfter) {
          if (!cell.keepsFlipping) {
            cell.glyph = randomAscii()
            cell.nextIdleAt = now + randomBetween(IDLE_MIN_MS, IDLE_MAX_MS)
          }
          cell.keepsFlipping = true
        } else {
          cell.keepsFlipping = false
        }

        changed = true
      }

      while (
        transition.started &&
        transition.waveIndex < WAVE_BLOCK_GLYPHS.length - 1 &&
        now >= transition.nextWaveAt
      ) {
        transition.waveIndex += 1
        cell.waveGlyph = WAVE_BLOCK_GLYPHS[transition.waveIndex]
        transition.nextWaveAt += WAVE_BLOCK_INTERVAL_MS
        changed = true
      }

      if (
        transition.started &&
        transition.waveIndex === WAVE_BLOCK_GLYPHS.length - 1 &&
        now >= transition.nextWaveAt
      ) {
        cell.waveGlyph = null

        if (transition.targetFilled) {
          cell.glyph = MASK_GLYPH
          cell.keepsFlipping = false
        } else if (!transition.keepFlippingAfter) {
          cell.glyph = ''
          cell.keepsFlipping = false
        }

        cell.transition = undefined
        changed = true
      }

      if (changed) this.drawCell(cell)
    }

    if (hasActiveCells) {
      this.animationFrame = window.requestAnimationFrame(this.animateTransition)
    } else {
      this.animationFrame = null
      this.finishTransition()
    }
  }

  private finishTransition() {
    const transition = this.activeTransition
    if (!transition || this.destroyed) return

    this.activeTransition = null
    this.phase = transition.settledPhase

    if (transition.settledPhase === 'gallery') {
      this.onComplete()
    } else {
      this.scheduleAmbientTick()
    }
  }

  private scheduleAmbientTick() {
    const isAmbientPhase =
      this.phase === 'idle' || this.phase === 'fun' || this.phase === 'garbage'
    if (this.destroyed || !isAmbientPhase) return

    const now = performance.now()
    const activeCells = this.cells.filter((cell) => cell.keepsFlipping)
    if (activeCells.length === 0) return

    const nextChangeAt = Math.min(
      ...activeCells.map((cell) => cell.nextIdleAt),
    )
    const delay = clamp(nextChangeAt - now, 16, 120)

    this.idleTimer = window.setTimeout(this.runAmbientTick, delay)
  }

  private readonly runAmbientTick = () => {
    const isAmbientPhase =
      this.phase === 'idle' || this.phase === 'fun' || this.phase === 'garbage'
    if (this.destroyed || !isAmbientPhase) return

    const now = performance.now()
    for (const cell of this.cells) {
      if (!cell.keepsFlipping) continue
      if (now < cell.nextIdleAt) continue

      cell.glyph = randomAscii()
      cell.nextIdleAt = now + randomBetween(IDLE_MIN_MS, IDLE_MAX_MS)
      this.drawCell(cell)
    }

    this.scheduleAmbientTick()
  }

  private drawAll() {
    this.context.fillStyle = SCREEN_BLUE
    this.context.fillRect(0, 0, this.layout.width, this.layout.height)

    for (const cell of this.cells) {
      if (cell.glyph || cell.waveGlyph) this.drawCell(cell)
    }
  }

  private drawCell(cell: Cell) {
    const clearX = cell.x - this.layout.pitchX / 2
    const clearY = cell.y - this.layout.pitchY / 2
    this.context.fillStyle = SCREEN_BLUE
    this.context.fillRect(
      clearX,
      clearY,
      this.layout.pitchX,
      this.layout.pitchY,
    )

    this.context.fillStyle = SCREEN_WHITE

    const visibleGlyph = cell.waveGlyph ?? cell.glyph
    if (visibleGlyph) {
      this.context.fillText(visibleGlyph, cell.x, cell.y)
    }
  }

  private cancelAnimationAndIdle() {
    if (this.animationFrame !== null) {
      window.cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }

    if (this.idleTimer !== null) {
      window.clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
  }

  private cancelScheduledWork() {
    this.cancelAnimationAndIdle()

    if (this.resizeFrame !== null) {
      window.cancelAnimationFrame(this.resizeFrame)
      this.resizeFrame = null
    }
  }
}
