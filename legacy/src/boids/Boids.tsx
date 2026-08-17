import { P5CanvasInstance, ReactP5Wrapper, Sketch } from "@p5-wrapper/react";
import p5, { Vector } from "p5";
import { useState } from "react";
import { Box, Button, Paper, Slider, Stack, Typography } from "@mui/material";
import BackButton from "../components/BackButton";
import useMouseActivity from "../hooks/useMouseActivity";

const flockSize = 200;

type Boid = {
  position: p5.Vector;
  velocity: p5.Vector;
  acceleration: p5.Vector;
  maxForce: number;
  maxSpeed: number;
  positionHistory: p5.Vector[];
};

type SketchProps = {
  alignment: number;
  cohesion: number;
  separation: number;
};

const sketch: Sketch<SketchProps> = (p5: P5CanvasInstance<SketchProps>) => {
  let alignment = 0.7;
  let cohesion = 0.6;
  let separation = 0.4;

  p5.updateWithProps = (props: SketchProps) => {
    if (props.alignment !== undefined) alignment = props.alignment;
    if (props.cohesion !== undefined) cohesion = props.cohesion;
    if (props.separation !== undefined) separation = props.separation;
  };

  p5.setup = () => {
    p5.createCanvas(window.innerWidth, window.innerHeight);
  };
  const flock: Boid[] = [];

  p5.preload = () => {
    for (let i = 0; i < flockSize; i++) {
      flock.push({
        position: p5.createVector(
          p5.random(0, window.innerWidth),
          p5.random(0, window.innerHeight),
        ),
        velocity: p5.createVector(p5.random(-1, 1), p5.random(-1, 1)),
        acceleration: p5.createVector(),
        maxForce: 0.3,
        maxSpeed: 2,
        positionHistory: [],
      });
      // flock.push({
      //   position: p5.createVector((window.innerWidth/4),0),
      //   velocity: p5.createVector(0,0),
      //   acceleration: p5.createVector(),
      //   maxForce: 0.3,
      //   maxSpeed: 2,
      // });
      // flock.push({
      //   position: p5.createVector(-(window.innerWidth/4),0),
      //   velocity: p5.createVector(0,0),
      //   acceleration: p5.createVector(),
      //   maxForce: 0.3,
      //   maxSpeed: 2,
      // });
      // flock.push({
      //   position: p5.createVector(0,window.innerHeight/4),
      //   velocity: p5.createVector(0,0),
      //   acceleration: p5.createVector(),
      //   maxForce: 0.3,
      //   maxSpeed: 2,
      // });
      // flock.push({
      //   position: p5.createVector(0,0),
      //   velocity: p5.createVector(0,0),
      //   acceleration: p5.createVector(),
      //   maxForce: 0.3,
      //   maxSpeed: 2,
      // });
    }
  };

  const applyAlignment = (boid: Boid) => {
    const perceptionRadius = 100;
    const steering = p5.createVector();
    let total = 0;

    for (const other of flock) {
      const d = p5.dist(
        boid.position.x,
        boid.position.y,
        boid.position.z,
        other.position.x,
        other.position.y,
        other.position.z,
      );
      if (other !== boid && d < perceptionRadius) {
        steering.add(other.velocity);
        total++;
      }
    }

    if (total > 0) {
      steering.div(total);
      steering.setMag(boid.maxSpeed);
      steering.sub(boid.velocity);
      steering.limit(boid.maxForce);
    }

    return steering;
  };

  const wrapEdges = (boid: Boid) => {
    if (boid.position.x > p5.width) {
      boid.position.x = 0;
      boid.positionHistory = [];
    } else if (boid.position.x < 0) {
      boid.position.x = p5.width;
      boid.positionHistory = [];
    }

    if (boid.position.y > p5.height) {
      boid.position.y = 0;
      boid.positionHistory = [];
    } else if (boid.position.y < 0) {
      boid.position.y = p5.height;
      boid.positionHistory = [];
    }
  };

  const applyCohesion = (boid: Boid) => {
    const perceptionRadius = 100;
    const steering = p5.createVector();
    let total = 0;

    for (const other of flock) {
      const d = p5.dist(
        boid.position.x,
        boid.position.y,
        boid.position.z,
        other.position.x,
        other.position.y,
        other.position.z,
      );
      if (other !== boid && d < perceptionRadius) {
        steering.add(other.position);
        total++;
      }
    }

    if (total > 0) {
      steering.div(total);
      steering.sub(boid.position);
      steering.setMag(boid.maxSpeed);
      steering.sub(boid.velocity);
      steering.limit(boid.maxForce);
    }

    return steering;
  };

  const applySeparation = (boid: Boid) => {
    const perceptionRadius = 50;
    const steering = p5.createVector();
    let total = 0;

    for (const other of flock) {
      const d = p5.dist(
        boid.position.x,
        boid.position.y,
        boid.position.z,
        other.position.x,
        other.position.y,
        other.position.z,
      );
      if (other !== boid && d < perceptionRadius) {
        const diff = Vector.sub(boid.position, other.position);
        diff.div(d);
        steering.add(diff);
        total++;
      }
    }

    if (total > 0) {
      steering.div(total);
      steering.setMag(boid.maxSpeed);
      steering.sub(boid.velocity);
      steering.limit(boid.maxForce);
    }

    return steering;
  };

  p5.draw = () => {
    p5.background(0);
    p5.noStroke();

    for (const boid of flock) {
      const alignmentForce = applyAlignment(boid);
      const cohesionForce = applyCohesion(boid);
      const separationForce = applySeparation(boid);

      alignmentForce.mult(alignment);
      cohesionForce.mult(cohesion);
      separationForce.mult(separation);

      boid.acceleration.add(alignmentForce);
      boid.acceleration.add(cohesionForce);
      boid.acceleration.add(separationForce);

      boid.position.add(boid.velocity);
      boid.positionHistory?.push(boid.position.copy());
      boid.positionHistory = boid.positionHistory.slice(-5);
      boid.velocity.add(boid.acceleration);
      boid.velocity.limit(2);
      boid.acceleration.mult(0);
      wrapEdges(boid);
    }

    flock.forEach((boid) => {
      p5.push();
      p5.strokeWeight(6);
      p5.stroke(255);
      for (let i = 0; i < boid.positionHistory.length - 1; i++) {
        p5.line(
          boid.positionHistory[i].x,
          boid.positionHistory[i].y,
          boid.positionHistory[i + 1].x,
          boid.positionHistory[i + 1].y,
        );
      }
      p5.pop();
    });
  };
};

