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
}

interface Cell {
  column: number
  row: number
  x: number
  y: number
  glyph: string
  waveGlyph: string | null
  keepsFlipping: boolean
  peeksThrough: boolean
  peekInSpotlightOnly: boolean
  peekPending: boolean
  peekRevealGlyph: string | null
  peekFlipsRemaining: number
  peekGroupId: number | null
  nextIdleAt: number
  scheduleVersion: number
  transition?: CellTransition
}

interface ScheduledCellUpdate {
  cell: Cell
  time: number
  version: number
}

interface ActiveTransition {
  word: 'FUN' | 'GARBAGE' | null
  runningPhase: Phase
  settledPhase: SettledPhase
  origin: Point
}

interface PeekGroup {
  remainingMembers: number
  type: 'welcome' | 'noise' | 'cursor-word'
}

interface SpotlightSnapshot {
  x: number
  y: number
  radius: number
}

interface CellRegion {
  minimumColumn: number
  maximumColumn: number
  minimumRow: number
  maximumRow: number
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
const SPOTLIGHT_INNER_STOP = 0.05
const SPOTLIGHT_OUTER_STOP = 1
const SPOTLIGHT_MIN_RADIUS = 80
const SPOTLIGHT_MAX_RADIUS = 140
const SPOTLIGHT_VIEWPORT_RATIO = 0.14
const SPOTLIGHT_IDLE_DELAY_MS = 1000
const SPOTLIGHT_EXPAND_DURATION_MS = 3000
const SPOTLIGHT_COLLAPSE_DURATION_MS = 400
const SPOTLIGHT_MAX_SCALE = 3
const SPOTLIGHT_FULL_COLLAPSE_DISTANCE = 240
const SPOTLIGHT_MIN_FONT_SCALE = 0.35
const SPOTLIGHT_MAX_FONT_SCALE = 1.1
const SPOTLIGHT_JIGGLE_INTERVAL_MS = 70
const SPOTLIGHT_JIGGLE_AMPLITUDE = 0.9
const SPOTLIGHT_PULL_DISTANCE = 3.25
const FONT_SIZE_CACHE_STEP = 0.125
const BACKGROUND_PEEK_DENSITY = 0.008
const BACKGROUND_PEEK_STRENGTH = 1
const BACKGROUND_PEEK_WORD = 'welcome'
const BACKGROUND_PEEK_ROLLOUT_INTERVAL_MS = 65
const BACKGROUND_PEEK_WELCOME_SHARE = 0.25
const BACKGROUND_PEEK_INITIAL_STAGGER_MS = 2500
const BACKGROUND_PEEK_WELCOME_DELAY_MIN_MS = 1000
const BACKGROUND_PEEK_WELCOME_DELAY_MAX_MS = 2500
const BACKGROUND_PEEK_REPLACEMENT_DELAY_MIN_MS = 2000
const BACKGROUND_PEEK_REPLACEMENT_DELAY_MAX_MS = 6000
const CURSOR_WORDS = ['Hello?', 'Nosy', 'ghost', 'Garbage', 'Fun'] as const
const CURSOR_WORD_SPAWN_RATE_MULTIPLIER = 50
const CURSOR_WORD_INITIAL_DELAY_MIN_MS = 1800
const CURSOR_WORD_INITIAL_DELAY_MAX_MS = 4500
const CURSOR_WORD_REPLACEMENT_DELAY_MIN_MS = 3000
const CURSOR_WORD_REPLACEMENT_DELAY_MAX_MS = 7500
const CURSOR_WORD_STAGGER_MIN_MS = 1200
const CURSOR_WORD_STAGGER_MAX_MS = 3000
const CURSOR_WORD_TARGET_COUNT = 3 * CURSOR_WORD_SPAWN_RATE_MULTIPLIER
const CURSOR_WORD_HOLD_MIN_MS = 10000
const CURSOR_WORD_HOLD_MAX_MS = 16000

function randomBetween(minimum: number, maximum: number) {
  return minimum + Math.random() * (maximum - minimum)
}

function randomAscii() {
  return String.fromCharCode(Math.floor(randomBetween(33, 127)))
}

function randomPeekLifespan() {
  return Math.floor(randomBetween(2, 5))
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function smoothStep(start: number, end: number, value: number) {
  const normalized = clamp((value - start) / (end - start), 0, 1)
  return normalized * normalized * (3 - 2 * normalized)
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
  private pendingTransitionCells: Cell[] = []
  private pendingTransitionIndex = 0
  private activeWaveCells: Cell[] = []
  private dirtyTransitionCells = new Set<number>()
  private jiggleFrame: number | null = null
  private resizeFrame: number | null = null
  private idleTimer: number | null = null
  private idleTimerAt = Number.POSITIVE_INFINITY
  private ambientQueue: ScheduledCellUpdate[] = []
  private pointer: Point = { x: 0.5, y: 0.5 }
  private canvasLeft = 0
  private canvasTop = 0
  private spotlightScale = 1
  private spotlightCollapseTarget = 1
  private lastPointerMoveAt = performance.now()
  private lastSpotlightAnimationAt = performance.now()
  private spotlightX = 0
  private spotlightY = 0
  private spotlightRadius = 1
  private spotlightRadiusSquared = 1
  private renderedSpotlight: SpotlightSnapshot = { x: 0, y: 0, radius: 0 }
  private spotlightDirty = false
  private peekGroups = new Map<number, PeekGroup>()
  private nextPeekGroupId = 0
  private activeCursorWordCount = 0
  private nextCursorWordAt = Number.POSITIVE_INFINITY
  private jiggleEpoch = 0
  private lastJiggleAt = 0
  private currentFont = ''
  private fontCache = new Map<number, string>()
  private currentFillStyle = ''
  private currentAlpha = -1
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
    this.jiggleFrame = window.requestAnimationFrame(this.animateJiggle)
    window.addEventListener('resize', this.handleResize)
  }

  advance(clientX: number, clientY: number) {
    const origin = {
      x: clamp((clientX - this.canvasLeft) / this.layout.width, 0, 1),
      y: clamp((clientY - this.canvasTop) / this.layout.height, 0, 1),
    }

    if (this.phase === 'idle') {
      this.beginTransition('FUN', 'revealing-fun', 'fun', origin)
    } else if (this.phase === 'fun') {
      this.beginTransition('GARBAGE', 'revealing-garbage', 'garbage', origin)
    } else if (this.phase === 'garbage') {
      this.beginTransition(null, 'clearing', 'gallery', origin)
    }
  }

  setPointer(clientX: number, clientY: number) {
    const now = performance.now()
    const nextPointer = {
      x: clamp((clientX - this.canvasLeft) / this.layout.width, 0, 1),
      y: clamp((clientY - this.canvasTop) / this.layout.height, 0, 1),
    }
    const movementDistance = Math.hypot(
      (nextPointer.x - this.pointer.x) * this.layout.width,
      (nextPointer.y - this.pointer.y) * this.layout.height,
    )
    this.pointer = nextPointer
    if (movementDistance > 0) {
      this.lastPointerMoveAt = now
      const collapseAmount =
        (movementDistance / SPOTLIGHT_FULL_COLLAPSE_DISTANCE) *
        (SPOTLIGHT_MAX_SCALE - 1)
      this.spotlightCollapseTarget = Math.max(
        1,
        Math.min(this.spotlightScale, this.spotlightCollapseTarget) -
          collapseAmount,
      )
    }
    this.updateSpotlightGeometry()
    this.spotlightDirty = true
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

    this.canvasLeft = rect.left
    this.canvasTop = rect.top

    this.canvas.width = Math.round(width * pixelRatio)
    this.canvas.height = Math.round(height * pixelRatio)
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    this.context.textAlign = 'center'
    this.context.textBaseline = 'middle'
    this.layout = createLayout(width, height)
    this.currentFont = ''
    this.fontCache.clear()
    this.currentFillStyle = ''
    this.currentAlpha = -1
    this.setContextFont(this.layout.fontSize)
    this.updateSpotlightGeometry()
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
        const keepsFlipping = flippingCells?.[index] ?? false
        cells.push({
          column,
          row,
          x: this.layout.originX + (column + 0.5) * this.layout.pitchX,
          y: this.layout.originY + (row + 0.5) * this.layout.pitchY,
          glyph: glyphs?.[index] ?? '',
          waveGlyph: null,
          keepsFlipping,
          peeksThrough: false,
          peekInSpotlightOnly: false,
          peekPending: false,
          peekRevealGlyph: null,
          peekFlipsRemaining: 0,
          peekGroupId: null,
          nextIdleAt: now + randomBetween(IDLE_MIN_MS, IDLE_MAX_MS),
          scheduleVersion: 0,
        })
      }
    }

