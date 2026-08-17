import { P5CanvasInstance, ReactP5Wrapper } from "@p5-wrapper/react";
import p5, { Vector } from "p5";
import { scale } from "../helpers/math";

const MAX_TRACK_CHECKPOINT_DISTANCE = 10;
const RACER_COUNT = 1000;
const CHECKPOINT_DISTANCE_THRESHOLD = 25;
const RACER_STROKE_WEIGHT = 3;
const RACER_LOOKAHEAD = 25;

const MAX_MAX_SPEED = 10;
const MIN_MAX_SPEED = 1;
const MAX_SPEED_VARIABILITY = 1;
const MIN_SPEED_VARIABILITY = 0;
const MAX_MAX_ACCELERATION = 2;
const MIN_MAX_ACCELERATION = 0.01;
const MAX_ACCELERATION_VARIABILITY = 1;
const MIN_ACCELERATION_VARIABILITY = 0;

type Racer = {
  position: Vector;
  velocity: Vector;
  characteristics: number;
  nextCheckpoint: number;
};

const sketch = (p5: P5CanvasInstance) => {
  let mouseDown = false;
  let track: Vector[] = [];
  let racers: Racer[] = [];

  let maxSpeedSlider: p5.Element;
  let speedVariabilitySlider: p5.Element;
  let maxAccelerationSlider: p5.Element;
  let accelerationVariabilitySlider: p5.Element;

  p5.setup = () => {
    p5.createCanvas(window.innerWidth, window.innerHeight);
    maxSpeedSlider = p5.createSlider(MIN_MAX_SPEED, MAX_MAX_SPEED, 5, 0.01);
    speedVariabilitySlider = p5.createSlider(
      MIN_SPEED_VARIABILITY,
      MAX_SPEED_VARIABILITY,
      0.5,
      0.01
    );
    maxAccelerationSlider = p5.createSlider(
      MIN_MAX_ACCELERATION,
      MAX_MAX_ACCELERATION,
      0.5,
      0.01
    );
    accelerationVariabilitySlider = p5.createSlider(
      MIN_ACCELERATION_VARIABILITY,
      MAX_ACCELERATION_VARIABILITY,
      0.5,
      0.01
    );
    maxSpeedSlider.position(10, 60);
    speedVariabilitySlider.position(10, 80);
    maxAccelerationSlider.position(10, 100);
    accelerationVariabilitySlider.position(10, 120);
  };

  const compressTrack = () => {
    const compressedTrack: Vector[] = [track[0]];
    for (let i = 1; i < track.length; i++) {
      while (
        track[i + 1] &&
        p5.dist(
          track[i + 1].x,
          track[i + 1].y,
          compressedTrack[compressedTrack.length - 1].x,
          compressedTrack[compressedTrack.length - 1].y
        ) < MAX_TRACK_CHECKPOINT_DISTANCE
      ) {
        i++;
      }

      compressedTrack.push(track[i]);
    }
    return compressedTrack;
  };

  const getSpeedValues = () => {
    const maxSpeed = maxSpeedSlider.value() as number;
    const speedVariability = speedVariabilitySlider.value() as number;
    const maxAcceleration = maxAccelerationSlider.value() as number;
    const accelerationVariability =
      accelerationVariabilitySlider.value() as number;
    return {
      maxSpeed,
      minSpeed: maxSpeed * (1 - speedVariability),
      maxAcceleration,
      minAcceleration: maxAcceleration * (1 - accelerationVariability),
    };
  };

  const getRacerMaxSpeed = (racer: Racer) => {
    const { maxSpeed, minSpeed } = getSpeedValues();
    return scale(racer.characteristics, 0, 1, minSpeed, maxSpeed);
  };

  const getRacerMaxAcceleration = (racer: Racer) => {
    const { maxAcceleration, minAcceleration } = getSpeedValues();
    return scale(racer.characteristics, 0, 1, minAcceleration, maxAcceleration);
  };

  const createRacers = () => {
    for (let i = 0; i < RACER_COUNT; i++) {
      const racer: Racer = {
        position: track[0].copy(),
        velocity: p5.createVector(0, 0),
        characteristics: Math.random(),
        nextCheckpoint: 1,
      };
      racers.push(racer);
    }
  };

  type p5MouseEvent = MouseEvent & { target: { type: string } };

  p5.mousePressed = (e: p5MouseEvent) => {
    if (e.target?.type === "range") return;
    mouseDown = true;
    track = [];
    racers = [];
  };

  p5.mouseReleased = (e: p5MouseEvent) => {
    if (e.target?.type === "range") return;
    mouseDown = false;
    track = compressTrack();
    createRacers();
  };

  p5.mouseDragged = () => {
    if (mouseDown) {
      track.push(p5.createVector(p5.mouseX, p5.mouseY));
    }
  };

  const updateRacer = (racer: Racer) => {
    const checkpoint = track[racer.nextCheckpoint].copy();
    const desiredVelocity = p5
      .createVector(checkpoint.x, checkpoint.y)
      .sub(racer.position)
      .normalize()
      .mult(getRacerMaxSpeed(racer));
    const acceleration = desiredVelocity
      .sub(racer.velocity)
      .limit(getRacerMaxAcceleration(racer));
    racer.velocity.add(acceleration);
    racer.position.add(racer.velocity);
    for (let i = 0; i < RACER_LOOKAHEAD; i++) {
      const lookaheadIndex = (racer.nextCheckpoint + i) % track.length;
      const lookaheadPoint = track[lookaheadIndex];
      const distance = p5.dist(
        racer.position.x,
        racer.position.y,
        lookaheadPoint.x,
        lookaheadPoint.y
      );
      if (distance < CHECKPOINT_DISTANCE_THRESHOLD) {
        racer.nextCheckpoint = (lookaheadIndex + 1) % track.length;
        break;
      }
    }
  };

  const updateRacers = () => {
    racers.forEach((racer) => {
      updateRacer(racer);
    });
  };

  const drawTrack = () => {
    if (track.length === 0) return;
    p5.push();
    p5.stroke(100);
    for (let i = 0; i < track.length - 1; i++) {
      p5.line(track[i].x, track[i].y, track[i + 1].x, track[i + 1].y);
    }
    if (!mouseDown)
      p5.line(
        track[track.length - 1].x,
        track[track.length - 1].y,
        track[0].x,
        track[0].y
      );
    p5.pop();
  };

  const drawRacers = () => {
    p5.push();
    racers.forEach((racer) => {
      p5.stroke(255);
      p5.strokeWeight(RACER_STROKE_WEIGHT);
      p5.line(
        racer.position.x,
        racer.position.y,
        racer.position.x + racer.velocity.x,
        racer.position.y + racer.velocity.y
      );
    });
    p5.pop();
  };

  const drawText = () => {
    p5.textSize(16);
    p5.fill(130);
    p5.stroke(0);
    p5.strokeWeight(4);
    p5.text("Max Speed", 150, 75);
    p5.text("Speed Variability", 150, 95);
    p5.text("Max Acceleration", 150, 115);
    p5.text("Acceleration Variability", 150, 135);
  };

  p5.draw = () => {
    p5.push();
    p5.background(0, 10);
    drawTrack();
    drawRacers();
    drawText();
    updateRacers();
    p5.pop();
  };
};

const Circuit = () => {
  return <ReactP5Wrapper sketch={sketch} />;
};

export default Circuit;
