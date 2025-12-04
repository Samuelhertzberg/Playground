import { useEffect, useRef, useState } from "react";
import { Box, Button, Slider, Typography, Stack, Paper } from "@mui/material";
import BackButton from "../components/BackButton";
import useMouseActivity from "../hooks/useMouseActivity";

// Constants
const PHYSICS_CONFIG = {
  STAR_THRESHOLD: 270,
  FUSION_THRESHOLD: 270,
  MAX_VELOCITY: 1000,
  FIXED_TIMESTEP: 1 / 60,
  MAX_INTERACTION_DISTANCE: 2000,
  MIN_INTERACTION_DISTANCE: 0.1,
  COLLISION_GRID_SIZE: 100,
  TRAIL_UPDATE_FREQUENCY: 3,
};

type Body = {
  x: number;
  y: number;
  mass: number;
  radius: number;
  vx: number;
  vy: number;
  color: string;
  trail: { x: number; y: number }[];
  maxTrailLength: number;
  frameCount: number;
  starBirthTime: number | null;
};

type Camera = {
  x: number;
  y: number;
  zoom: number;
};

const GravitySimulator = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bodyCount, setBodyCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [zoomLevel, setZoomLevel] = useState("100%");
  const [isPaused, setIsPaused] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPerformanceMode, setIsPerformanceMode] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);

  // Control states
  const [cloudCount, setCloudCount] = useState(1000);
  const [cloudSize, setCloudSize] = useState(300);
  const [cloudSpin, setCloudSpin] = useState(20);
  const [gravity, setGravity] = useState(2.5);
  const [speed, setSpeed] = useState(25);

  const { opacity: uiOpacity } = useMouseActivity(3000, 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const setupCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setupCanvas();

    // Simulation state
    const simulationState = {
      bodies: [] as Body[],
      camera: { x: 0, y: 0, zoom: 1 } as Camera,
      gravityMultiplier: gravity,
      speedMultiplier: speed,
      isMouseDown: false,
      lastMouseX: 0,
      lastMouseY: 0,
      mouseMoved: false,
      followingBody: null as Body | null,
      followingBodyIndex: -1,
      isPaused: false,
      fps: 0,
      frameCount: 0,
      lastFpsUpdate: 0,
      physicsInterval: null as number | null,
      performanceMode: false,
      lastPerformanceCheck: 0,
    };

    // Update gravity and speed from props
    simulationState.gravityMultiplier = gravity;
    simulationState.speedMultiplier = speed;

    // Helper functions
    const interpolateColor = (color1: string, color2: string, factor: number): string => {
      const hex = (c: string) => parseInt(c.slice(1), 16);
      const [r1, g1, b1] = [
        (hex(color1) >> 16) & 255,
        (hex(color1) >> 8) & 255,
        hex(color1) & 255,
      ];
      const [r2, g2, b2] = [
        (hex(color2) >> 16) & 255,
        (hex(color2) >> 8) & 255,
        hex(color2) & 255,
      ];

      const r = Math.round(r1 + (r2 - r1) * factor);
      const g = Math.round(g1 + (g2 - g1) * factor);
      const b = Math.round(b1 + (b2 - b1) * factor);

      return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
    };

    const generateBodyColor = (mass: number): string => {
      const colors = {
        darkGray: "#404040",
        gray: "#808080",
        blue: "#4169E1",
        green: "#228B22",
        beige: "#F5E6B8",
        yellow: "#FFD700",
        white: "#FFFFFF",
      };

      if (mass < 3) {
        return interpolateColor(colors.darkGray, colors.gray, Math.min(mass / 3, 1));
      } else if (mass < 60) {
        const factor = (mass - 3) / 57;
        return factor < 0.5
          ? interpolateColor(colors.blue, colors.green, factor * 2)
          : interpolateColor(colors.green, colors.beige, (factor - 0.5) * 2);
      } else if (mass < 300) {
        return interpolateColor(colors.beige, colors.yellow, (mass - 60) / 240);
      } else {
        return interpolateColor(colors.yellow, colors.white, Math.min((mass - 300) / 200, 1));
      }
    };

    const createBody = (x: number, y: number, mass: number, vx = 0, vy = 0): Body => ({
      x,
      y,
      mass,
      radius: Math.sqrt(mass) * 2,
      vx,
      vy,
      color: generateBodyColor(mass),
      trail: [],
      maxTrailLength: 50,
      frameCount: 0,
      starBirthTime: null,
    });

    const updateBody = (body: Body, bodies: Body[], deltaTime: number, gravityMultiplier: number): Body => {
      const updatedBody = { ...body };
      updatedBody.frameCount++;

      if (updatedBody.frameCount % PHYSICS_CONFIG.TRAIL_UPDATE_FREQUENCY === 0) {
        updatedBody.trail = [...body.trail, { x: body.x, y: body.y }];
        if (updatedBody.trail.length > updatedBody.maxTrailLength) {
          updatedBody.trail = updatedBody.trail.slice(1);
        }
      }

      let fx = 0,
        fy = 0;

      for (let other of bodies) {
        if (other === body) continue;

        const dx = other.x - body.x;
        const dy = other.y - body.y;
        const distanceSquared = dx * dx + dy * dy;
        const distance = Math.sqrt(distanceSquared);

        if (
          distance < PHYSICS_CONFIG.MIN_INTERACTION_DISTANCE ||
          distance > PHYSICS_CONFIG.MAX_INTERACTION_DISTANCE
        )
          continue;

        const force = (gravityMultiplier * body.mass * other.mass) / distanceSquared;
        const invDistance = 1 / distance;

        fx += dx * force * invDistance;
        fy += dy * force * invDistance;
      }

      const ax = fx / body.mass;
      const ay = fy / body.mass;

      if (isFinite(ax)) updatedBody.vx += ax * deltaTime;
      if (isFinite(ay)) updatedBody.vy += ay * deltaTime;

      updatedBody.vx = Math.max(
        -PHYSICS_CONFIG.MAX_VELOCITY,
        Math.min(PHYSICS_CONFIG.MAX_VELOCITY, updatedBody.vx)
      );
      updatedBody.vy = Math.max(
        -PHYSICS_CONFIG.MAX_VELOCITY,
        Math.min(PHYSICS_CONFIG.MAX_VELOCITY, updatedBody.vy)
      );

      updatedBody.x += updatedBody.vx * deltaTime;
      updatedBody.y += updatedBody.vy * deltaTime;

      return updatedBody;
    };

    const drawBody = (
      ctx: CanvasRenderingContext2D,
      body: Body,
      camera: Camera,
      performanceMode = false,
      isFollowed = false
    ) => {
      const screenX = (body.x - camera.x) * camera.zoom + canvas.width / 2;
      const screenY = (body.y - camera.y) * camera.zoom + canvas.height / 2;
      const screenRadius = body.radius * camera.zoom;

      if (
        !isFinite(screenX) ||
        !isFinite(screenY) ||
        !isFinite(screenRadius) ||
        screenRadius <= 0
      ) {
        return;
      }

      if (performanceMode && screenRadius < 2) {
        ctx.fillStyle = body.color;
        ctx.fillRect(screenX - 1, screenY - 1, 2, 2);
        return;
      }

      if (
        screenX + screenRadius < 0 ||
        screenX - screenRadius > canvas.width ||
        screenY + screenRadius < 0 ||
        screenY - screenRadius > canvas.height
      ) {
        return;
      }

      // Draw trail
      if (
        !performanceMode &&
        body.trail.length > 1 &&
        camera.zoom > 0.5 &&
        body.trail.length < 100
      ) {
        ctx.strokeStyle = body.color;
        ctx.lineWidth = Math.max(1, screenRadius * 0.1);
        ctx.globalAlpha = 0.3;
        ctx.beginPath();

        let lastX: number | null = null,
          lastY: number | null = null;
        for (let i = 0; i < body.trail.length; i++) {
          const trailX = (body.trail[i].x - camera.x) * camera.zoom + canvas.width / 2;
          const trailY = (body.trail[i].y - camera.y) * camera.zoom + canvas.height / 2;

          if (
            lastX !== null &&
            lastY !== null &&
            Math.abs(trailX - lastX) < 2 &&
            Math.abs(trailY - lastY) < 2
          )
            continue;

          if (i === 0 || lastX === null) {
            ctx.moveTo(trailX, trailY);
          } else {
            ctx.lineTo(trailX, trailY);
          }
          lastX = trailX;
          lastY = trailY;
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      const hasFusion = body.mass >= PHYSICS_CONFIG.FUSION_THRESHOLD;

      // Draw fusion glow for stars
      if (hasFusion && (!performanceMode || screenRadius > 10)) {
        const glowRadius = screenRadius * 3;
        const glowGradient = ctx.createRadialGradient(
          screenX,
          screenY,
          screenRadius,
          screenX,
          screenY,
          glowRadius
        );

        let luminosityMultiplier = 1.0;
        if (body.starBirthTime) {
          const timeSinceBirth = (Date.now() - body.starBirthTime) / 1000;
          const birthDuration = 4;

          if (timeSinceBirth < birthDuration) {
            const birthProgress = timeSinceBirth / birthDuration;
            luminosityMultiplier = 1 - Math.pow(1 - birthProgress, 3);
            luminosityMultiplier *= 1 + (1 - birthProgress) * 6;
          }
        }

        const time = Date.now() * 0.003;
        const pulseIntensity = (0.5 + Math.sin(time * 0.1) * 0.1) * luminosityMultiplier;

        glowGradient.addColorStop(0, `rgba(255, 255, 200, ${pulseIntensity})`);
        glowGradient.addColorStop(0.5, `rgba(255, 215, 0, ${pulseIntensity * 0.3})`);
        glowGradient.addColorStop(1, "rgba(255, 215, 0, 0)");

        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw body
      ctx.fillStyle = body.color;
      ctx.beginPath();
      ctx.arc(screenX, screenY, screenRadius, 0, Math.PI * 2);
      ctx.fill();

      // Add shading for planets
      if (!hasFusion && !performanceMode && screenRadius > 3) {
        const shadingGradient = ctx.createRadialGradient(
          screenX - screenRadius * 0.3,
          screenY - screenRadius * 0.3,
          0,
          screenX,
          screenY,
          screenRadius
        );
        shadingGradient.addColorStop(0, "rgba(255, 255, 255, 0.15)");
        shadingGradient.addColorStop(1, "rgba(255, 255, 255, 0)");

        ctx.fillStyle = shadingGradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, screenRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw following indicator
      if (isFollowed && screenRadius > 5) {
        const time = Date.now() * 0.005;
        const pulse = 0.7 + Math.sin(time) * 0.3;
        const ringRadius = screenRadius + 8 + Math.sin(time * 2) * 3;

        ctx.strokeStyle = `rgba(33, 150, 243, ${pulse * 0.8})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(screenX, screenY, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    const mergeBodies = (body1: Body, body2: Body): Body => {
      const oldMass = body1.mass;
      const wasNotStar = oldMass < PHYSICS_CONFIG.STAR_THRESHOLD;

      const preserveBody1Trail = body1.mass >= body2.mass;
      const trailToPreserve = preserveBody1Trail ? [...body1.trail] : [...body2.trail];

      const totalMass = body1.mass + body2.mass;
      const newVx = (body1.vx * body1.mass + body2.vx * body2.mass) / totalMass;
      const newVy = (body1.vy * body1.mass + body2.vy * body2.mass) / totalMass;

      const newX = (body1.x * body1.mass + body2.x * body2.mass) / totalMass;
      const newY = (body1.y * body1.mass + body2.y * body2.mass) / totalMass;

      const mergedBody: Body = {
        ...body1,
        x: newX,
        y: newY,
        vx: newVx,
        vy: newVy,
        mass: totalMass,
        radius: Math.sqrt(totalMass) * 2,
        color: generateBodyColor(totalMass),
        trail: [...trailToPreserve, { x: newX, y: newY }],
      };

      if (mergedBody.trail.length > mergedBody.maxTrailLength) {
        mergedBody.trail = mergedBody.trail.slice(-mergedBody.maxTrailLength);
      }

      if (wasNotStar && mergedBody.mass >= PHYSICS_CONFIG.STAR_THRESHOLD) {
        mergedBody.starBirthTime = Date.now();
      }

      return mergedBody;
    };

    const checkCollisions = () => {
      const grid = new Map<string, { body: Body; index: number }[]>();
      const gridSize = PHYSICS_CONFIG.COLLISION_GRID_SIZE;

      for (let i = 0; i < simulationState.bodies.length; i++) {
        const body = simulationState.bodies[i];
        const gridX = Math.floor(body.x / gridSize);
        const gridY = Math.floor(body.y / gridSize);
        const key = `${gridX},${gridY}`;

        if (!grid.has(key)) grid.set(key, []);
        grid.get(key)!.push({ body, index: i });
      }

      const toRemove = new Set<number>();

      for (let [key] of grid) {
        const [gridX, gridY] = key.split(",").map(Number);

        const nearbyBodies: { body: Body; index: number }[] = [];
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const adjacentKey = `${gridX + dx},${gridY + dy}`;
            if (grid.has(adjacentKey)) {
              nearbyBodies.push(...grid.get(adjacentKey)!);
            }
          }
        }

        for (let i = 0; i < nearbyBodies.length; i++) {
          for (let j = i + 1; j < nearbyBodies.length; j++) {
            const { body: body1, index: idx1 } = nearbyBodies[i];
            const { body: body2, index: idx2 } = nearbyBodies[j];

            if (toRemove.has(idx1) || toRemove.has(idx2)) continue;

            const dx = body2.x - body1.x;
            const dy = body2.y - body1.y;
            const distanceSquared = dx * dx + dy * dy;
            const collisionThreshold = (body1.radius + body2.radius) * 0.95;

            if (distanceSquared < collisionThreshold * collisionThreshold) {
              const body1IsFollowed = simulationState.followingBodyIndex === idx1;
              const body2IsFollowed = simulationState.followingBodyIndex === idx2;

              if (body1.mass >= body2.mass) {
                const mergedBody = mergeBodies(body1, body2);
                simulationState.bodies[idx1] = mergedBody;
                toRemove.add(idx2);
                if (body2IsFollowed) {
                  simulationState.followingBodyIndex = idx1;
                  simulationState.followingBody = mergedBody;
                }
              } else {
                const mergedBody = mergeBodies(body2, body1);
                simulationState.bodies[idx2] = mergedBody;
                toRemove.add(idx1);
                if (body1IsFollowed) {
                  simulationState.followingBodyIndex = idx2;
                  simulationState.followingBody = mergedBody;
                }
              }
            }
          }
        }
      }

      if (toRemove.size > 0) {
        const sortedIndices = Array.from(toRemove).sort((a, b) => b - a);

        for (let index of sortedIndices) {
          if (simulationState.followingBodyIndex > index) {
            simulationState.followingBodyIndex--;
          } else if (simulationState.followingBodyIndex === index) {
            stopFollowing();
          }
          simulationState.bodies.splice(index, 1);
        }
        setBodyCount(simulationState.bodies.length);
      }
    };

    const updateSimulation = (deltaTime: number) => {
      if (simulationState.isPaused) {
        return;
      }

      const currentTime = performance.now();
      if (currentTime - simulationState.lastPerformanceCheck > 2000) {
        const newPerformanceMode =
          simulationState.bodies.length > 1000 || simulationState.fps < 30;
        if (newPerformanceMode !== simulationState.performanceMode) {
          simulationState.performanceMode = newPerformanceMode;
          setIsPerformanceMode(newPerformanceMode);
        }
        simulationState.lastPerformanceCheck = currentTime;
      }

      simulationState.bodies = simulationState.bodies.map((body) =>
        updateBody(
          body,
          simulationState.bodies,
          deltaTime * simulationState.speedMultiplier,
          simulationState.gravityMultiplier
        )
      );

      if (!simulationState.performanceMode || simulationState.frameCount % 2 === 0) {
        checkCollisions();
      }
    };

    const drawStars = () => {
      const starDensity = simulationState.performanceMode ? 0.0001 : 0.0002;
      const visibleWidth = canvas.width / simulationState.camera.zoom;
      const visibleHeight = canvas.height / simulationState.camera.zoom;
      const starCount = Math.floor(visibleWidth * visibleHeight * starDensity);

      ctx.fillStyle = "white";
      for (let i = 0; i < starCount; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const brightness = Math.random();

        ctx.globalAlpha = brightness * 0.5;
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.globalAlpha = 1;
    };

    const drawSimulation = () => {
      ctx.fillStyle = "#000011";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (!simulationState.performanceMode || simulationState.frameCount % 3 === 0) {
        drawStars();
      }

      const margin = 200;
      const leftBound =
        simulationState.camera.x - (canvas.width / 2 + margin) / simulationState.camera.zoom;
      const rightBound =
        simulationState.camera.x + (canvas.width / 2 + margin) / simulationState.camera.zoom;
      const topBound =
        simulationState.camera.y - (canvas.height / 2 + margin) / simulationState.camera.zoom;
      const bottomBound =
        simulationState.camera.y + (canvas.height / 2 + margin) / simulationState.camera.zoom;

      for (let i = 0; i < simulationState.bodies.length; i++) {
        const body = simulationState.bodies[i];
        if (
          body.x + body.radius < leftBound ||
          body.x - body.radius > rightBound ||
          body.y + body.radius < topBound ||
          body.y - body.radius > bottomBound
        ) {
          continue;
        }
        const isFollowed = simulationState.followingBodyIndex === i;
        drawBody(ctx, body, simulationState.camera, simulationState.performanceMode, isFollowed);
      }
    };

    const updateCameraFollowing = () => {
      if (
        simulationState.followingBodyIndex >= 0 &&
        simulationState.followingBodyIndex < simulationState.bodies.length
      ) {
        simulationState.followingBody = simulationState.bodies[simulationState.followingBodyIndex];

        const targetX = simulationState.followingBody.x;
        const targetY = simulationState.followingBody.y;

        const smoothing = 0.1;
        simulationState.camera.x += (targetX - simulationState.camera.x) * smoothing;
        simulationState.camera.y += (targetY - simulationState.camera.y) * smoothing;
      } else if (simulationState.followingBodyIndex >= 0) {
        stopFollowing();
      }
    };

    const startFollowing = (body: Body) => {
      const index = simulationState.bodies.indexOf(body);
      if (index !== -1) {
        simulationState.followingBody = body;
        simulationState.followingBodyIndex = index;
        setIsFollowing(true);
      }
    };

    const stopFollowing = () => {
      if (simulationState.followingBody) {
        simulationState.followingBody = null;
        simulationState.followingBodyIndex = -1;
        setIsFollowing(false);
      }
    };

    const handleBodyClick = (e: MouseEvent) => {
      const worldX =
        simulationState.camera.x +
        (e.clientX - canvas.width / 2) / simulationState.camera.zoom;
      const worldY =
        simulationState.camera.y +
        (e.clientY - canvas.height / 2) / simulationState.camera.zoom;

      let closestBody: Body | null = null;
      let closestDistance = Infinity;

      for (let body of simulationState.bodies) {
        const dx = body.x - worldX;
        const dy = body.y - worldY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= body.radius && distance < closestDistance) {
          closestDistance = distance;
          closestBody = body;
        }
      }

      if (closestBody) {
        startFollowing(closestBody);
      } else {
        stopFollowing();
      }
    };

    const addBodyCloud = (count: number, size: number, spin: number) => {
      const cloudRadius = size;
      const centerX = simulationState.camera.x;
      const centerY = simulationState.camera.y;
      const cloudSpin = spin;

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 10;
        const radius = Math.sqrt(Math.random()) * cloudRadius;
        const randomness = 20;

        const x = centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * randomness;
        const y = centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * randomness;

        const spinSpeed = cloudSpin * 0.0005;
        const orbitalAngle = angle + Math.PI / 2;
        const orbitalVelocity = spinSpeed * radius;
        const vx = Math.cos(orbitalAngle) * orbitalVelocity;
        const vy = Math.sin(orbitalAngle) * orbitalVelocity;

        simulationState.bodies.push(createBody(x, y, 1, vx, vy));
      }
      setBodyCount(simulationState.bodies.length);
    };

    const clearBodies = () => {
      simulationState.bodies = [];
      setBodyCount(0);
    };

    const resetView = () => {
      stopFollowing();
      simulationState.camera.x = 0;
      simulationState.camera.y = 0;
      simulationState.camera.zoom = 1;
      setZoomLevel("100%");
    };

    // Event listeners
    const handleMouseDown = (e: MouseEvent) => {
      simulationState.isMouseDown = true;
      simulationState.mouseMoved = false;
      simulationState.lastMouseX = e.clientX;
      simulationState.lastMouseY = e.clientY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (simulationState.isMouseDown) {
        const dx = e.clientX - simulationState.lastMouseX;
        const dy = e.clientY - simulationState.lastMouseY;

        if (
          simulationState.followingBody &&
          (Math.abs(dx) > 2 || Math.abs(dy) > 2)
        ) {
          stopFollowing();
        }

        simulationState.camera.x -= dx / simulationState.camera.zoom;
        simulationState.camera.y -= dy / simulationState.camera.zoom;
        simulationState.mouseMoved = true;

        simulationState.lastMouseX = e.clientX;
        simulationState.lastMouseY = e.clientY;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const wasMouseDown = simulationState.isMouseDown;
      simulationState.isMouseDown = false;

      if (wasMouseDown && !simulationState.mouseMoved) {
        handleBodyClick(e);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      simulationState.camera.zoom *= zoomFactor;
      simulationState.camera.zoom = Math.max(0.1, Math.min(5, simulationState.camera.zoom));
      setZoomLevel(Math.round(simulationState.camera.zoom * 100) + "%");
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        simulationState.isPaused = !simulationState.isPaused;
        setIsPaused(simulationState.isPaused);
      }
    };

    const handleResize = () => {
      setupCanvas();
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("wheel", handleWheel);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);

    // Start simulation
    simulationState.physicsInterval = setInterval(() => {
      updateSimulation(PHYSICS_CONFIG.FIXED_TIMESTEP);
    }, 1000 * PHYSICS_CONFIG.FIXED_TIMESTEP);

    const renderLoop = (currentTime: number) => {
      simulationState.frameCount++;
      if (currentTime - simulationState.lastFpsUpdate > 1000) {
        simulationState.fps = simulationState.frameCount;
        simulationState.frameCount = 0;
        simulationState.lastFpsUpdate = currentTime;
        setFps(simulationState.fps);
      }

      updateCameraFollowing();
      drawSimulation();
      requestAnimationFrame(renderLoop);
    };

    simulationState.lastFpsUpdate = performance.now();
    simulationState.frameCount = 0;
    requestAnimationFrame(renderLoop);

    // Expose functions to component scope
    (window as any).__addBodyCloud = () => addBodyCloud(cloudCount, cloudSize, cloudSpin);
    (window as any).__clearBodies = clearBodies;
    (window as any).__resetView = resetView;

    // Cleanup
    return () => {
      if (simulationState.physicsInterval) {
        clearInterval(simulationState.physicsInterval);
      }
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
      delete (window as any).__addBodyCloud;
      delete (window as any).__clearBodies;
      delete (window as any).__resetView;
    };
  }, [cloudCount, cloudSize, cloudSpin, gravity, speed]);

  return (
    <Box sx={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      <BackButton />

      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          cursor: "grab",
        }}
      />

      {/* Stats Display */}
      <Box
        sx={{
          position: "absolute",
          top: 70,
          left: 20,
          color: "white",
          background: "rgba(0, 0, 0, 0.7)",
          padding: "10px 15px",
          borderRadius: "8px",
          fontSize: "14px",
          opacity: uiOpacity,
          transition: "opacity 0.3s ease",
        }}
      >
        <Typography variant="body2">Bodies: {bodyCount}</Typography>
        <Typography variant="body2">FPS: {fps}</Typography>
        <Typography variant="body2">Zoom: {zoomLevel}</Typography>
        {isPaused && (
          <Typography variant="body2" sx={{ color: "#ff9800", mt: 1 }}>
            PAUSED
          </Typography>
        )}
        {isFollowing && (
          <Typography variant="body2" sx={{ color: "#2196f3", mt: 1 }}>
            TRACKING
          </Typography>
        )}
        {isPerformanceMode && (
          <Typography variant="body2" sx={{ color: "#4caf50", mt: 1 }}>
            PERFORMANCE
          </Typography>
        )}
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
          opacity: uiOpacity,
          transition: "opacity 0.3s ease",
          "&:hover": {
            backgroundColor: "#555",
            opacity: 1,
          },
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
            opacity: uiOpacity,
            transition: "opacity 0.3s ease",
            "&:hover": {
              opacity: 1,
            },
          }}
        >
          <Stack spacing={2}>
            <Typography variant="h6" sx={{ color: "white", mb: 1 }}>
              Gravity Simulator
            </Typography>

            {/* Cloud Generation */}
            <Box>
              <Typography variant="body2" color="white" fontWeight="bold" gutterBottom>
                Cloud Generator
              </Typography>
              <Box>
                <Typography variant="body2" color="white" gutterBottom>
                  Count: {cloudCount}
                </Typography>
                <Slider
                  value={cloudCount}
                  onChange={(_, value) => setCloudCount(value as number)}
                  min={10}
                  max={2000}
                  step={10}
                  size="small"
                />
              </Box>
              <Box>
                <Typography variant="body2" color="white" gutterBottom>
                  Size: {cloudSize}
                </Typography>
                <Slider
                  value={cloudSize}
                  onChange={(_, value) => setCloudSize(value as number)}
                  min={50}
                  max={1000}
                  step={10}
                  size="small"
                />
              </Box>
              <Box>
                <Typography variant="body2" color="white" gutterBottom>
                  Spin: {cloudSpin}
                </Typography>
                <Slider
                  value={cloudSpin}
                  onChange={(_, value) => setCloudSpin(value as number)}
                  min={0}
                  max={100}
                  step={5}
                  size="small"
                />
              </Box>
              <Button
                variant="contained"
                fullWidth
                onClick={() => (window as any).__addBodyCloud()}
              >
                Generate Cloud
              </Button>
            </Box>

            {/* Physics Controls */}
            <Box>
              <Typography variant="body2" color="white" fontWeight="bold" gutterBottom>
                Cosmic Forces
              </Typography>
              <Box>
                <Typography variant="body2" color="white" gutterBottom>
                  Gravity: {gravity}
                </Typography>
                <Slider
                  value={gravity}
                  onChange={(_, value) => setGravity(value as number)}
                  min={0.1}
                  max={5}
                  step={0.1}
                  size="small"
                />
              </Box>
              <Box>
                <Typography variant="body2" color="white" gutterBottom>
                  Speed: {speed}
                </Typography>
                <Slider
                  value={speed}
                  onChange={(_, value) => setSpeed(value as number)}
                  min={0.1}
                  max={100}
                  step={0.1}
                  size="small"
                />
              </Box>
            </Box>

            {/* Simulation Controls */}
            <Box>
              <Typography variant="body2" color="white" fontWeight="bold" gutterBottom>
                Mission Control
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => (window as any).__clearBodies()}
                  sx={{ flex: 1 }}
                >
                  Clear
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => (window as any).__resetView()}
                  sx={{ flex: 1 }}
                >
                  Reset View
                </Button>
              </Stack>
            </Box>

            {/* Help */}
            <Box>
              <Typography variant="body2" color="white" fontWeight="bold" gutterBottom>
                Controls
              </Typography>
              <Typography variant="body2" color="white" sx={{ fontSize: "12px", lineHeight: 1.6 }}>
                • Click and drag to pan
                <br />
                • Mouse wheel to zoom
                <br />
                • Click on a body to follow it
                <br />• Press SPACE to pause/resume
              </Typography>
            </Box>
          </Stack>
        </Paper>
      )}
    </Box>
  );
};

export default GravitySimulator;
