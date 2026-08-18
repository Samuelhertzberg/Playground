interface GridLayout {
  width: number
  height: number
  columns: number
  rows: number
  originX: number
  originY: number
}

interface Cell {
  x: number
  y: number
  glyph: string
  fixedGlyph: string | null
  visible: boolean
  pendingGlyph: string | null
  flipsRemaining: number
  eventId: number | null
  nextUpdateAt: number
}

interface AmbientEvent {
  remainingMembers: number
  type: 'goodbye' | 'noise'
}

const SCREEN_BLUE = '#0000aa'
const SCREEN_WHITE = '#fff'
const FONT_STACK =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'

const CELL_WIDTH = 9
const CELL_HEIGHT = 15
const GAP_X = 2
const GAP_Y = 2
const PITCH_X = CELL_WIDTH + GAP_X
const PITCH_Y = CELL_HEIGHT + GAP_Y
const IDLE_MIN_MS = 400
const IDLE_MAX_MS = 1000
const PEEK_DENSITY = 0.008
const GOODBYE_SHARE = 0.25
const GOODBYE_WORD = 'goodbye'
const GOODBYE_ROLLOUT_INTERVAL_MS = 65
const GOODBYE_DELAY_MIN_MS = 1000
const GOODBYE_DELAY_MAX_MS = 2500
const GOODBYE_REPLACEMENT_MIN_MS = 2000
const GOODBYE_REPLACEMENT_MAX_MS = 6000

const MOBILE_ARTWORK = String.raw`          |\
         /  |
        |  /
        _\|__
       |     |
   __X-|     |-X__
 /~    |     |     \
X      |     |      X
       |     |     /
   _X-----X----X ~
 /     |     |
X      |     |      X
 \     |     |    _/
   X~--|     |-X~~
       |_    |
         ~--_|`

const ARTWORK_LINES = MOBILE_ARTWORK.split('\n')
const ARTWORK_WIDTH = Math.max(...ARTWORK_LINES.map((line) => line.length))
const TRAVELLER_LINES = ['My gallery is too', 'large for you,', 'traveller']
const CONTENT_LINE_GAP = 2

function randomBetween(minimum: number, maximum: number) {
  return minimum + Math.random() * (maximum - minimum)
}

function randomAscii() {
  return String.fromCharCode(Math.floor(randomBetween(33, 127)))
}

function randomPeekLifespan() {
  return Math.floor(randomBetween(2, 5))
}

function createLayout(width: number, height: number): GridLayout {
  const columns = Math.max(1, Math.floor(width / PITCH_X))
  const rows = Math.max(1, Math.floor(height / PITCH_Y))

  return {
    width,
    height,
    columns,
    rows,
    originX: (width - columns * PITCH_X) / 2,
    originY: (height - rows * PITCH_Y) / 2,
  }
}