const Boids = () => {
  const [controlsOpen, setControlsOpen] = useState(false);
  const [alignment, setAlignment] = useState(0.7);
  const [cohesion, setCohesion] = useState(0.6);
  const [separation, setSeparation] = useState(0.4);

  const { opacity: uiOpacity } = useMouseActivity(3000, 0);

  return (
    <Box sx={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      <BackButton />

      <ReactP5Wrapper
        sketch={sketch}
        alignment={alignment}
        cohesion={cohesion}
        separation={separation}
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
              Boids
            </Typography>

            <Box>
              <Typography variant="body2" color="white" gutterBottom>
                Alignment: {alignment.toFixed(1)}
              </Typography>
              <Slider
                value={alignment}
                onChange={(_, value) => setAlignment(value as number)}
                min={0}
                max={2}
                step={0.1}
                size="small"
              />
            </Box>

            <Box>
              <Typography variant="body2" color="white" gutterBottom>
                Cohesion: {cohesion.toFixed(1)}
              </Typography>
              <Slider
                value={cohesion}
                onChange={(_, value) => setCohesion(value as number)}
                min={0}
                max={2}
                step={0.1}
                size="small"
              />
            </Box>

            <Box>
              <Typography variant="body2" color="white" gutterBottom>
                Separation: {separation.toFixed(1)}
              </Typography>
              <Slider
                value={separation}
                onChange={(_, value) => setSeparation(value as number)}
                min={0}
                max={2}
                step={0.1}
                size="small"
              />
            </Box>

            <Box>
              <Typography variant="body2" color="white" fontWeight="bold" gutterBottom>
                Controls
              </Typography>
              <Typography variant="body2" color="white" sx={{ fontSize: "12px", lineHeight: 1.6 }}>
                Adjust the sliders to change boid behavior:
                <br />
                • Alignment: Steer towards average heading
                <br />
                • Cohesion: Move towards center of flock
                <br />• Separation: Avoid crowding neighbors
              </Typography>
            </Box>
          </Stack>
        </Paper>
      )}
    </Box>
  );
};

export default Boids;
