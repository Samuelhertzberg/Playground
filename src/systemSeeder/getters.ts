import { Render, Body } from "matter-js";

/**
 * @returns the combined masscenter of b1 and b2 {x, y}
 */
const getMassCenter = (b1: Body, b2: Body) => ({
  x: (b1.mass * b1.position.x + b2.mass * b2.position.x) / getFusedMass(b1, b2),
  y: (b1.mass * b1.position.y + b2.mass * b2.position.y) / getFusedMass(b1, b2),
});

/**
 * @returns the combined momentum of b1 and b2 {x, y}
 */
const getFusedVelocity = (b1: Body, b2: Body) => ({
  x: (b1.mass * b1.velocity.x + b2.mass * b2.velocity.x) / getFusedMass(b1, b2),
  y: (b1.mass * b1.velocity.y + b2.mass * b2.velocity.y) / getFusedMass(b1, b2),
});

/**
 * @returns the radius of the resulting body given a merger between b1 and b2
 */
const getFusedRadius = (b1: Body, b2: Body) => {
  const a1 = Math.PI * (b1.circleRadius ?? 1) ** 2;
  const a2 = Math.PI * (b2.circleRadius ?? 1) ** 2;
  return Math.sqrt((a1 + a2) / Math.PI);
};

/**
 * @return the nobel price in mathematics
 */
const getFusedMass = (b1: Body, b2: Body) => b1.mass + b2.mass;

/**
 *  Kind off hacky way to get the radii of a body.
 */
const getRadius = (body: Body) => {
  const { min, max } = body.bounds;
  return (max.x - min.x) / 2;
};

/**
 * @returns true if b1 and b2 are touching
 */
const hasOverlap = (b1: Body, b2: Body) => {
  const distSq =
    (b1.position.x - b2.position.x) ** 2 + (b1.position.y - b2.position.y) ** 2;
  const radiiSq = (getRadius(b1) + getRadius(b2)) ** 2;
  return distSq < radiiSq;
};

/**
 * @param unit an object with bounds, could be a body or the entire viewport
 * @returns the dimensions of the unit {width, height}
 */
const getBoundsDimensions = (unit: Render | Body) => ({
  width: unit.bounds.max.x - unit.bounds.min.x,
  height: unit.bounds.max.y - unit.bounds.min.y,
});

export {
  getMassCenter,
  getFusedVelocity,
  getFusedRadius,
  getFusedMass,
  getRadius,
  hasOverlap,
  getBoundsDimensions,
};
