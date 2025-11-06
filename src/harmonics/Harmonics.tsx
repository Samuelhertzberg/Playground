import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Typography,
} from "@mui/material";

const TWO_PI = 2 * Math.PI;
const NUM_CONTROL_POINTS = 10;
const CONTROL_POINT_RADIUS = 8;
const FADE_DELAY = 1500;
const FADE_SPEED = 0.03;

type Oscillator = {
  index: number;
  harmonic: number;
  period: number;
  initialPhase: number;
  phase: number;
  sineValue: number;
  cosValue: number;
  update: (currentTime: number) => void;
};

type CurvePoint = {
  x: number;
  y: number;
};

const Harmonics = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fps, setFps] = useState(0);
  const [controlsOpen, setControlsOpen] = useState(false);

  // Control states
  const [speed, setSpeed] = useState(1000);
  const [oscillatorCount, setOscillatorCount] = useState(50);
  const [harmonicSpan, setHarmonicSpan] = useState(0.1);
  const [phaseOffset, setPhaseOffset] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [visualizationType, setVisualizationType] = useState<string>("regular");
  const [fadeTrails, setFadeTrails] = useState(false);
  const [colorCycling, setColorCycling] = useState(false);
  const [cyclingSpeed, setCyclingSpeed] = useState(83);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Simulation state
    let oscillators: Oscillator[] = [];
    let numOscillators = 100;
    let visualizationRadius = 2;
    let basePeriod = speed;
    let harmonicSpanValue = harmonicSpan;
    let phaseOffsetValue = phaseOffset;
    let internalTime = 0;
    let lastFrameTime = Date.now();
    let isHorizontal = isFlipped;
    let useFadeTrails = fadeTrails;
    let vizType = visualizationType;
    let frameCount = 0;
    let fpsLastTime = Date.now();
    let colorBaseHue = 0;
    let secondColorOffset = 30;
    let useColorCycling = colorCycling;
    let color_t = 0;
    let cycleDuration = 300000;

    // Curve mode state
    let curveControlPoints: CurvePoint[] = [];
    let draggedPoint: number | null = null;
    let isDragging = false;
    let mouseActivityTimer: number | null = null;
    let curveOpacity = 1.0;
    let isMouseActive = false;

    // Cached dimensions
    const cachedDimensions = { width: 0, height: 0, centerX: 0, centerY: 0 };
    const cachedSpacing = { oscillatorSpacing: 0, visualizationRadius: 0 };

    // Oscillator class
    class OscillatorClass implements Oscillator {
      index: number;
      harmonic: number;
      period: number;
      initialPhase: number;
      phase: number;
      sineValue: number;
      cosValue: number;

      constructor(index: number, basePeriod: number, harmonicStep: number, initialPhase = 0) {
        this.index = index;
        this.harmonic = 1 + index * harmonicStep;
        this.period = basePeriod / this.harmonic;
        this.initialPhase = initialPhase;
        this.phase = 0;
        this.sineValue = 0;
        this.cosValue = 0;
      }

      update(currentTime: number) {
        this.phase = ((currentTime % this.period) / this.period) * TWO_PI + this.initialPhase;
        this.sineValue = Math.sin(this.phase);
        this.cosValue = Math.cos(this.phase);
      }
    }

    const calculateVisualizationSize = () => {
      const width = canvas.width;
      const height = canvas.height;

      if (isHorizontal) {
        const spacing = height / (numOscillators + 1);
        visualizationRadius = spacing / 2;
      } else {
        const spacing = width / (numOscillators + 1);
        visualizationRadius = spacing / 2;
      }

      visualizationRadius = Math.max(visualizationRadius, 1);
    };

    const initializeOscillators = () => {
      oscillators = [];
      const harmonicStep = numOscillators > 1 ? harmonicSpanValue / (numOscillators - 1) : 0;
      for (let i = 0; i < numOscillators; i++) {
        const initialPhase = i * phaseOffsetValue * TWO_PI;
        oscillators.push(new OscillatorClass(i, basePeriod, harmonicStep, initialPhase));
      }
    };

    const updateCachedDimensions = () => {
      const needsUpdate =
        cachedDimensions.width !== canvas.width || cachedDimensions.height !== canvas.height;

      if (needsUpdate) {
        cachedDimensions.width = canvas.width;
        cachedDimensions.height = canvas.height;
        cachedDimensions.centerX = canvas.width * 0.5;
        cachedDimensions.centerY = canvas.height * 0.5;
      }

      if (isHorizontal) {
        cachedSpacing.oscillatorSpacing = cachedDimensions.height / (numOscillators + 1);
      } else {
        cachedSpacing.oscillatorSpacing = cachedDimensions.width / (numOscillators + 1);
      }
    };

    const initializeCurveControlPoints = () => {
      curveControlPoints = [];
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height * 0.5;
      const spacing = width / (NUM_CONTROL_POINTS + 1);

      for (let i = 0; i < NUM_CONTROL_POINTS; i++) {
        curveControlPoints.push({
          x: spacing * (i + 1),
          y: centerY + Math.sin(i * 0.5) * 50,
        });
      }
    };

    const resetCurveToStraightLine = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height * 0.5;
      const spacing = width / (NUM_CONTROL_POINTS + 1);

      for (let i = 0; i < curveControlPoints.length; i++) {
        curveControlPoints[i].x = spacing * (i + 1);
        curveControlPoints[i].y = centerY;
      }
    };

    const scaleValue = (value: number, inMin: number, inMax: number, outMin: number, outMax: number) => {
      return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
    };

    const catmullRomSpline = (t: number, p0: number, p1: number, p2: number, p3: number) => {
      const t2 = t * t;
      const t3 = t2 * t;
      return (
        0.5 *
        (2 * p1 +
          (-p0 + p2) * t +
          (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
          (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
      );
    };

    const getPointOnCurve = (t: number) => {
      if (curveControlPoints.length < 2) return { x: 0, y: 0, tangent: { x: 1, y: 0 } };

      const segmentCount = curveControlPoints.length - 1;
      const segment = Math.min(Math.floor(t * segmentCount), segmentCount - 1);
      const localT = t * segmentCount - segment;

      const p0 = curveControlPoints[Math.max(0, segment - 1)];
      const p1 = curveControlPoints[segment];
      const p2 = curveControlPoints[Math.min(curveControlPoints.length - 1, segment + 1)];
      const p3 = curveControlPoints[Math.min(curveControlPoints.length - 1, segment + 2)];

      const x = catmullRomSpline(localT, p0.x, p1.x, p2.x, p3.x);
      const y = catmullRomSpline(localT, p0.y, p1.y, p2.y, p3.y);

      const delta = 0.01;
      const t1 = Math.max(0, t - delta);
      const t2 = Math.min(1, t + delta);

      const seg1 = Math.floor(t1 * segmentCount);
      const seg2 = Math.floor(t2 * segmentCount);

      const p1_x = catmullRomSpline(
        t1 * segmentCount - seg1,
        curveControlPoints[Math.max(0, seg1 - 1)].x,
        curveControlPoints[seg1].x,
        curveControlPoints[Math.min(curveControlPoints.length - 1, seg1 + 1)].x,
        curveControlPoints[Math.min(curveControlPoints.length - 1, seg1 + 2)].x
      );
      const p1_y = catmullRomSpline(
        t1 * segmentCount - seg1,
        curveControlPoints[Math.max(0, seg1 - 1)].y,
        curveControlPoints[seg1].y,
        curveControlPoints[Math.min(curveControlPoints.length - 1, seg1 + 1)].y,
        curveControlPoints[Math.min(curveControlPoints.length - 1, seg1 + 2)].y
      );

      const p2_x = catmullRomSpline(
        t2 * segmentCount - seg2,
        curveControlPoints[Math.max(0, seg2 - 1)].x,
        curveControlPoints[seg2].x,
        curveControlPoints[Math.min(curveControlPoints.length - 1, seg2 + 1)].x,
        curveControlPoints[Math.min(curveControlPoints.length - 1, seg2 + 2)].x
      );
      const p2_y = catmullRomSpline(
        t2 * segmentCount - seg2,
        curveControlPoints[Math.max(0, seg2 - 1)].y,
        curveControlPoints[seg2].y,
        curveControlPoints[Math.min(curveControlPoints.length - 1, seg2 + 1)].y,
        curveControlPoints[Math.min(curveControlPoints.length - 1, seg2 + 2)].y
      );

      const tangentX = p2_x - p1_x;
      const tangentY = p2_y - p1_y;
      const tangentLength = Math.sqrt(tangentX * tangentX + tangentY * tangentY);

      return {
        x: x,
        y: y,
        tangent: {
          x: tangentX / tangentLength,
          y: tangentY / tangentLength,
        },
      };
    };

    // Color functions
    const hslToHex = (h: number, s: number, l: number) => {
      l /= 100;
      const a = (s * Math.min(l, 1 - l)) / 100;
      const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color)
          .toString(16)
          .padStart(2, "0");
      };
      return `#${f(0)}${f(8)}${f(4)}`;
    };

    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
          }
        : { r: 255, g: 255, b: 255 };
    };

    const getOscillatorColor = () => {
      const hue = (colorBaseHue + secondColorOffset + color_t) % 360;
      const hex = hslToHex(hue, 100, 50);
      return hexToRgb(hex);
    };

    const getBackgroundColor = () => {
      const hue = (colorBaseHue + color_t) % 360;
      const hex = hslToHex(hue, 100, 10);
      return hexToRgb(hex);
    };

    const drawBackground = () => {
      const bgOpacity = useFadeTrails ? 0.05 : 1.0;
      const bgRgb = getBackgroundColor();
      ctx.fillStyle = `rgba(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}, ${bgOpacity})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const updateTime = () => {
      const currentFrameTime = Date.now();
      const deltaTime = currentFrameTime - lastFrameTime;
      internalTime += deltaTime;
      lastFrameTime = currentFrameTime;

      if (useColorCycling) {
        const progressPerFrame = (deltaTime / cycleDuration) * 360;
        color_t = (color_t + progressPerFrame) % 360;
      }

      frameCount++;
      if (currentFrameTime - fpsLastTime >= 1000) {
        const currentFPS = Math.round((frameCount * 1000) / (currentFrameTime - fpsLastTime));
        setFps(currentFPS);
        frameCount = 0;
        fpsLastTime = currentFrameTime;
      }
    };

    const renderBall = (x: number, y: number, radius: number, opacity: number) => {
      const rgb = getOscillatorColor();
      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TWO_PI);
      ctx.fill();
    };

    const renderBar = (x: number, y: number, width: number, height: number, opacity: number) => {
      const rgb = getOscillatorColor();
      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
      ctx.fillRect(x - width / 2, y - height / 2, width, height);
    };

    // Visualization renderers (abbreviated for space - implementing key ones)
    const renderBallOscillator = (oscillator: Oscillator, index: number) => {
      const opacity = oscillator.cosValue * 0.4 + 0.6;
      const sizeMultiplier = oscillator.cosValue * 0.15 + 0.85;
      const radius = visualizationRadius * sizeMultiplier;

      let x, y;

      if (isHorizontal) {
        const leftLineX = cachedDimensions.width * 0.25;
        const rightLineX = cachedDimensions.width * 0.75;
        const oscillationWidth = rightLineX - leftLineX - 2 * visualizationRadius;
        const centerX = (leftLineX + rightLineX) * 0.5;

        x = centerX + (oscillator.sineValue * oscillationWidth) * 0.5;
        y = cachedSpacing.oscillatorSpacing * (index + 1);
      } else {
        const topLineY = cachedDimensions.height * 0.25;
        const bottomLineY = cachedDimensions.height * 0.75;
        const oscillationHeight = bottomLineY - topLineY;
        const centerY = (topLineY + bottomLineY) * 0.5;
        const adjustedOscillationHeight = oscillationHeight - 2 * visualizationRadius;

        x = cachedSpacing.oscillatorSpacing * (index + 1);
        y = centerY + (oscillator.sineValue * adjustedOscillationHeight) * 0.5;
      }

      renderBall(x, y, radius, opacity);
    };

    const renderBarOscillator = (oscillator: Oscillator, index: number) => {
      const opacity = (oscillator.cosValue + 1) * 0.4 + 0.2;
      let x, y, barWidth, barHeight;

      if (isHorizontal) {
        const centerX = canvas.width * 0.5;
        const oscillatorSpacing = canvas.height / (numOscillators + 1);
        const baseSize = visualizationRadius * 2;
        const stretch = Math.abs(oscillator.sineValue) * (canvas.width / 2);

        x = centerX;
        y = oscillatorSpacing * (index + 1);
        barWidth = baseSize + stretch;
        barHeight = baseSize;
      } else {
        const centerY = canvas.height * 0.5;
        const oscillatorSpacing = canvas.width / (numOscillators + 1);
        const baseSize = visualizationRadius * 2;
        const stretch = Math.abs(oscillator.sineValue) * (canvas.height / 2);

        x = oscillatorSpacing * (index + 1);
        y = centerY;
        barWidth = baseSize;
        barHeight = baseSize + stretch;
      }

      renderBar(x, y, barWidth, barHeight, opacity);
    };

    const renderSpinningOscillator = (oscillator: Oscillator, index: number) => {
      const centerX = cachedDimensions.centerX;
      const centerY = cachedDimensions.centerY;

      const maxRadius = Math.min(cachedDimensions.width, cachedDimensions.height) * 0.4;
      let distanceFromCenter;

      if (isHorizontal) {
        const normalizedIndex = index / (numOscillators - 1);
        distanceFromCenter = normalizedIndex * maxRadius;
      } else {
        const normalizedIndex = 1 - index / (numOscillators - 1);
        distanceFromCenter = normalizedIndex * maxRadius;
      }

      const baseSize = scaleValue(numOscillators, 5, 1000, 15, 3);
      let opacity, ballRadius;

      if (isHorizontal) {
        const distanceFactor = distanceFromCenter / maxRadius;
        opacity = 0.1 + distanceFactor * 0.9;
        ballRadius = baseSize * (0.2 + distanceFactor * 0.8);
      } else {
        const distanceFactor = 1 - distanceFromCenter / maxRadius;
        opacity = 0.1 + distanceFactor * 0.9;
        ballRadius = baseSize * (0.2 + distanceFactor * 0.8);
      }

      const rgb = getOscillatorColor();
      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;

      for (let ball = 0; ball < 3; ball++) {
        const baseAngle = (ball / 3) * TWO_PI;
        const angle = baseAngle + oscillator.phase;

        const ballX = centerX + Math.cos(angle) * distanceFromCenter;
        const ballY = centerY + Math.sin(angle) * distanceFromCenter;

        ctx.beginPath();
        ctx.arc(ballX, ballY, ballRadius, 0, TWO_PI);
        ctx.fill();
      }
    };

    const renderRotationalOscillator = (oscillator: Oscillator, index: number) => {
      let originX, originY, baseAngle;

      if (isHorizontal) {
        originX = cachedDimensions.centerX;
        originY = cachedDimensions.centerY;

        const upAngle = (3 * Math.PI) / 2;
        const downAngle = Math.PI / 2;

        if (index === 0) {
          baseAngle = upAngle;
        } else if (index === numOscillators - 1) {
          baseAngle = downAngle;
        } else {
          const isLeft = index % 2 === 1;
          const middleCount = numOscillators - 2;

          if (isLeft) {
            const leftCount = Math.ceil(middleCount / 2);
            const leftPosition = (index - 1) / 2;
            const progress = (leftPosition + 1) / (leftCount + 1);
            baseAngle = upAngle - progress * Math.PI;
          } else {
            const rightCount = Math.floor(middleCount / 2);
            const rightPosition = (index - 2) / 2;
            const progress = (rightPosition + 1) / (rightCount + 1);
            baseAngle = upAngle + progress * Math.PI;
          }
        }
      } else {
        originX = cachedDimensions.centerX;
        originY = cachedDimensions.height - 50;
        const angleRange = Math.PI;
        baseAngle = (index / (numOscillators - 1)) * angleRange;
      }

      const maxRadius = isHorizontal
        ? Math.min(cachedDimensions.width, cachedDimensions.height) * 0.4
        : Math.min(cachedDimensions.width * 0.45, cachedDimensions.height * 0.8);
      const minRadius = 30;

      const radiusRange = maxRadius - minRadius;
      const normalizedSine = (oscillator.sineValue + 1) * 0.5;
      const currentRadius = minRadius + normalizedSine * radiusRange;

      let ballX, ballY;
      if (isHorizontal) {
        ballX = originX + Math.cos(baseAngle) * currentRadius;
        ballY = originY + Math.sin(baseAngle) * currentRadius;
      } else {
        ballX = originX + Math.cos(baseAngle) * currentRadius;
        ballY = originY - Math.sin(baseAngle) * currentRadius;
      }

      const opacity = oscillator.cosValue * 0.3 + 0.7;
      const sizeMultiplier = oscillator.cosValue * 0.2 + 0.8;
      const baseSize = scaleValue(numOscillators, 5, 1000, 12, 4);
      const ballRadius = baseSize * sizeMultiplier;

      const rgb = getOscillatorColor();
      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
      ctx.beginPath();
      ctx.arc(ballX, ballY, ballRadius, 0, TWO_PI);
      ctx.fill();
    };

    const renderCurveOscillator = (oscillator: Oscillator, index: number) => {
      const t = index / (numOscillators - 1);
      const curvePoint = getPointOnCurve(t);

      const perpX = -curvePoint.tangent.y;
      const perpY = curvePoint.tangent.x;

      const maxOscillation = Math.min(canvas.width, canvas.height) * 0.15;
      const oscillationDist = oscillator.sineValue * maxOscillation;

      const x = curvePoint.x + perpX * oscillationDist;
      const y = curvePoint.y + perpY * oscillationDist;

      const opacity = oscillator.cosValue * 0.4 + 0.6;
      const sizeMultiplier = oscillator.cosValue * 0.15 + 0.85;
      const baseSize = scaleValue(numOscillators, 5, 1000, 10, 3);
      const radius = baseSize * sizeMultiplier;

      renderBall(x, y, radius, opacity);
    };

    const drawCurvePath = () => {
      ctx.strokeStyle = `rgba(100, 100, 100, ${0.5 * curveOpacity})`;
      ctx.lineWidth = 2;
      ctx.beginPath();

      const steps = 200;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const point = getPointOnCurve(t);
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
      ctx.stroke();

      for (let i = 0; i < curveControlPoints.length; i++) {
        const point = curveControlPoints[i];

        if (isDragging && draggedPoint === i) {
          ctx.fillStyle = `rgba(255, 255, 255, ${0.3 * curveOpacity})`;
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${0.1 * curveOpacity})`;
        }
        ctx.beginPath();
        ctx.arc(point.x, point.y, CONTROL_POINT_RADIUS * 2, 0, TWO_PI);
        ctx.fill();

        const pointColor = isDragging && draggedPoint === i ? 255 : 170;
        ctx.fillStyle = `rgba(${pointColor}, ${pointColor}, ${pointColor}, ${curveOpacity})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, CONTROL_POINT_RADIUS, 0, TWO_PI);
        ctx.fill();

        ctx.strokeStyle = `rgba(51, 51, 51, ${curveOpacity})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };

    const renderOscillator = (oscillator: Oscillator, index: number) => {
      switch (vizType) {
        case "bars":
          renderBarOscillator(oscillator, index);
          break;
        case "spinning":
          renderSpinningOscillator(oscillator, index);
          break;
        case "rotational":
          renderRotationalOscillator(oscillator, index);
          break;
        case "curve":
          renderCurveOscillator(oscillator, index);
          break;
        case "regular":
        default:
          renderBallOscillator(oscillator, index);
          break;
      }
    };

    const renderAllOscillators = () => {
      if (vizType === "curve") {
        drawCurvePath();
      }

      for (let i = 0; i < oscillators.length; i++) {
        renderOscillator(oscillators[i], i);
      }
    };

    const animate = () => {
      updateCachedDimensions();
      drawBackground();
      calculateVisualizationSize();
      updateTime();

      if (vizType === "curve") {
        if (!isMouseActive && curveOpacity > 0) {
          curveOpacity = Math.max(0, curveOpacity - FADE_SPEED);
        }
      }

      for (let oscillator of oscillators) {
        oscillator.update(internalTime);
      }

      renderAllOscillators();
      requestAnimationFrame(animate);
    };

    // Mouse handlers for curve mode
    const getMousePos = (evt: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top,
      };
    };

    const findControlPointAtPosition = (x: number, y: number) => {
      for (let i = 0; i < curveControlPoints.length; i++) {
        const point = curveControlPoints[i];
        const dx = x - point.x;
        const dy = y - point.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= CONTROL_POINT_RADIUS * 2) {
          return i;
        }
      }
      return -1;
    };

    const resetMouseActivity = () => {
      if (vizType !== "curve") return;

      isMouseActive = true;
      curveOpacity = 1.0;

      if (mouseActivityTimer) {
        clearTimeout(mouseActivityTimer);
      }

      mouseActivityTimer = setTimeout(() => {
        isMouseActive = false;
      }, FADE_DELAY);
    };

    const handleMouseDown = (evt: MouseEvent) => {
      if (vizType !== "curve") return;
      resetMouseActivity();
      const mousePos = getMousePos(evt);
      const pointIndex = findControlPointAtPosition(mousePos.x, mousePos.y);
      if (pointIndex >= 0) {
        draggedPoint = pointIndex;
        isDragging = true;
        canvas.style.cursor = "grabbing";
      }
    };

    const handleMouseMove = (evt: MouseEvent) => {
      if (vizType !== "curve") return;
      resetMouseActivity();
      const mousePos = getMousePos(evt);

      if (isDragging && draggedPoint !== null) {
        curveControlPoints[draggedPoint].x = mousePos.x;
        curveControlPoints[draggedPoint].y = mousePos.y;
      } else {
        const pointIndex = findControlPointAtPosition(mousePos.x, mousePos.y);
        canvas.style.cursor = pointIndex >= 0 ? "grab" : "default";
      }
    };

    const handleMouseUp = (evt: MouseEvent) => {
      if (vizType !== "curve") return;
      resetMouseActivity();
      isDragging = false;
      draggedPoint = null;
      const mousePos = getMousePos(evt);
      const pointIndex = findControlPointAtPosition(mousePos.x, mousePos.y);
      canvas.style.cursor = pointIndex >= 0 ? "grab" : "default";
    };

    const handleDoubleClick = (evt: MouseEvent) => {
      if (vizType !== "curve") return;
      const mousePos = getMousePos(evt);
      const pointIndex = findControlPointAtPosition(mousePos.x, mousePos.y);
      if (pointIndex >= 0) {
        resetCurveToStraightLine();
        resetMouseActivity();
      }
    };

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      calculateVisualizationSize();
      initializeCurveControlPoints();
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("dblclick", handleDoubleClick);
    window.addEventListener("resize", handleResize);

    // Update from props
    basePeriod = speed;
    harmonicSpanValue = harmonicSpan;
    phaseOffsetValue = phaseOffset;
    isHorizontal = isFlipped;
    useFadeTrails = fadeTrails;
    vizType = visualizationType;
    useColorCycling = colorCycling;

    // Calculate oscillator count from slider
    const minOscillators = 5;
    const maxOscillators = 1000;
    const logMin = Math.log(minOscillators);
    const logMax = Math.log(maxOscillators);
    const scale = (logMax - logMin) / 100;
    numOscillators = Math.round(Math.exp(logMin + scale * oscillatorCount));

    // Calculate cycle duration from slider
    const minDuration = 10000;
    const maxDuration = 600000;
    const logMinDur = Math.log(minDuration);
    const logMaxDur = Math.log(maxDuration);
    const scaleDur = (logMaxDur - logMinDur) / 100;
    const invertedValue = 100 - cyclingSpeed;
    cycleDuration = Math.round(Math.exp(logMinDur + scaleDur * (invertedValue / 100) * 100));

    updateCachedDimensions();
    initializeCurveControlPoints();
    initializeOscillators();
    animate();

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("dblclick", handleDoubleClick);
      window.removeEventListener("resize", handleResize);
      if (mouseActivityTimer) clearTimeout(mouseActivityTimer);
    };
  }, [speed, oscillatorCount, harmonicSpan, phaseOffset, isFlipped, visualizationType, fadeTrails, colorCycling, cyclingSpeed]);

  const getOscillatorCountDisplay = () => {
    const minOscillators = 5;
    const maxOscillators = 1000;
    const logMin = Math.log(minOscillators);
    const logMax = Math.log(maxOscillators);
    const scale = (logMax - logMin) / 100;
    return Math.round(Math.exp(logMin + scale * oscillatorCount));
  };

  const getCyclingSpeedDisplay = () => {
    const minDuration = 10000;
    const maxDuration = 600000;
    const logMin = Math.log(minDuration);
    const logMax = Math.log(maxDuration);
    const scale = (logMax - logMin) / 100;
    const invertedValue = 100 - cyclingSpeed;
    const duration = Math.round(Math.exp(logMin + scale * (invertedValue / 100) * 100));

    if (duration < 60000) {
      return (duration / 1000).toFixed(1) + "s";
    } else {
      return (duration / 60000).toFixed(1) + "m";
    }
  };

  const getPhaseOffsetDisplay = () => {
    if (phaseOffset === 0) return "0.00";
    if (phaseOffset < 0.01) return phaseOffset.toFixed(3);
    if (phaseOffset < 1) return phaseOffset.toFixed(2);
    return phaseOffset.toFixed(1);
  };

  return (
    <Box sx={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      <canvas ref={canvasRef} style={{ display: "block", backgroundColor: "#000" }} />

      {/* FPS Counter */}
      <Box
        sx={{
          position: "absolute",
          top: 20,
          left: 20,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          color: "white",
          padding: "5px 10px",
          borderRadius: "5px",
          fontFamily: "monospace",
          fontSize: "14px",
        }}
      >
        FPS: {fps}
      </Box>

      {/* Settings Toggle */}
      <Button
        onClick={() => setControlsOpen(!controlsOpen)}
        sx={{
          position: "absolute",
          top: 20,
          right: 20,
          backgroundColor: "#333",
          color: "white",
          width: "40px",
          height: "40px",
          minWidth: "40px",
          borderRadius: "50%",
          fontSize: "18px",
          "&:hover": { backgroundColor: "#555" },
        }}
      >
        ⚙️
      </Button>

      {/* Controls Menu */}
      {controlsOpen && (
        <Paper
          sx={{
            position: "absolute",
            top: 70,
            right: 20,
            backgroundColor: "rgba(51, 51, 51, 0.95)",
            borderRadius: "8px",
            padding: "15px",
            minWidth: "280px",
            maxHeight: "80vh",
            overflowY: "auto",
          }}
        >
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" color="white" gutterBottom>
                Speed: {(speed / 1000).toFixed(1)}s
              </Typography>
              <Slider
                value={speed}
                onChange={(_, value) => setSpeed(value as number)}
                min={100}
                max={30000}
                step={100}
                size="small"
              />
            </Box>

            <Box>
              <Typography variant="body2" color="white" gutterBottom>
                Number of Oscillators: {getOscillatorCountDisplay()}
              </Typography>
              <Slider
                value={oscillatorCount}
                onChange={(_, value) => setOscillatorCount(value as number)}
                min={0}
                max={100}
                size="small"
              />
            </Box>

            <Box>
              <Typography variant="body2" color="white" gutterBottom>
                Harmonic Span: {harmonicSpan.toFixed(2)}
              </Typography>
              <Slider
                value={harmonicSpan}
                onChange={(_, value) => setHarmonicSpan(value as number)}
                min={0}
                max={5}
                step={0.01}
                size="small"
              />
            </Box>

            <Box>
              <Typography variant="body2" color="white" gutterBottom>
                Phase Offset: {getPhaseOffsetDisplay()}
              </Typography>
              <Slider
                value={phaseOffset}
                onChange={(_, value) => setPhaseOffset(value as number)}
                min={0}
                max={100}
                step={1}
                size="small"
              />
            </Box>

            <FormControlLabel
              control={
                <Checkbox
                  checked={isFlipped}
                  onChange={(e) => setIsFlipped(e.target.checked)}
                  sx={{ color: "white" }}
                />
              }
              label={
                <Typography variant="body2" color="white">
                  {visualizationType === "rotational" ? "Full-circle" : "Flipped"}
                </Typography>
              }
            />

            <Box>
              <Typography variant="body2" color="white" gutterBottom>
                Visualization Type
              </Typography>
              <Select
                value={visualizationType}
                onChange={(e) => setVisualizationType(e.target.value)}
                size="small"
                fullWidth
                sx={{ backgroundColor: "white" }}
              >
                <MenuItem value="regular">Regular</MenuItem>
                <MenuItem value="bars">Bars</MenuItem>
                <MenuItem value="spinning">Spinning</MenuItem>
                <MenuItem value="rotational">Rotational</MenuItem>
                <MenuItem value="curve">Curve</MenuItem>
              </Select>
            </Box>

            <FormControlLabel
              control={
                <Checkbox
                  checked={fadeTrails}
                  onChange={(e) => setFadeTrails(e.target.checked)}
                  sx={{ color: "white" }}
                />
              }
              label={
                <Typography variant="body2" color="white">
                  Fade Trails
                </Typography>
              }
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={colorCycling}
                  onChange={(e) => setColorCycling(e.target.checked)}
                  sx={{ color: "white" }}
                />
              }
              label={
                <Typography variant="body2" color="white">
                  Color Cycling
                </Typography>
              }
            />

            <Box>
              <Typography variant="body2" color="white" gutterBottom>
                Cycling Speed: {getCyclingSpeedDisplay()}
              </Typography>
              <Slider
                value={cyclingSpeed}
                onChange={(_, value) => setCyclingSpeed(value as number)}
                min={0}
                max={100}
                size="small"
              />
            </Box>

            <Button variant="contained" fullWidth onClick={() => window.location.reload()}>
              Reset
            </Button>
          </Stack>
        </Paper>
      )}
    </Box>
  );
};

export default Harmonics;