    this.cells = cells
    this.ambientQueue = cells
      .filter((cell) => cell.keepsFlipping)
      .map((cell) => ({
        cell,
        time: cell.nextIdleAt,
        version: cell.scheduleVersion,
      }))
    this.heapifyAmbientQueue()
    this.seedWelcomeGroups()
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
    let maximumDistance = 1
    for (const cell of this.cells) {
      maximumDistance = Math.max(
        maximumDistance,
        Math.hypot(cell.x - originInPixels.x, cell.y - originInPixels.y),
      )
    }
    const now = performance.now()
    this.pendingTransitionCells = []
    this.pendingTransitionIndex = 0
    this.activeWaveCells = []
    this.dirtyTransitionCells.clear()

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
      }
      this.pendingTransitionCells.push(cell)
    }
    this.pendingTransitionCells.sort(
      (first, second) =>
        (first.transition?.startAt ?? 0) - (second.transition?.startAt ?? 0),
    )

    this.scheduleAmbientTick()
    this.animationFrame = window.requestAnimationFrame(this.animateTransition)
  }

  private readonly animateTransition = (now: number) => {
    let startedCells = false
    while (this.pendingTransitionIndex < this.pendingTransitionCells.length) {
      const cell = this.pendingTransitionCells[this.pendingTransitionIndex]
      const transition = cell.transition
      if (!transition || now < transition.startAt) break

      cell.waveGlyph = WAVE_BLOCK_GLYPHS[0]
      if (transition.keepFlippingAfter) {
        if (!cell.keepsFlipping) {
          cell.glyph = randomAscii()
          this.scheduleCellUpdate(
            cell,
            now + randomBetween(IDLE_MIN_MS, IDLE_MAX_MS),
          )
        }
        cell.keepsFlipping = true
      } else {
        if (cell.peekGroupId !== null) this.deactivatePeek(cell)
        cell.keepsFlipping = false
      }
      this.markTransitionCellDirty(cell)
      this.activeWaveCells.push(cell)
      this.pendingTransitionIndex += 1
      startedCells = true
    }
    if (startedCells) this.scheduleAmbientTick()

    let remainingActiveCells = 0
    for (const cell of this.activeWaveCells) {
      const transition = cell.transition
      if (!transition) continue
      let changed = false

      while (
        transition.waveIndex < WAVE_BLOCK_GLYPHS.length - 1 &&
        now >= transition.nextWaveAt
      ) {
        transition.waveIndex += 1
        cell.waveGlyph = WAVE_BLOCK_GLYPHS[transition.waveIndex]
        transition.nextWaveAt += WAVE_BLOCK_INTERVAL_MS
        changed = true
      }

      if (
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
      } else {
        this.activeWaveCells[remainingActiveCells] = cell
        remainingActiveCells += 1
      }

      if (changed) this.markTransitionCellDirty(cell)
    }
    this.activeWaveCells.length = remainingActiveCells
    this.redrawDirtyTransitionCells()

    const hasPendingCells =
      this.pendingTransitionIndex < this.pendingTransitionCells.length
    if (hasPendingCells || this.activeWaveCells.length > 0) {
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
    this.pendingTransitionCells = []
    this.pendingTransitionIndex = 0
    this.activeWaveCells = []
    this.dirtyTransitionCells.clear()

    if (transition.settledPhase === 'gallery') {
      this.onComplete()
    } else {
      this.scheduleAmbientTick()
    }
  }

  private scheduleCellUpdate(cell: Cell, time: number) {
    cell.nextIdleAt = time
    cell.scheduleVersion += 1
    this.pushAmbientQueue({ cell, time, version: cell.scheduleVersion })
  }

  private markTransitionCellDirty(cell: Cell) {
    const minimumColumn = Math.max(0, cell.column - 1)
    const maximumColumn = Math.min(this.layout.columns - 1, cell.column + 1)
    const minimumRow = Math.max(0, cell.row - 1)
    const maximumRow = Math.min(this.layout.rows - 1, cell.row + 1)

    for (let row = minimumRow; row <= maximumRow; row += 1) {
      for (let column = minimumColumn; column <= maximumColumn; column += 1) {
        this.dirtyTransitionCells.add(row * this.layout.columns + column)
      }
    }
  }

  private redrawDirtyTransitionCells() {
    if (this.dirtyTransitionCells.size === 0) return

    this.setContextAlpha(1)
    this.setContextFillStyle(SCREEN_BLUE)
    for (const index of this.dirtyTransitionCells) {
      const cell = this.cells[index]
      this.context.fillRect(
        cell.x - this.layout.pitchX / 2,
        cell.y - this.layout.pitchY / 2,
        this.layout.pitchX,
        this.layout.pitchY,
      )
    }
    for (const index of this.dirtyTransitionCells) {
      const cell = this.cells[index]
      if (cell.glyph || cell.waveGlyph) this.drawCell(cell, false)
    }
    this.dirtyTransitionCells.clear()
  }

  private heapifyAmbientQueue() {
    for (
      let index = Math.floor(this.ambientQueue.length / 2) - 1;
      index >= 0;
      index -= 1
    ) {
      this.siftAmbientQueueDown(index)
    }
  }

  private pushAmbientQueue(update: ScheduledCellUpdate) {
    this.ambientQueue.push(update)
    let index = this.ambientQueue.length - 1

    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2)
      if (this.ambientQueue[parentIndex].time <= update.time) break
      this.ambientQueue[index] = this.ambientQueue[parentIndex]
      index = parentIndex
    }
    this.ambientQueue[index] = update
  }

  private popAmbientQueue() {
    const lastUpdate = this.ambientQueue.pop()
    if (!lastUpdate || this.ambientQueue.length === 0) return
    this.ambientQueue[0] = lastUpdate
    this.siftAmbientQueueDown(0)
  }

  private siftAmbientQueueDown(startIndex: number) {
    const queueLength = this.ambientQueue.length
    const update = this.ambientQueue[startIndex]
    let index = startIndex

    while (true) {
      const leftIndex = index * 2 + 1
      if (leftIndex >= queueLength) break
      const rightIndex = leftIndex + 1
      const childIndex =
        rightIndex < queueLength &&
        this.ambientQueue[rightIndex].time < this.ambientQueue[leftIndex].time
          ? rightIndex
          : leftIndex
      if (this.ambientQueue[childIndex].time >= update.time) break
      this.ambientQueue[index] = this.ambientQueue[childIndex]
      index = childIndex
    }
    this.ambientQueue[index] = update
  }

  private peekNextScheduledCell() {
    while (this.ambientQueue.length > 0) {
      const update = this.ambientQueue[0]
      if (
        update.version === update.cell.scheduleVersion &&
        update.cell.keepsFlipping
      ) {
        return update
      }
      this.popAmbientQueue()
    }
    return undefined
  }

  private scheduleAmbientTick() {
    if (this.destroyed || this.phase === 'gallery') return

    const now = performance.now()
    const nextUpdate = this.peekNextScheduledCell()
    if (!nextUpdate) return

    const delay = clamp(nextUpdate.time - now, 16, IDLE_MAX_MS)
    const timerAt = now + delay
    if (this.idleTimer !== null && this.idleTimerAt <= timerAt) return
    if (this.idleTimer !== null) window.clearTimeout(this.idleTimer)

    this.idleTimerAt = timerAt
    this.idleTimer = window.setTimeout(this.runAmbientTick, delay)
  }

  private readonly runAmbientTick = () => {
    if (this.destroyed || this.phase === 'gallery') return

    this.idleTimer = null
    this.idleTimerAt = Number.POSITIVE_INFINITY
    const now = performance.now()
    let nextUpdate = this.peekNextScheduledCell()
    while (nextUpdate && nextUpdate.time <= now) {
      this.popAmbientQueue()
      const { cell } = nextUpdate
      const wasVisible = this.isFlippingCellVisible(cell)
      this.updateFlippingCell(cell, now)
      if (wasVisible || this.isFlippingCellVisible(cell)) {
        this.drawCell(cell)
      }
      nextUpdate = this.peekNextScheduledCell()
    }

    this.scheduleAmbientTick()
  }

  private isFlippingCellVisible(cell: Cell) {
    if (cell.peeksThrough && !cell.peekInSpotlightOnly) return true
    const deltaX = cell.x - this.spotlightX
    const deltaY = cell.y - this.spotlightY
    return deltaX * deltaX + deltaY * deltaY < this.spotlightRadiusSquared
  }

  private drawAll() {
    this.setContextAlpha(1)
    this.setContextFillStyle(SCREEN_BLUE)
    this.context.fillRect(0, 0, this.layout.width, this.layout.height)

    for (const cell of this.cells) {
      if (cell.glyph || cell.waveGlyph) this.drawCell(cell, false)
    }
    this.renderedSpotlight = this.getSpotlightSnapshot()
    this.spotlightDirty = false
  }

  private drawCell(cell: Cell, clearCell = true) {
    const visibleGlyph = cell.waveGlyph ?? cell.glyph
    const isBackgroundGlyph = !cell.waveGlyph && cell.keepsFlipping
    const deltaX = this.spotlightX - cell.x
    const deltaY = this.spotlightY - cell.y
    const distanceSquared = deltaX * deltaX + deltaY * deltaY
    const isInsideSpotlight = distanceSquared < this.spotlightRadiusSquared
    const distance = isInsideSpotlight ? Math.sqrt(distanceSquared) : 0
    const spotlightStrength = isInsideSpotlight
      ? this.getSpotlightStrengthForDistance(distance)
      : 0
    const visibilityStrength = Math.max(
      isBackgroundGlyph ? spotlightStrength : 1,
      isBackgroundGlyph &&
        cell.peeksThrough &&
        !cell.peekInSpotlightOnly
        ? BACKGROUND_PEEK_STRENGTH
        : 0,
    )

    if (clearCell) {
      const clearX = cell.x - this.layout.pitchX / 2
      const clearY = cell.y - this.layout.pitchY / 2
      this.setContextAlpha(1)
      this.setContextFillStyle(SCREEN_BLUE)
      this.context.fillRect(
        clearX,
        clearY,
        this.layout.pitchX,
        this.layout.pitchY,
      )
    }

    if (isBackgroundGlyph && visibilityStrength <= 0) return

    if (visibleGlyph) {
      this.setContextFillStyle(SCREEN_WHITE)
      this.setContextAlpha(visibilityStrength)
      const fontGradientStrength =
        cell.peeksThrough && !cell.peekInSpotlightOnly
        ? spotlightStrength
        : visibilityStrength
      const gradientFontScale =
        SPOTLIGHT_MIN_FONT_SCALE +
        fontGradientStrength *
          (SPOTLIGHT_MAX_FONT_SCALE - SPOTLIGHT_MIN_FONT_SCALE)
      const fontScale = cell.peeksThrough && !cell.peekInSpotlightOnly
        ? Math.max(1, gradientFontScale)
        : gradientFontScale
      this.setContextFont(
        isBackgroundGlyph
          ? this.layout.fontSize * fontScale
          : this.layout.fontSize,
      )
      let jiggleX = 0
      let jiggleY = 0
      if (
        isBackgroundGlyph &&
        !cell.peekInSpotlightOnly &&
        spotlightStrength > 0
      ) {
        const amplitude = SPOTLIGHT_JIGGLE_AMPLITUDE * spotlightStrength
        jiggleX =
          Math.sin(
            cell.column * 12.9898 +
              cell.row * 78.233 +
              this.jiggleEpoch * 37.719,
          ) * amplitude
        jiggleY =
          Math.sin(
            cell.column * 39.346 +
              cell.row * 11.135 +
              this.jiggleEpoch * 19.913,
          ) * amplitude
      }

      let pullX = 0
      let pullY = 0
      if (
        !cell.waveGlyph &&
        !cell.peekInSpotlightOnly &&
        distance > 0 &&
        spotlightStrength > 0
      ) {
        const pullDistance = SPOTLIGHT_PULL_DISTANCE * spotlightStrength
        pullX = (deltaX / distance) * pullDistance
        pullY = (deltaY / distance) * pullDistance
      }
      this.context.fillText(
        visibleGlyph,
        cell.x + jiggleX + pullX,
        cell.y + jiggleY + pullY,
      )
    }

  }

  private getSpotlightStrength(cell: Cell) {
    const deltaX = cell.x - this.spotlightX
    const deltaY = cell.y - this.spotlightY
    const distanceSquared = deltaX * deltaX + deltaY * deltaY
    if (distanceSquared >= this.spotlightRadiusSquared) return 0

    return this.getSpotlightStrengthForDistance(Math.sqrt(distanceSquared))
  }

  private getSpotlightStrengthForDistance(distance: number) {
    return (
      1 -
      smoothStep(
        SPOTLIGHT_INNER_STOP,
        SPOTLIGHT_OUTER_STOP,
        distance / this.spotlightRadius,
      )
    )
  }

  private updateSpotlightGeometry() {
    const baseRadius = clamp(
      Math.min(this.layout.width, this.layout.height) *
        SPOTLIGHT_VIEWPORT_RATIO,
      SPOTLIGHT_MIN_RADIUS,
      SPOTLIGHT_MAX_RADIUS,
    )
    this.spotlightX = this.pointer.x * this.layout.width
    this.spotlightY = this.pointer.y * this.layout.height
    this.spotlightRadius = baseRadius * this.spotlightScale
    this.spotlightRadiusSquared = this.spotlightRadius * this.spotlightRadius
  }

  private getSpotlightSnapshot(): SpotlightSnapshot {
    return {
      x: this.spotlightX,
      y: this.spotlightY,
      radius: this.spotlightRadius,
    }
  }

  private setContextFont(fontSize: number) {
    const cachedFontSize =
      Math.round(fontSize / FONT_SIZE_CACHE_STEP) * FONT_SIZE_CACHE_STEP
    let font = this.fontCache.get(cachedFontSize)
    if (!font) {
      font = `${cachedFontSize}px ${FONT_STACK}`
      this.fontCache.set(cachedFontSize, font)
    }
    if (font === this.currentFont) return
    this.context.font = font
    this.currentFont = font
  }

  private setContextFillStyle(fillStyle: string) {
    if (fillStyle === this.currentFillStyle) return
    this.context.fillStyle = fillStyle
    this.currentFillStyle = fillStyle
  }

  private setContextAlpha(alpha: number) {
    if (alpha === this.currentAlpha) return
    this.context.globalAlpha = alpha
    this.currentAlpha = alpha
  }

  private readonly animateJiggle = (now: number) => {
    if (this.destroyed) return

    this.updateSpotlightScale(now)
    this.maybeActivateCursorWord(now)
    const shouldJiggle =
      now - this.lastJiggleAt >= SPOTLIGHT_JIGGLE_INTERVAL_MS
    if (shouldJiggle) {
      this.lastJiggleAt = now
      this.jiggleEpoch += 1
    }
    if (this.spotlightDirty || shouldJiggle) {
      this.redrawSpotlightRegions()
      this.spotlightDirty = false
    }

    this.jiggleFrame = window.requestAnimationFrame(this.animateJiggle)
  }

  private updateSpotlightScale(now: number) {
    const elapsed = Math.min(100, now - this.lastSpotlightAnimationAt)
    this.lastSpotlightAnimationAt = now
    const isIdle = now - this.lastPointerMoveAt >= SPOTLIGHT_IDLE_DELAY_MS
    const targetScale = isIdle
      ? SPOTLIGHT_MAX_SCALE
      : this.spotlightCollapseTarget
    if (this.spotlightScale === targetScale) return

    const duration = isIdle
      ? SPOTLIGHT_EXPAND_DURATION_MS
      : SPOTLIGHT_COLLAPSE_DURATION_MS
    const scaleStep =
      ((SPOTLIGHT_MAX_SCALE - 1) * Math.max(0, elapsed)) / duration
    this.spotlightScale =
      targetScale > this.spotlightScale
        ? Math.min(targetScale, this.spotlightScale + scaleStep)
        : Math.max(targetScale, this.spotlightScale - scaleStep)
    if (isIdle) this.spotlightCollapseTarget = this.spotlightScale
    this.updateSpotlightGeometry()
  }

  private redrawSpotlightRegions() {
    const currentSpotlight = this.getSpotlightSnapshot()
    const previousRegion = this.getSpotlightRegion(this.renderedSpotlight)
    const currentRegion = this.getSpotlightRegion(currentSpotlight)
    const regions = this.regionsOverlap(previousRegion, currentRegion)
      ? [this.mergeRegions(previousRegion, currentRegion)]
      : [previousRegion, currentRegion]

    for (const region of regions) this.redrawRegion(region)
    this.renderedSpotlight = currentSpotlight
  }

  private getSpotlightRegion(spotlight: SpotlightSnapshot): CellRegion {
    const redrawRadius =
      spotlight.radius +
      SPOTLIGHT_PULL_DISTANCE +
      SPOTLIGHT_JIGGLE_AMPLITUDE
    const minimumColumn = clamp(
      Math.floor(
        (spotlight.x - redrawRadius - this.layout.originX) /
          this.layout.pitchX,
      ) - 1,
      0,
      this.layout.columns - 1,
    )
    const maximumColumn = clamp(
      Math.ceil(
        (spotlight.x + redrawRadius - this.layout.originX) /
          this.layout.pitchX,
      ) + 1,
      0,
      this.layout.columns - 1,
    )
    const minimumRow = clamp(
      Math.floor(
        (spotlight.y - redrawRadius - this.layout.originY) /
          this.layout.pitchY,
      ) - 1,
      0,
      this.layout.rows - 1,
    )
    const maximumRow = clamp(
      Math.ceil(
        (spotlight.y + redrawRadius - this.layout.originY) /
          this.layout.pitchY,
      ) + 1,
      0,
      this.layout.rows - 1,
    )

    return { minimumColumn, maximumColumn, minimumRow, maximumRow }
  }

  private regionsOverlap(first: CellRegion, second: CellRegion) {
    return !(
      first.maximumColumn < second.minimumColumn - 1 ||
      second.maximumColumn < first.minimumColumn - 1 ||
      first.maximumRow < second.minimumRow - 1 ||
      second.maximumRow < first.minimumRow - 1
    )
  }

  private mergeRegions(first: CellRegion, second: CellRegion): CellRegion {
    return {
      minimumColumn: Math.min(first.minimumColumn, second.minimumColumn),
      maximumColumn: Math.max(first.maximumColumn, second.maximumColumn),
      minimumRow: Math.min(first.minimumRow, second.minimumRow),
      maximumRow: Math.max(first.maximumRow, second.maximumRow),
    }
  }

  private redrawRegion(region: CellRegion) {
    const {
      minimumColumn,
      maximumColumn,
      minimumRow,
      maximumRow,
    } = region
    this.setContextAlpha(1)
    this.setContextFillStyle(SCREEN_BLUE)
    this.context.fillRect(
      this.layout.originX + minimumColumn * this.layout.pitchX,
      this.layout.originY + minimumRow * this.layout.pitchY,
      (maximumColumn - minimumColumn + 1) * this.layout.pitchX,
      (maximumRow - minimumRow + 1) * this.layout.pitchY,
    )

    for (let row = minimumRow; row <= maximumRow; row += 1) {
      for (let column = minimumColumn; column <= maximumColumn; column += 1) {
        const cell = this.cells[row * this.layout.columns + column]
        if (cell.glyph || cell.waveGlyph) this.drawCell(cell, false)
      }
    }
  }

  private updateFlippingCell(cell: Cell, now: number) {
    if (cell.peekPending) {
      cell.glyph = cell.peekRevealGlyph ?? randomAscii()
      cell.peeksThrough = true
      cell.peekPending = false
      cell.peekRevealGlyph = null
      this.scheduleCellUpdate(
        cell,
        now +
          (cell.peekInSpotlightOnly
            ? randomBetween(CURSOR_WORD_HOLD_MIN_MS, CURSOR_WORD_HOLD_MAX_MS)
            : randomBetween(IDLE_MIN_MS, IDLE_MAX_MS)),
      )
      return
    }

    cell.glyph = randomAscii()
    this.scheduleCellUpdate(
      cell,
      now + randomBetween(IDLE_MIN_MS, IDLE_MAX_MS),
    )

    if (!cell.peeksThrough) return

    cell.peekFlipsRemaining -= 1
    if (cell.peekFlipsRemaining > 0) return

    this.deactivatePeek(cell)
  }

  private seedWelcomeGroups() {
    this.peekGroups.clear()
    this.nextPeekGroupId = 0
    this.activeCursorWordCount = 0
    this.nextCursorWordAt =
      performance.now() +
      randomBetween(
        CURSOR_WORD_INITIAL_DELAY_MIN_MS,
        CURSOR_WORD_INITIAL_DELAY_MAX_MS,
      ) /
        CURSOR_WORD_SPAWN_RATE_MULTIPLIER
    const flippingCellCount = this.cells.filter(
      (cell) => cell.keepsFlipping,
    ).length
    if (flippingCellCount === 0) return

    const targetCharacterCount = Math.max(
      1,
      Math.round(flippingCellCount * BACKGROUND_PEEK_DENSITY),
    )
    const welcomeGroupCount = Math.max(
      1,
      Math.round(
        (targetCharacterCount * BACKGROUND_PEEK_WELCOME_SHARE) /
          BACKGROUND_PEEK_WORD.length,
      ),
    )
    const noiseEventCount = Math.max(
      1,
      targetCharacterCount -
        welcomeGroupCount * BACKGROUND_PEEK_WORD.length,
    )

    for (let group = 0; group < welcomeGroupCount; group += 1) {
      const startDelay =
        group * BACKGROUND_PEEK_INITIAL_STAGGER_MS +
        randomBetween(
          BACKGROUND_PEEK_WELCOME_DELAY_MIN_MS,
          BACKGROUND_PEEK_WELCOME_DELAY_MAX_MS,
        )
      this.activateWelcomeGroup(false, undefined, startDelay)
    }

    for (let event = 0; event < noiseEventCount; event += 1) {
      this.activateNoiseEvent(false)
    }
  }

  private activateWelcomeGroup(
    drawCells = true,
    excludedCell?: Cell,
    startDelay = 0,
  ) {
    const now = performance.now()

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const horizontal = Math.random() < 0.5
      const maximumColumn =
        this.layout.columns - (horizontal ? BACKGROUND_PEEK_WORD.length : 1)
      const maximumRow =
        this.layout.rows - (horizontal ? 1 : BACKGROUND_PEEK_WORD.length)
      if (maximumColumn < 0 || maximumRow < 0) return

      const startColumn = Math.floor(randomBetween(0, maximumColumn + 1))
      const startRow = Math.floor(randomBetween(0, maximumRow + 1))
      const members = [...BACKGROUND_PEEK_WORD].map((_, index) => {
        const column = startColumn + (horizontal ? index : 0)
        const row = startRow + (horizontal ? 0 : index)
        return this.cells[row * this.layout.columns + column]
      })

      if (
        members.some(
          (cell) =>
            cell === excludedCell ||
            !cell.keepsFlipping ||
            cell.peekGroupId !== null ||
            this.getSpotlightStrength(cell) > 0,
        )
      ) {
        continue
      }

      const groupId = this.nextPeekGroupId
      this.nextPeekGroupId += 1
      this.peekGroups.set(groupId, {
        remainingMembers: members.length,
        type: 'welcome',
      })

      for (const [index, cell] of members.entries()) {
        const revealImmediately = index === 0 && startDelay <= 0
        if (revealImmediately) cell.glyph = BACKGROUND_PEEK_WORD[index]
        cell.peeksThrough = revealImmediately
        cell.peekInSpotlightOnly = false
        cell.peekPending = !revealImmediately
        cell.peekRevealGlyph = revealImmediately
          ? null
          : BACKGROUND_PEEK_WORD[index]
        cell.peekFlipsRemaining = randomPeekLifespan()
        cell.peekGroupId = groupId
        this.scheduleCellUpdate(
          cell,
          revealImmediately
            ? now + randomBetween(IDLE_MIN_MS, IDLE_MAX_MS)
            : now +
              startDelay +
              index * BACKGROUND_PEEK_ROLLOUT_INTERVAL_MS,
        )
        if (drawCells && revealImmediately) this.drawCell(cell)
      }
      return
    }
  }

  private activateNoiseEvent(drawCell = true, excludedCell?: Cell) {
    const now = performance.now()

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const candidate =
        this.cells[Math.floor(Math.random() * this.cells.length)]
      if (
        candidate === excludedCell ||
        !candidate.keepsFlipping ||
        candidate.peekGroupId !== null ||
        this.getSpotlightStrength(candidate) > 0
      ) {
        continue
      }

      const groupId = this.nextPeekGroupId
      this.nextPeekGroupId += 1
      this.peekGroups.set(groupId, {
        remainingMembers: 1,
        type: 'noise',
      })
      candidate.glyph = randomAscii()
      candidate.peeksThrough = true
      candidate.peekInSpotlightOnly = false
      candidate.peekPending = false
      candidate.peekRevealGlyph = null
      candidate.peekFlipsRemaining = randomPeekLifespan()
      candidate.peekGroupId = groupId
      this.scheduleCellUpdate(
        candidate,
        now + randomBetween(IDLE_MIN_MS, IDLE_MAX_MS),
      )
      if (drawCell) this.drawCell(candidate)
      return
    }
  }

  private deactivatePeek(cell: Cell) {
    const groupId = cell.peekGroupId
    cell.peeksThrough = false
    cell.peekInSpotlightOnly = false
    cell.peekPending = false
    cell.peekRevealGlyph = null
    cell.peekFlipsRemaining = 0
    cell.peekGroupId = null
    if (groupId === null) return

    const group = this.peekGroups.get(groupId)
    if (!group) return

    group.remainingMembers -= 1
    if (group.remainingMembers > 0) {
      return
    }

    this.peekGroups.delete(groupId)
    if (this.activeTransition?.settledPhase !== 'gallery') {
      if (group.type === 'welcome') {
        this.activateWelcomeGroup(
          true,
          cell,
          randomBetween(
            BACKGROUND_PEEK_REPLACEMENT_DELAY_MIN_MS,
            BACKGROUND_PEEK_REPLACEMENT_DELAY_MAX_MS,
          ),
        )
      } else if (group.type === 'noise') {
        this.activateNoiseEvent(true, cell)
      } else {
        this.activeCursorWordCount = Math.max(
          0,
          this.activeCursorWordCount - 1,
        )
        this.nextCursorWordAt = Math.min(
          this.nextCursorWordAt,
          performance.now() +
            randomBetween(
              CURSOR_WORD_REPLACEMENT_DELAY_MIN_MS,
              CURSOR_WORD_REPLACEMENT_DELAY_MAX_MS,
            ) /
              CURSOR_WORD_SPAWN_RATE_MULTIPLIER,
        )
      }
    }
  }

  private maybeActivateCursorWord(now: number) {
    if (now < this.nextCursorWordAt) return
    if (this.activeCursorWordCount >= CURSOR_WORD_TARGET_COUNT) {
      this.nextCursorWordAt = Number.POSITIVE_INFINITY
      return
    }

    if (this.activateCursorWord(now)) {
      this.nextCursorWordAt =
        this.activeCursorWordCount < CURSOR_WORD_TARGET_COUNT
          ? now +
            randomBetween(
              CURSOR_WORD_STAGGER_MIN_MS,
              CURSOR_WORD_STAGGER_MAX_MS,
            ) /
              CURSOR_WORD_SPAWN_RATE_MULTIPLIER
          : Number.POSITIVE_INFINITY
    } else {
      this.nextCursorWordAt = now + 500
    }
  }

  private activateCursorWord(now: number) {
    const word = CURSOR_WORDS[Math.floor(Math.random() * CURSOR_WORDS.length)]

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const horizontal = Math.random() < 0.65
      const maximumColumn =
        this.layout.columns - (horizontal ? word.length : 1)
      const maximumRow = this.layout.rows - (horizontal ? 1 : word.length)
      if (maximumColumn < 0 || maximumRow < 0) return false
      const startColumn = Math.floor(randomBetween(0, maximumColumn + 1))
      const startRow = Math.floor(randomBetween(0, maximumRow + 1))

      let placementIsBlocked = false
      for (let index = 0; index < word.length; index += 1) {
        const column = startColumn + (horizontal ? index : 0)
        const row = startRow + (horizontal ? 0 : index)
        const cell = this.cells[row * this.layout.columns + column]
        if (!cell.keepsFlipping || cell.peekGroupId !== null) {
          placementIsBlocked = true
          break
        }
      }
      if (placementIsBlocked) continue

      const members: Cell[] = []
      for (let index = 0; index < word.length; index += 1) {
        const column = startColumn + (horizontal ? index : 0)
        const row = startRow + (horizontal ? 0 : index)
        members.push(this.cells[row * this.layout.columns + column])
      }

      const groupId = this.nextPeekGroupId
      this.nextPeekGroupId += 1
      this.peekGroups.set(groupId, {
        remainingMembers: members.length,
        type: 'cursor-word',
      })
      this.activeCursorWordCount += 1

      for (const [index, cell] of members.entries()) {
        const revealImmediately = index === 0
        if (revealImmediately) cell.glyph = word[index]
        cell.peeksThrough = revealImmediately
        cell.peekInSpotlightOnly = true
        cell.peekPending = !revealImmediately
        cell.peekRevealGlyph = revealImmediately ? null : word[index]
        cell.peekFlipsRemaining = randomPeekLifespan()
        cell.peekGroupId = groupId
        this.scheduleCellUpdate(
          cell,
          revealImmediately
            ? now +
              randomBetween(CURSOR_WORD_HOLD_MIN_MS, CURSOR_WORD_HOLD_MAX_MS)
            : now + index * BACKGROUND_PEEK_ROLLOUT_INTERVAL_MS,
        )
        if (revealImmediately && this.isFlippingCellVisible(cell)) {
          this.drawCell(cell)
        }
      }
      this.scheduleAmbientTick()

      return true
    }

    return false
  }

  private cancelAnimationAndIdle() {
    if (this.animationFrame !== null) {
      window.cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
    this.pendingTransitionCells = []
    this.pendingTransitionIndex = 0
    this.activeWaveCells = []
    this.dirtyTransitionCells.clear()

    if (this.idleTimer !== null) {
      window.clearTimeout(this.idleTimer)
      this.idleTimer = null
      this.idleTimerAt = Number.POSITIVE_INFINITY
    }
  }

  private cancelScheduledWork() {
    this.cancelAnimationAndIdle()

    if (this.resizeFrame !== null) {
      window.cancelAnimationFrame(this.resizeFrame)
      this.resizeFrame = null
    }

    if (this.jiggleFrame !== null) {
      window.cancelAnimationFrame(this.jiggleFrame)
      this.jiggleFrame = null
    }
  }
}
