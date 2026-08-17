export type WordOrientation = 'horizontal' | 'vertical'

export interface BitmapMask {
  width: number
  height: number
  filled: ReadonlySet<string>
}

const FONT_FAMILY = '"Jersey 10"'
const LOGICAL_FONT_SIZE = 20
const RASTER_SCALE = 4
const LETTER_GAP = 2
const COVERAGE_THRESHOLD = 0.2
const maskCache = new Map<string, BitmapMask>()

function rasterizeText(text: string): BitmapMask {
  const measurementCanvas = document.createElement('canvas')
  const measurementContext = measurementCanvas.getContext('2d')
  if (!measurementContext) return { width: 0, height: 0, filled: new Set() }

  const rasterFontSize = LOGICAL_FONT_SIZE * RASTER_SCALE
  measurementContext.font = `${rasterFontSize}px ${FONT_FAMILY}`
  const metrics = measurementContext.measureText(text)
  const ascent = Math.ceil(
    metrics.actualBoundingBoxAscent || rasterFontSize * 0.8,
  )
  const descent = Math.ceil(
    metrics.actualBoundingBoxDescent || rasterFontSize * 0.2,
  )
  const left = Math.ceil(metrics.actualBoundingBoxLeft)
  const right = Math.ceil(metrics.actualBoundingBoxRight)
  const padding = RASTER_SCALE * 2
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, left + right + padding * 2)
  canvas.height = Math.max(1, ascent + descent + padding * 2)

  const context = canvas.getContext('2d')
  if (!context) return { width: 0, height: 0, filled: new Set() }

  context.font = `${rasterFontSize}px ${FONT_FAMILY}`
  context.fillStyle = '#fff'
  context.textBaseline = 'alphabetic'
  context.fillText(text, padding + left, padding + ascent)

  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  const logicalWidth = Math.ceil(canvas.width / RASTER_SCALE)
  const logicalHeight = Math.ceil(canvas.height / RASTER_SCALE)
  const coverageThreshold =
    text.toUpperCase() === 'G' ? 0.34 : COVERAGE_THRESHOLD
  const sampled = new Set<string>()

  for (let row = 0; row < logicalHeight; row += 1) {
    for (let column = 0; column < logicalWidth; column += 1) {
      let alpha = 0
      let sampleCount = 0

      for (let sampleY = 0; sampleY < RASTER_SCALE; sampleY += 1) {
        const pixelY = row * RASTER_SCALE + sampleY
        if (pixelY >= canvas.height) continue

        for (let sampleX = 0; sampleX < RASTER_SCALE; sampleX += 1) {
          const pixelX = column * RASTER_SCALE + sampleX
          if (pixelX >= canvas.width) continue

          alpha += image.data[(pixelY * canvas.width + pixelX) * 4 + 3]
          sampleCount += 1
        }
      }

      if (sampleCount > 0 && alpha / (sampleCount * 255) >= coverageThreshold) {
        sampled.add(`${column}:${row}`)
      }
    }
  }

  if (sampled.size === 0) {
    return { width: 0, height: 0, filled: sampled }
  }

  let minimumColumn = Number.POSITIVE_INFINITY
  let maximumColumn = Number.NEGATIVE_INFINITY
  let minimumRow = Number.POSITIVE_INFINITY
  let maximumRow = Number.NEGATIVE_INFINITY

  for (const coordinate of sampled) {
    const [column, row] = coordinate.split(':').map(Number)
    minimumColumn = Math.min(minimumColumn, column)
    maximumColumn = Math.max(maximumColumn, column)
    minimumRow = Math.min(minimumRow, row)
    maximumRow = Math.max(maximumRow, row)
  }

  const filled = new Set<string>()
  for (const coordinate of sampled) {
    const [column, row] = coordinate.split(':').map(Number)
    filled.add(`${column - minimumColumn}:${row - minimumRow}`)
  }

  return {
    width: maximumColumn - minimumColumn + 1,
    height: maximumRow - minimumRow + 1,
    filled,
  }
}

function stackLetters(word: string): BitmapMask {
  const letters = [...word].map(rasterizeText)
  const width = Math.max(...letters.map((letter) => letter.width), 0)
  const height =
    letters.reduce((total, letter) => total + letter.height, 0) +
    Math.max(0, letters.length - 1) * LETTER_GAP
  const filled = new Set<string>()
  let offsetY = 0

  for (const letter of letters) {
    const offsetX = Math.floor((width - letter.width) / 2)

    for (const coordinate of letter.filled) {
      const [column, row] = coordinate.split(':').map(Number)
      filled.add(`${offsetX + column}:${offsetY + row}`)
    }

    offsetY += letter.height + LETTER_GAP
  }

  return { width, height, filled }
}

function spaceLetters(word: string): BitmapMask {
  const letters = [...word].map(rasterizeText)
  const width =
    letters.reduce((total, letter) => total + letter.width, 0) +
    Math.max(0, letters.length - 1) * LETTER_GAP
  const height = Math.max(...letters.map((letter) => letter.height), 0)
  const filled = new Set<string>()
  let offsetX = 0

  for (const letter of letters) {
    const offsetY = height - letter.height

    for (const coordinate of letter.filled) {
      const [column, row] = coordinate.split(':').map(Number)
      filled.add(`${offsetX + column}:${offsetY + row}`)
    }

    offsetX += letter.width + LETTER_GAP
  }

  return { width, height, filled }
}

export function createWordMask(
  word: string,
  orientation: WordOrientation,
): BitmapMask {
  const normalizedWord = word.toUpperCase()
  const cacheKey = `${orientation}:${normalizedWord}`
  const cached = maskCache.get(cacheKey)
  if (cached) return cached

  const mask =
    orientation === 'vertical'
      ? stackLetters(normalizedWord)
      : spaceLetters(normalizedWord)
  maskCache.set(cacheKey, mask)
  return mask
}

export function getWordDimensions(
  word: string,
  orientation: WordOrientation,
) {
  const { width, height } = createWordMask(word, orientation)
  return { width, height }
}