export class MobileGridEngine {
  private readonly canvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D
  private readonly motionQuery = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  )
  private layout: GridLayout = createLayout(1, 1)
  private cells: Cell[] = []
  private events = new Map<number, AmbientEvent>()
  private nextEventId = 0
  private animationFrame: number | null = null
  private resizeFrame: number | null = null
  private destroyed = false

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D is unavailable')

    this.canvas = canvas
    this.context = context
    window.addEventListener('resize', this.handleResize)
    this.motionQuery.addEventListener('change', this.handleMotionChange)
    this.rebuild()
  }

  destroy() {
    this.destroyed = true
    window.removeEventListener('resize', this.handleResize)
    this.motionQuery.removeEventListener('change', this.handleMotionChange)
    if (this.animationFrame !== null) {
      window.cancelAnimationFrame(this.animationFrame)
    }
    if (this.resizeFrame !== null) window.cancelAnimationFrame(this.resizeFrame)
  }

  private readonly handleResize = () => {
    if (this.resizeFrame !== null) return

    this.resizeFrame = window.requestAnimationFrame(() => {
      this.resizeFrame = null
      this.rebuild()
    })
  }

  private readonly handleMotionChange = () => this.rebuild()

  private rebuild() {
    if (this.animationFrame !== null) {
      window.cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }

    this.configureCanvas()
    this.populateCells()
    this.placeFixedContent()
    this.events.clear()
    this.nextEventId = 0

    if (!this.motionQuery.matches) this.seedAmbientEvents()

    this.drawAll()
    if (!this.motionQuery.matches) {
      this.animationFrame = window.requestAnimationFrame(this.animate)
    }
  }

  private configureCanvas() {
    const bounds = this.canvas.getBoundingClientRect()
    const width = Math.max(1, bounds.width)
    const height = Math.max(1, bounds.height)
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)

    this.canvas.width = Math.round(width * pixelRatio)
    this.canvas.height = Math.round(height * pixelRatio)
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    this.context.font = `${CELL_HEIGHT}px ${FONT_STACK}`
    this.context.textAlign = 'center'
    this.context.textBaseline = 'middle'
    this.layout = createLayout(width, height)
  }

  private populateCells() {
    const cells: Cell[] = []

    for (let row = 0; row < this.layout.rows; row += 1) {
      for (let column = 0; column < this.layout.columns; column += 1) {
        cells.push({
          x: this.layout.originX + (column + 0.5) * PITCH_X,
          y: this.layout.originY + (row + 0.5) * PITCH_Y,
          glyph: randomAscii(),
          fixedGlyph: null,
          visible: false,
          pendingGlyph: null,
          flipsRemaining: 0,
          eventId: null,
          nextUpdateAt: Number.POSITIVE_INFINITY,
        })
      }
    }

    this.cells = cells
  }

  private placeFixedContent() {
    const contentHeight =
      ARTWORK_LINES.length + CONTENT_LINE_GAP + TRAVELLER_LINES.length
    const startRow = Math.max(
      0,
      Math.floor((this.layout.rows - contentHeight) / 2),
    )
    const artworkStartColumn = Math.max(
      0,
      Math.floor((this.layout.columns - ARTWORK_WIDTH) / 2),
    )

    for (const [lineIndex, line] of ARTWORK_LINES.entries()) {
      this.placeFixedLine(line, artworkStartColumn, startRow + lineIndex)
    }

    const travellerStartRow =
      startRow + ARTWORK_LINES.length + CONTENT_LINE_GAP
    for (const [lineIndex, line] of TRAVELLER_LINES.entries()) {
      const startColumn = Math.max(
        0,
        Math.floor((this.layout.columns - line.length) / 2),
      )
      this.placeFixedLine(line, startColumn, travellerStartRow + lineIndex)
    }
  }

  private placeFixedLine(line: string, startColumn: number, row: number) {
    if (row >= this.layout.rows) return

    for (const [lineColumn, glyph] of [...line].entries()) {
      if (glyph === ' ') continue

      const column = startColumn + lineColumn
      if (column >= this.layout.columns) continue

      const cell = this.cells[row * this.layout.columns + column]
      cell.fixedGlyph = glyph
    }
  }

  private seedAmbientEvents() {
    const availableCellCount = this.cells.filter(
      (cell) => cell.fixedGlyph === null,
    ).length
    if (availableCellCount === 0) return

    const targetCharacterCount = Math.max(
      1,
      Math.round(availableCellCount * PEEK_DENSITY),
    )
    const goodbyeGroupCount = Math.max(
      1,
      Math.round(
        (targetCharacterCount * GOODBYE_SHARE) / GOODBYE_WORD.length,
      ),
    )
    const noiseEventCount = Math.max(
      1,
      targetCharacterCount - goodbyeGroupCount * GOODBYE_WORD.length,
    )

    for (let group = 0; group < goodbyeGroupCount; group += 1) {
      const startDelay =
        group * 2500 +
        randomBetween(GOODBYE_DELAY_MIN_MS, GOODBYE_DELAY_MAX_MS)
      this.activateGoodbye(false, undefined, startDelay)
    }

    for (let event = 0; event < noiseEventCount; event += 1) {
      this.activateNoise(false)
    }
  }

  private activateGoodbye(
    drawCells = true,
    excludedCell?: Cell,
    startDelay = 0,
  ) {
    const now = performance.now()

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const horizontal = Math.random() < 0.5
      const maximumColumn =
        this.layout.columns - (horizontal ? GOODBYE_WORD.length : 1)
      const maximumRow =
        this.layout.rows - (horizontal ? 1 : GOODBYE_WORD.length)
      if (maximumColumn < 0 || maximumRow < 0) return

      const startColumn = Math.floor(randomBetween(0, maximumColumn + 1))
      const startRow = Math.floor(randomBetween(0, maximumRow + 1))
      const members = [...GOODBYE_WORD].map((glyph, index) => {
        const column = startColumn + (horizontal ? index : 0)
        const row = startRow + (horizontal ? 0 : index)
        return {
          cell: this.cells[row * this.layout.columns + column],
          glyph,
          index,
        }
      })

      if (
        members.some(
          ({ cell }) =>
            cell === excludedCell ||
            cell.fixedGlyph !== null ||
            cell.eventId !== null,
        )
      ) {
        continue
      }

      const eventId = this.nextEventId
      this.nextEventId += 1
      this.events.set(eventId, {
        remainingMembers: members.length,
        type: 'goodbye',
      })

      for (const { cell, glyph, index } of members) {
        const revealImmediately = index === 0 && startDelay <= 0
        cell.glyph = revealImmediately ? glyph : randomAscii()
        cell.visible = revealImmediately
        cell.pendingGlyph = revealImmediately ? null : glyph
        cell.flipsRemaining = randomPeekLifespan()
        cell.eventId = eventId
        cell.nextUpdateAt = revealImmediately
          ? now + randomBetween(IDLE_MIN_MS, IDLE_MAX_MS)
          : now + startDelay + index * GOODBYE_ROLLOUT_INTERVAL_MS
        if (drawCells && revealImmediately) this.drawCell(cell)
      }
      return
    }
  }

  private activateNoise(drawCell = true, excludedCell?: Cell) {
    const now = performance.now()

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const cell = this.cells[Math.floor(Math.random() * this.cells.length)]
      if (
        cell === excludedCell ||
        cell.fixedGlyph !== null ||
        cell.eventId !== null
      ) {
        continue
      }

      const eventId = this.nextEventId
      this.nextEventId += 1
      this.events.set(eventId, { remainingMembers: 1, type: 'noise' })
      cell.glyph = randomAscii()
      cell.visible = true
      cell.pendingGlyph = null
      cell.flipsRemaining = randomPeekLifespan()
      cell.eventId = eventId
      cell.nextUpdateAt = now + randomBetween(IDLE_MIN_MS, IDLE_MAX_MS)
      if (drawCell) this.drawCell(cell)
      return
    }
  }

  private readonly animate = (now: number) => {
    if (this.destroyed || this.motionQuery.matches) return

    for (const cell of this.cells) {
      if (cell.eventId === null || now < cell.nextUpdateAt) continue
      this.updateAmbientCell(cell, now)
    }

    this.animationFrame = window.requestAnimationFrame(this.animate)
  }

  private updateAmbientCell(cell: Cell, now: number) {
    if (cell.pendingGlyph !== null) {
      cell.glyph = cell.pendingGlyph
      cell.pendingGlyph = null
      cell.visible = true
      cell.nextUpdateAt = now + randomBetween(IDLE_MIN_MS, IDLE_MAX_MS)
      this.drawCell(cell)
      return
    }

    cell.glyph = randomAscii()
    cell.flipsRemaining -= 1
    if (cell.flipsRemaining > 0) {
      cell.nextUpdateAt = now + randomBetween(IDLE_MIN_MS, IDLE_MAX_MS)
      this.drawCell(cell)
      return
    }

    this.deactivateCell(cell)
  }

  private deactivateCell(cell: Cell) {
    const eventId = cell.eventId
    cell.visible = false
    cell.pendingGlyph = null
    cell.flipsRemaining = 0
    cell.eventId = null
    cell.nextUpdateAt = Number.POSITIVE_INFINITY
    this.drawCell(cell)
    if (eventId === null) return

    const event = this.events.get(eventId)
    if (!event) return

    event.remainingMembers -= 1
    if (event.remainingMembers > 0) return

    this.events.delete(eventId)
    if (event.type === 'goodbye') {
      this.activateGoodbye(
        true,
        cell,
        randomBetween(
          GOODBYE_REPLACEMENT_MIN_MS,
          GOODBYE_REPLACEMENT_MAX_MS,
        ),
      )
    } else {
      this.activateNoise(true, cell)
    }
  }

  private drawAll() {
    this.context.globalAlpha = 1
    this.context.fillStyle = SCREEN_BLUE
    this.context.fillRect(0, 0, this.layout.width, this.layout.height)
    for (const cell of this.cells) {
      if (cell.fixedGlyph !== null || cell.visible) this.drawCell(cell, false)
    }
  }

  private drawCell(cell: Cell, clear = true) {
    if (clear) {
      this.context.globalAlpha = 1
      this.context.fillStyle = SCREEN_BLUE
      this.context.fillRect(
        cell.x - PITCH_X / 2,
        cell.y - PITCH_Y / 2,
        PITCH_X,
        PITCH_Y,
      )
    }

    const glyph = cell.fixedGlyph ?? (cell.visible ? cell.glyph : null)
    if (glyph === null) return

    this.context.fillStyle = SCREEN_WHITE
    this.context.globalAlpha = 1
    this.context.fillText(glyph, cell.x, cell.y)
  }
}
