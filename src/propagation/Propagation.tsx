import { P5CanvasInstance, ReactP5Wrapper } from "@p5-wrapper/react";
import { clamp } from "../helpers/math";

const rows = 50;
const neighbourForceFactor = 1;
const originForceFactor = 0.01;
const cursorForceFactor = 200;
const modes = [
  "circle",
  "square",
  "funky square",
  "line",
  "compass",
  "fade",
  "funky fade",
  "wave",
];

const sketch = (p5: P5CanvasInstance) => {
  const cellSize = window.innerHeight / rows;
  const cols = Math.round(window.innerWidth / cellSize);
  let mode = 0;
  const displaceMentGrid = Array.from({ length: cols }, () =>
    Array.from({ length: rows }, () => p5.createVector(0, 0))
  );

  // Get the 8 neighbours
  const getNeighbourDisplacement = (x: number, y: number) => {
    const neighbours = [
      [x - 1, y - 1],
      [x, y - 1],
      [x + 1, y - 1],
      [x - 1, y],
      [x + 1, y],
      [x - 1, y + 1],
      [x, y + 1],
      [x + 1, y + 1],
    ];
    return neighbours
      .filter(([x, y]) => x >= 0 && x < cols && y >= 0 && y < rows)
      .map(([x, y]) => displaceMentGrid[x][y]);
  };

  const getNeighbourForce = (x: number, y: number) => {
    const { x: xDisp, y: yDisp } = displaceMentGrid[x][y];

    const neighbours = getNeighbourDisplacement(x, y);
    let xForce = 0;
    let yForce = 0;

    neighbours.forEach((n) => {
      xForce += n.x - xDisp;
      yForce += n.y - yDisp;
    });

    xForce /= neighbours.length;
    yForce /= neighbours.length;

    return p5.createVector(xForce, yForce).mult(neighbourForceFactor);
  };

  const getCursorForce = (x: number, y: number) => {
    const cursorX = p5.mouseX;
    const cursorY = p5.mouseY;
    const movedX = p5.movedX;
    const movedY = p5.movedY;
    const distance = p5.dist(cursorX, cursorY, x * cellSize, y * cellSize);
    const distanceScaling = 1 / Math.max(distance ** 2, 1);
    return p5
      .createVector(movedX, movedY)
      .mult(cursorForceFactor * distanceScaling);
  };

  const getOriginForce = (x: number, y: number) => {
    const cX = displaceMentGrid[x][y].x;
    const cY = displaceMentGrid[x][y].y;
    return p5.createVector(-cX, -cY).mult(originForceFactor);
  };

  const propagateDisplacement = () => {
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const cursorForce = getCursorForce(i, j);
        const neighbourForce = getNeighbourForce(i, j);
        const originForce = getOriginForce(i, j);
        displaceMentGrid[i][j].add(cursorForce);
        displaceMentGrid[i][j].add(neighbourForce);
        displaceMentGrid[i][j].add(originForce);
      }
    }
  };

  p5.setup = () => {
    p5.createCanvas(window.innerWidth, window.innerHeight);
  };

  let interval = setInterval(() => {
    mode = (mode + 1) % modes.length;
  }, 5000);

  p5.mouseClicked = () => {
    mode = (mode + 1) % modes.length;
    clearInterval(interval);
    interval = setInterval(() => {
      mode = (mode + 1) % modes.length;
    }, 5000);
  };

  const drawRow = (r: number) => {
    if (modes[mode] === "wave") {
      p5.noFill();
      p5.stroke(0);
      p5.strokeWeight(1);
      p5.beginShape();
      for (let c = 0; c < cols - 1; c++) {
        const x = c * cellSize;
        const y = r * cellSize;
        const displacement = displaceMentGrid[c][r];
        const xDisp = clamp(displacement.x, -50, 50);
        const yDisp = clamp(displacement.y, -50, 50);
        p5.curveVertex(x + xDisp, y + yDisp);
      }
      p5.endShape();
    }
  };

  p5.draw = () => {
    p5.push();
    p5.background(255);
    for (let r = 0; r < rows; r++) {
      if (modes[mode] === "wave") {
        drawRow(r);
        continue;
      }
      for (let c = 0; c < cols; c++) {
        const displacement = displaceMentGrid[c][r];
        const xDisp = clamp(displacement.x, -20, 20);
        const yDisp = clamp(displacement.y, -20, 20);
        const x = c * cellSize + xDisp;
        const y = r * cellSize + yDisp;
        p5.fill(0);
        if (modes[mode] === "circle") {
          p5.strokeCap(p5.ROUND);
          p5.strokeWeight(cellSize);
          p5.line(x, y, x, y);
        } else if (modes[mode] === "square") {
          p5.strokeCap(p5.SQUARE);
          p5.strokeWeight(cellSize * 1.05);
          p5.line(x, y, x + cellSize * 1.05, y);
        } else if (modes[mode] === "funky square") {
          p5.strokeCap(p5.SQUARE);
          p5.strokeWeight(cellSize * 1.05);
          p5.line(x, y, x + cellSize * 1.05 + xDisp, y + yDisp);
        } else if (modes[mode] === "line") {
          p5.strokeCap(p5.SQUARE);
          p5.strokeWeight(2);
          p5.line(x, y, x + xDisp, y + yDisp);
        } else if (modes[mode] === "fade") {
          p5.strokeCap(p5.SQUARE);
          p5.strokeWeight(cellSize);
          p5.stroke(0, displacement.mag() ** 2);
          p5.line(x, y, x + cellSize * 1.05, y);
        } else if (modes[mode] === "funky fade") {
          p5.strokeCap(p5.SQUARE);
          p5.strokeWeight(cellSize);
          p5.stroke(0, displacement.mag() ** 2);
          p5.line(x, y, x + cellSize * 1.05 + xDisp, y + yDisp);
        } else if (modes[mode] === "compass") {
          p5.strokeCap(p5.SQUARE);
          p5.strokeWeight(2);
          const angle = p5.atan2(yDisp, xDisp);
          const xDir = Math.abs(xDisp) > 0.1 ? p5.cos(angle) * cellSize : 0;
          const yDir = Math.abs(yDisp) > 0.1 ? p5.sin(angle) * cellSize : 0;
          p5.line(x, y, x + xDir, y + yDir);
        }
      }
    }
    propagateDisplacement();
    p5.pop();
  };
};

const Propagation = () => {
  return <ReactP5Wrapper sketch={sketch} />;
};

export default Propagation;
