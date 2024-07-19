import { P5CanvasInstance, ReactP5Wrapper, Sketch } from "@p5-wrapper/react";
import p5, { Vector } from "p5";

const flockSize = 200;

type Boid = {
  position: p5.Vector;
  velocity: p5.Vector;
  acceleration: p5.Vector;
  maxForce: number;
  maxSpeed: number;
  positionHistory: p5.Vector[];
};

const sketch: Sketch = (p5: P5CanvasInstance) => {
  let alignSlider: p5.Element;
  let cohesionSlider: p5.Element;
  let separationSlider: p5.Element;

  p5.setup = () => {
    p5.createCanvas(window.innerWidth, window.innerHeight);
    alignSlider = p5.createSlider(0, 2, 0.7, 0.1);
    cohesionSlider = p5.createSlider(0, 2, 0.6, 0.1);
    separationSlider = p5.createSlider(0, 2, 0.4, 0.1);
    alignSlider.position(10, 10 + 40);
    cohesionSlider.position(10, 30 + 40);
    separationSlider.position(10, 50 + 40);
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
      const alignment = applyAlignment(boid);
      const cohesion = applyCohesion(boid);
      const separation = applySeparation(boid);

      alignment.mult(alignSlider.value() as number);
      cohesion.mult(cohesionSlider.value() as number);
      separation.mult(separationSlider.value() as number);

      boid.acceleration.add(alignment);
      boid.acceleration.add(cohesion);
      boid.acceleration.add(separation);

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
  return <ReactP5Wrapper sketch={sketch} />;
};

export default Boids;
