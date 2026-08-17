import { useEffect, useRef, useState } from "react";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import BackButton from "../components/BackButton";
import useMouseActivity from "../hooks/useMouseActivity";

// Grid parameters
const GRID_SIZE = 20;
const DAMPING = 0.95;
const WAVE_SPEED = 0.8;
const WAVE_STRENGTH = 50;

const Propagation = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [currentMode, setCurrentMode] = useState(0);

  const { opacity: uiOpacity } = useMouseActivity(3000, 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLS = Math.floor(canvas.width / GRID_SIZE);
    const ROWS = Math.floor(canvas.height / GRID_SIZE);

    // Grid arrays for wave simulation
    let velocityX: number[][] = new Array(ROWS);
    let velocityY: number[][] = new Array(ROWS);
    let prevVelocityX: number[][] = new Array(ROWS);
    let prevVelocityY: number[][] = new Array(ROWS);

    for (let i = 0; i < ROWS; i++) {
      velocityX[i] = new Array(COLS).fill(0);
      velocityY[i] = new Array(COLS).fill(0);
      prevVelocityX[i] = new Array(COLS).fill(0);
      prevVelocityY[i] = new Array(COLS).fill(0);
    }

    // Mouse tracking
    let mouseX = 0;
    let mouseY = 0;
    let prevMouseX: number | undefined = undefined;
    let prevMouseY: number | undefined = undefined;

    // Visualization mode
    let visualizationMode = 0;
    const VISUALIZATION_MODES = 9;

    // Helper function to apply impulse
    const applyImpulse = (
      gridX: number,
      gridY: number,
      dirX: number,
      dirY: number,
      impulseStrength: number
    ) => {
      if (gridX < 1 || gridX >= COLS - 1 || gridY < 1 || gridY >= ROWS - 1) return;

      const radius = 2;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = gridY + dy;
          const nx = gridX + dx;
          if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= radius) {
              const falloff = 1 - dist / radius;
              velocityX[ny][nx] += dirX * impulseStrength * falloff;
              velocityY[ny][nx] += dirY * impulseStrength * falloff;
            }
          }
        }
      }
    };

    // Event handlers
    const handleMouseMove = (e: MouseEvent) => {
      prevMouseX = mouseX;
      prevMouseY = mouseY;
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (prevMouseX === undefined || prevMouseY === undefined) {
        prevMouseX = mouseX;
        prevMouseY = mouseY;
        return;
      }

      const mouseVelX = mouseX - prevMouseX;
      const mouseVelY = mouseY - prevMouseY;
      const speed = Math.sqrt(mouseVelX * mouseVelX + mouseVelY * mouseVelY);

      const gridX = Math.floor(mouseX / GRID_SIZE);
      const gridY = Math.floor(mouseY / GRID_SIZE);
      const prevGridX = Math.floor(prevMouseX / GRID_SIZE);
      const prevGridY = Math.floor(prevMouseY / GRID_SIZE);

      const gridDistX = gridX - prevGridX;
      const gridDistY = gridY - prevGridY;
      const gridDist = Math.sqrt(gridDistX * gridDistX + gridDistY * gridDistY);

      if (speed > 0.1) {
        const impulseStrength = Math.min(speed * 5, WAVE_STRENGTH);
        const dirX = mouseVelX / speed;
        const dirY = mouseVelY / speed;

        if (gridDist > 2) {
          const steps = Math.ceil(gridDist);
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const interpX = prevGridX + gridDistX * t;
            const interpY = prevGridY + gridDistY * t;
            const interpGridX = Math.floor(interpX);
            const interpGridY = Math.floor(interpY);
            applyImpulse(interpGridX, interpGridY, dirX, dirY, impulseStrength);
          }
        } else {
          applyImpulse(gridX, gridY, dirX, dirY, impulseStrength);
        }
      } else if (gridX >= 1 && gridX < COLS - 1 && gridY >= 1 && gridY < ROWS - 1) {
        velocityX[gridY][gridX] += (Math.random() - 0.5) * WAVE_STRENGTH;
        velocityY[gridY][gridX] += (Math.random() - 0.5) * WAVE_STRENGTH;
      }
    };

    const handleClick = () => {
      visualizationMode = (visualizationMode + 1) % VISUALIZATION_MODES;
      setCurrentMode(visualizationMode);
    };

    // Wave propagation
    const updateWaves = () => {
      const nextVelX: number[][] = new Array(ROWS);
      const nextVelY: number[][] = new Array(ROWS);
      for (let i = 0; i < ROWS; i++) {
        nextVelX[i] = new Array(COLS).fill(0);
        nextVelY[i] = new Array(COLS).fill(0);
      }

      for (let y = 1; y < ROWS - 1; y++) {
        for (let x = 1; x < COLS - 1; x++) {
          const vx = velocityX[y][x];
          const vy = velocityY[y][x];

          const prevVx = prevVelocityX[y][x];
          const prevVy = prevVelocityY[y][x];

          const avgVelX =
            (velocityX[y - 1][x] + velocityX[y + 1][x] + velocityX[y][x - 1] + velocityX[y][x + 1]) /
            4;

          const avgVelY =
            (velocityY[y - 1][x] + velocityY[y + 1][x] + velocityY[y][x - 1] + velocityY[y][x + 1]) /
            4;

          const accelX = (avgVelX - vx) * WAVE_SPEED * WAVE_SPEED;
          const accelY = (avgVelY - vy) * WAVE_SPEED * WAVE_SPEED;

          nextVelX[y][x] = (2 * vx - prevVx + accelX) * DAMPING;
          nextVelY[y][x] = (2 * vy - prevVy + accelY) * DAMPING;
        }
      }

      prevVelocityX = velocityX;
      prevVelocityY = velocityY;
      velocityX = nextVelX;
      velocityY = nextVelY;
    };

    // Render modes
    const renderMode0 = () => {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "black";

      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const velX = velocityX[y][x];
          const velY = velocityY[y][x];
          const magnitude = Math.sqrt(velX * velX + velY * velY);

          const squareSize = Math.max(2, 8 + magnitude * 0.3);

          const centerX = x * GRID_SIZE + GRID_SIZE / 2;
          const centerY = y * GRID_SIZE + GRID_SIZE / 2;

          ctx.fillRect(centerX - squareSize / 2, centerY - squareSize / 2, squareSize, squareSize);
        }
      }
    };

    const renderMode1 = () => {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const velX = velocityX[y][x];
          const velY = velocityY[y][x];
          const magnitude = Math.sqrt(velX * velX + velY * velY);

          const alpha = Math.min(1, magnitude * 0.05);

          if (alpha > 0.01) {
            ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
            ctx.fillRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
          }
        }
      }
    };

    const renderMode2 = () => {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "black";

      const cellSize = GRID_SIZE * 1.1;

      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const velX = velocityX[y][x];
          const velY = velocityY[y][x];

          const offsetX = velX;
          const offsetY = velY;

          ctx.fillRect(
            x * GRID_SIZE + offsetX - (cellSize - GRID_SIZE) / 2,
            y * GRID_SIZE + offsetY - (cellSize - GRID_SIZE) / 2,
            cellSize,
            cellSize
          );
        }
      }
    };

    const renderMode3 = () => {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "black";
      ctx.strokeStyle = "black";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";

      ctx.beginPath();

      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const velX = velocityX[y][x];
          const velY = velocityY[y][x];
          const magnitudeSq = velX * velX + velY * velY;

          if (magnitudeSq < 0.25) continue;

          const centerX = x * GRID_SIZE + GRID_SIZE / 2;
          const centerY = y * GRID_SIZE + GRID_SIZE / 2;

          if (magnitudeSq < 100) {
            const width = (magnitudeSq / 100) * 2;
            ctx.fillRect(centerX - width / 2, centerY - width / 2, width, width);
          } else {
            const magnitude = Math.sqrt(magnitudeSq);
            const lineLength = Math.min(GRID_SIZE * 0.8, magnitude * 0.3);

            if (lineLength > 0.5) {
              const angle = Math.atan2(velY, velX);

              const endX = centerX + Math.cos(angle) * lineLength;
              const endY = centerY + Math.sin(angle) * lineLength;

              ctx.moveTo(centerX, centerY);
              ctx.lineTo(endX, endY);
            }
          }
        }
      }

      ctx.stroke();
    };

    const renderMode4 = () => {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "black";

      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const velX = velocityX[y][x];
          const velY = velocityY[y][x];
          const magnitudeSq = velX * velX + velY * velY;

          if (magnitudeSq < 0.25) continue;

          const magnitude = Math.sqrt(magnitudeSq);
          const centerX = x * GRID_SIZE + GRID_SIZE / 2;
          const centerY = y * GRID_SIZE + GRID_SIZE / 2;

          const angle = Math.atan2(velY, velX);

          const numParticles = 3;
          const orbitRadius = Math.min(magnitude * 0.2, GRID_SIZE * 0.4);
          const particleSize = Math.min(4, 2 + magnitude * 0.1);

          for (let i = 0; i < numParticles; i++) {
            const particleAngle = angle + (i * 2 * Math.PI) / numParticles;
            const px = centerX + Math.cos(particleAngle) * orbitRadius;
            const py = centerY + Math.sin(particleAngle) * orbitRadius;

            ctx.fillRect(px - particleSize / 2, py - particleSize / 2, particleSize, particleSize);
          }
        }
      }
    };

    const renderMode5 = () => {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "black";
      ctx.lineWidth = 1;

      const maxOffset = GRID_SIZE * 0.5;

      for (let y = 0; y < ROWS; y++) {
        ctx.beginPath();
        for (let x = 0; x < COLS; x++) {
          const velX = velocityX[y][x];
          const velY = velocityY[y][x];

          const offsetX = Math.max(-maxOffset, Math.min(maxOffset, velX));
          const offsetY = Math.max(-maxOffset, Math.min(maxOffset, velY));

          const centerX = x * GRID_SIZE + GRID_SIZE / 2 + offsetX;
          const centerY = y * GRID_SIZE + GRID_SIZE / 2 + offsetY;

          if (x === 0) {
            ctx.moveTo(centerX, centerY);
          } else {
            ctx.lineTo(centerX, centerY);
          }
        }
        ctx.stroke();
      }

      for (let x = 0; x < COLS; x++) {
        ctx.beginPath();
        for (let y = 0; y < ROWS; y++) {
          const velX = velocityX[y][x];
          const velY = velocityY[y][x];

          const offsetX = Math.max(-maxOffset, Math.min(maxOffset, velX));
          const offsetY = Math.max(-maxOffset, Math.min(maxOffset, velY));

          const centerX = x * GRID_SIZE + GRID_SIZE / 2 + offsetX;
          const centerY = y * GRID_SIZE + GRID_SIZE / 2 + offsetY;

          if (y === 0) {
            ctx.moveTo(centerX, centerY);
          } else {
            ctx.lineTo(centerX, centerY);
          }
        }
        ctx.stroke();
      }
    };

    const renderMode6 = () => {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "black";
      ctx.strokeStyle = "black";
      ctx.lineWidth = 1.5;

      ctx.beginPath();

      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const velX = velocityX[y][x];
          const velY = velocityY[y][x];
          const magnitudeSq = velX * velX + velY * velY;

          if (magnitudeSq > 1) {
            const centerX = x * GRID_SIZE + GRID_SIZE / 2;
            const centerY = y * GRID_SIZE + GRID_SIZE / 2;

            if (magnitudeSq < 9) {
              ctx.fillRect(centerX - 1, centerY - 1, 2, 2);
            } else {
              const magnitude = Math.sqrt(magnitudeSq);
              const radius = Math.min(magnitude * 0.3, GRID_SIZE * 0.7);

              ctx.moveTo(centerX + radius, centerY);
              ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            }
          }
        }
      }

      ctx.stroke();
    };

    const renderMode7 = () => {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "black";
      ctx.strokeStyle = "black";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";

      ctx.beginPath();

      const cos45 = 0.7071067811865476;
      const sin45 = 0.7071067811865476;

      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const velX = velocityX[y][x];
          const velY = velocityY[y][x];
          const magnitudeSq = velX * velX + velY * velY;

          if (magnitudeSq < 4) continue;

          const centerX = x * GRID_SIZE + GRID_SIZE / 2;
          const centerY = y * GRID_SIZE + GRID_SIZE / 2;

          if (magnitudeSq < 25) {
            const size = 1 + magnitudeSq * 0.1;
            ctx.fillRect(centerX - size / 2, centerY - size / 2, size, size);
          } else {
            const magnitude = Math.sqrt(magnitudeSq);
            const angle = Math.atan2(velY, velX);
            const lineLen = Math.min(magnitude * 0.2, GRID_SIZE * 0.4);

            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            const d1x = cos45 * cos - sin45 * sin;
            const d1y = cos45 * sin + sin45 * cos;

            const d2x = -cos45 * cos - sin45 * sin;
            const d2y = -cos45 * sin + sin45 * cos;

            ctx.moveTo(centerX - d1x * lineLen, centerY - d1y * lineLen);
            ctx.lineTo(centerX + d1x * lineLen, centerY + d1y * lineLen);

            ctx.moveTo(centerX - d2x * lineLen, centerY - d2y * lineLen);
            ctx.lineTo(centerX + d2x * lineLen, centerY + d2y * lineLen);
          }
        }
      }

      ctx.stroke();
    };

    const renderMode8 = () => {
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "black";

      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const velX = velocityX[y][x];
          const velY = velocityY[y][x];
          const magnitude = Math.sqrt(velX * velX + velY * velY);

          if (magnitude > 0.5) {
            const centerX = x * GRID_SIZE + GRID_SIZE / 2 + velX * 0.3;
            const centerY = y * GRID_SIZE + GRID_SIZE / 2 + velY * 0.3;
            const size = Math.min(3 + magnitude * 0.1, 6);

            ctx.fillRect(centerX - size / 2, centerY - size / 2, size, size);
          }
        }
      }
    };

    const render = () => {
      if (visualizationMode === 0) {
        renderMode0();
      } else if (visualizationMode === 1) {
        renderMode1();
      } else if (visualizationMode === 2) {
        renderMode2();
      } else if (visualizationMode === 3) {
        renderMode3();
      } else if (visualizationMode === 4) {
        renderMode4();
      } else if (visualizationMode === 5) {
        renderMode5();
      } else if (visualizationMode === 6) {
        renderMode6();
      } else if (visualizationMode === 7) {
        renderMode7();
      } else if (visualizationMode === 8) {
        renderMode8();
      }
    };

    // Animation loop
    const animate = () => {
      updateWaves();
      render();
      requestAnimationFrame(animate);
    };

    // Handle window resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const newCols = Math.floor(canvas.width / GRID_SIZE);
      const newRows = Math.floor(canvas.height / GRID_SIZE);

      const newVelX: number[][] = new Array(newRows);
      const newVelY: number[][] = new Array(newRows);
      const newPrevVelX: number[][] = new Array(newRows);
      const newPrevVelY: number[][] = new Array(newRows);

      for (let i = 0; i < newRows; i++) {
        newVelX[i] = new Array(newCols).fill(0);
        newVelY[i] = new Array(newCols).fill(0);
        newPrevVelX[i] = new Array(newCols).fill(0);
        newPrevVelY[i] = new Array(newCols).fill(0);
      }

      velocityX = newVelX;
      velocityY = newVelY;
      prevVelocityX = newPrevVelX;
      prevVelocityY = newPrevVelY;
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("click", handleClick);
    window.addEventListener("resize", handleResize);

    animate();

    // Cleanup
    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("click", handleClick);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const getModeNames = () => [
    "Pulsing Squares",
    "Fade Grid",
    "Funky Squares",
    "Lines",
    "Compass",
    "Wave Grid",
    "Circles",
    "Cross Pattern",
    "Motion Blur"
  ];

  return (
    <Box sx={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      <BackButton />

      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          cursor: "crosshair",
        }}
      />

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
          zIndex: 1000,
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
            zIndex: 1000,
          }}
        >
          <Stack spacing={2}>
            <Typography variant="h6" sx={{ color: "white", mb: 1 }}>
              Propagation
            </Typography>

            <Box>
              <Typography variant="body2" color="white" fontWeight="bold" gutterBottom>
                Current Mode
              </Typography>
              <Typography variant="body2" color="white" sx={{ mb: 1 }}>
                {getModeNames()[currentMode]}
              </Typography>
              <Typography variant="body2" color="white" sx={{ fontSize: "12px" }}>
                Click anywhere on the canvas to cycle through modes
              </Typography>
            </Box>

            <Box>
              <Typography variant="body2" color="white" fontWeight="bold" gutterBottom>
                Controls
              </Typography>
              <Typography variant="body2" color="white" sx={{ fontSize: "12px", lineHeight: 1.6 }}>
                • Move your cursor to create waves
                <br />
                • Click to change visualization mode
                <br />• 9 different visual styles available
              </Typography>
            </Box>

            <Box>
              <Typography variant="body2" color="white" fontWeight="bold" gutterBottom>
                About
              </Typography>
              <Typography variant="body2" color="white" sx={{ fontSize: "12px", lineHeight: 1.6 }}>
                Wave propagation simulation showing how disturbances spread through a 2D grid with different visualization styles.
              </Typography>
            </Box>
          </Stack>
        </Paper>
      )}
    </Box>
  );
};

export default Propagation;
