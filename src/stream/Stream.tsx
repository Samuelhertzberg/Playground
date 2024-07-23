import { P5CanvasInstance, ReactP5Wrapper } from "@p5-wrapper/react";
import { Element, Vector } from "p5";
import { scale } from "../helpers/math";

type Particle = {
  position: Vector;
  velocity: Vector;
  originalVelocity: Vector;
  positionHistory: Vector[];
};

const MIN_X = -300;
const MAX_X = 300;
const MIN_Y = -300;
const MAX_Y = 300;
const NUM_PARTICLES = 1000;
const PARTICLE_MAX_SPEED = 50;
const PARTICLE_SPEED_VARIABILITY = 0.95;
const TRAIL_LENGTH = 4;
const CURSOR_AREA = 250;
const OBSTACLE_AREA = 250;

const sketch = (p5: P5CanvasInstance) => {
  let particles: Particle[] = [];
  let obstacles: Vector[] = [];
  let forceSlider: Element

  p5.setup = () => {
    const canvas = p5.createCanvas(window.innerWidth, window.innerHeight);
    canvas.id("stream-canvas");
    forceSlider = p5.createSlider(-1, 1, 1, 0.01);
    forceSlider.position(20, 60);
    p5.createDiv("↺")
      .position(20, 90)
      .mouseClicked(() => {
        obstacles = [];
      })
      .style("cursor", "pointer")
      .style("font-size", "24px")
      .attribute("type", "submit");
  };

  p5.mouseClicked = (e: {target: {id: string}}) => {
    console.log(e.target);
    console.log(e.target.id);
    
    if (e.target.id !== "stream-canvas") return;
    obstacles.push(p5.createVector(p5.mouseX, p5.mouseY));
  };

  p5.mouseMoved = () => {};

  p5.mouseDragged = () => {};

  p5.mousePressed = () => {};

  p5.mouseReleased = () => {};

  const applyForce = (
    particle: Particle,
    forceOrigin: Vector,
    area: number
  ) => {
    const dist = p5.dist(
      forceOrigin.x,
      forceOrigin.y,
      particle.position.x,
      particle.position.y
    );
    const normDist = scale(dist, 0, area, 1, 0);
    if (dist < area) {
      const repelForce = forceOrigin
        .copy()
        .sub(particle.position)
        .mult(normDist**2)
        .mult(forceSlider.value() as number);

      // const speedForce = p5.createVector( particle.velocity.x * normDist, 0)
      particle.position = particle.position.sub(repelForce);
      // particle.position = particle.position.sub(speedForce);
    }
  };

  const applyCursorForce = (particles: Particle[]) => {
    particles.forEach((particle) => {
      applyForce(particle, p5.createVector(p5.mouseX, p5.mouseY), CURSOR_AREA);
    });
  };

  const applyObsticleForces = (particles: Particle[]) => {
    particles.forEach((particle) => {
      obstacles.forEach((obstacle) => {
        applyForce(particle, obstacle, OBSTACLE_AREA);
      });
    });
  };

  const createNewParticle = (): Particle => {
    const position = p5.createVector(
      MIN_X,
      p5.random(window.innerHeight / 2) + window.innerHeight / 4
      // window.innerHeight / 2
    );
    const velocity = p5.createVector(
      p5.random(
        PARTICLE_MAX_SPEED * PARTICLE_SPEED_VARIABILITY,
        PARTICLE_MAX_SPEED
      ),
      0
    );
    return {
      position,
      velocity,
      originalVelocity: velocity.copy(),
      positionHistory: [position.copy()],
    };
  };

  const updateParticles = () => {
    particles = particles.map((particle) => {
      return {
        ...particle,
        position: particle.position.add(particle.velocity),
        positionHistory: [
          particle.position.copy(),
          ...particle.positionHistory,
        ].slice(0, TRAIL_LENGTH),
        velocity: particle.originalVelocity.copy(),
      };
    });
    particles = particles.filter(
      ({ position: { x, y } }) =>
        x > MIN_X * 2 &&
        x < window.innerWidth + MAX_X &&
        y > MIN_Y &&
        y < window.innerHeight + MAX_Y
    );
    if (particles.length < NUM_PARTICLES) {
      for (let i = 0; i < NUM_PARTICLES / 100; i++) {
        particles.push(createNewParticle());
      }
    }

    applyCursorForce(particles);
    applyObsticleForces(particles);
  };

  const drawParticle = (p: Particle) => {
    p5.push();
    p5.noFill();
    p5.stroke(255);
    p5.strokeWeight(1);
    p5.beginShape();
    for (let i = 0; i < p.positionHistory.length; i++) {
      const pos = p.positionHistory[i];
      p5.curveVertex(pos.x, pos.y);
    }
    p5.endShape();

    p5.pop();
  };

  p5.draw = () => {
    p5.background(0, 254);
    p5.push();
    particles.forEach(drawParticle);
    updateParticles();
    p5.pop();
  };
};

const Stream = () => {
  return <ReactP5Wrapper sketch={sketch} />;
};

export default Stream;
