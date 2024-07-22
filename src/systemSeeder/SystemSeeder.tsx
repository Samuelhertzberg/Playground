import { useEffect, useRef, useState } from "react";
import {
  Engine,
  Render,
  Bodies,
  Body,
  World,
  Composite,
  Runner,
  Vector,
  Events,
  use,
  MouseConstraint,
  Pair,
  Query,
} from "matter-js";
import MatterAttractors from "matter-attractors";
import { Box } from "@mui/material";
import Menu, { SeedingValues } from "./Menu";
import {
  getBoundsDimensions,
  getFusedMass,
  getFusedRadius,
  getFusedVelocity,
  getMassCenter,
  hasOverlap,
} from "./getters";

const SystemSeeder = () => {
  const scene = useRef<HTMLElement>(null);
  const width = document.documentElement.clientWidth;
  const height = document.documentElement.clientHeight;

  const [maxR, setMaxR] = useState(1000);
  const [rotationFactor, setRotateFactor] = useState(0.4);
  const [numberOfBodies, setNumberOfBodies] = useState(1000);
  const [gravityConstant, setGravityConstant] = useState(0.001);

  const onSaveSeedingValues = (values: SeedingValues) => {
    setMaxR(values.maxR);
    setRotateFactor(values.rotationFactor);
    setNumberOfBodies(values.numberOfBodies);
    setGravityConstant(values.gravityConstant);
  };

  /* SETUP */

  use(MatterAttractors);

  // module aliases
  const vector = Vector.create;

  useEffect(() => {
    let dragRef = [-1, -1];
    let focusedBody: Body | undefined = undefined;
    let focusedBodyLocked = false;
    if (!scene.current) return;

    // create an engine
    const engine = Engine.create();
    engine.gravity.y = 0;

    // create a renderer
    const render = Render.create({
      element: scene.current,
      engine: engine,
      options: {
        wireframes: false,
        hasBounds: true,
        width,
        height,
      },
    });

    // The global body list
    const bodies: Body[] = [];

    MatterAttractors.Attractors.gravityConstant = gravityConstant;

    /* SETTERS */

    /**
     *  Sets the focused body
     *  @param newBody The new body to focus on
     */
    const setFocusedBody = (newBody: Body | undefined) => {
      if (!focusedBodyLocked) {
        focusedBody = newBody;
        focusedBodyLocked = true;
        setTimeout(() => {
          focusedBodyLocked = false;
        }, 1000);
      }
    };

    const collideGroup = (group: Body[]) => {
      if (group.length > 1) {
        const newBody = group.reduce((acc, curr) => fuseBodies(acc, curr));
        group.forEach((b) => World.remove(engine.world, b));
        World.add(engine.world, newBody);
        if (group.findIndex((b) => b.id === focusedBody?.id) >= 0) {
          focusedBody = newBody;
        }
      }
    };

    const linkCollisions = (pairs: Pair[]) => {
      const collisions: Record<string, Body[]> = {};
      pairs.forEach(({ bodyA, bodyB }) => {
        collisions[bodyA.id] = [...(collisions[bodyA.id] || []), bodyB];
        collisions[bodyB.id] = [...(collisions[bodyB.id] || []), bodyA];
      });

      const getDescendants = (body: Body): Body[] => {
        const id = body.id;
        if (!collisions[id]) return [];
        const children = collisions[id];
        delete collisions[id];
        return [...children.flatMap(getDescendants), body];
      };

      const groups = [];
      while (Object.keys(collisions).length > 0) {
        const id = Object.keys(collisions)[0];
        // find body
        const body = Composite.allBodies(engine.world).find(
          (b) => b.id === Number(id),
        );
        const group = body ? getDescendants(body) : [];
        groups.push(group);
      }
      return groups;
    };

    const applyGravityForces = (b1: Body, b2: Body) => {
      if (!hasOverlap(b1, b2)) {
        MatterAttractors.Attractors.gravity(b1, b2);
      }
    };

    const init = (bodyCollection: Body[]) => {
      for (let i = 0; i < numberOfBodies; i++) {
        const randAngle = Math.random() * 2 * Math.PI;
        const r = maxR * Math.sqrt(Math.random());
        const x = Math.cos(randAngle) * r + width / 2;
        const y = Math.sin(randAngle) * r + height / 2;
        const a = Math.atan2(height / 2 - y, width / 2 - x) - Math.PI / 2;
        const xDir = (Math.cos(a) * rotationFactor * r) / maxR;
        const yDir = (Math.sin(a) * rotationFactor * r) / maxR;
        const size = 1;
        const mass = 1;
        bodyCollection.push(
          createBody({ x, y }, size, mass, vector(xDir, yDir)),
        );
      }
    };

    /**
     *  Centers the viewport on the focused body, if it exists.
     */
    const lookAtFocusedBody = () => {
      if (focusedBody) {
        const renderDims = getBoundsDimensions(render);
        const bodyDims = getBoundsDimensions(focusedBody);
        const xPadding = (renderDims.width - bodyDims.width) / 2;
        const yPadding = (renderDims.height - bodyDims.height) / 2;
        Render.lookAt(render, focusedBody, vector(xPadding, yPadding));
      }
    };

    /**
     *  Creates a new body and adds it to the engine.
     *  @param position The position of the new body {x, y}
     *  @param radius The radius of the body
     *  @param mass The mass of the body
     *  @param velocity The velocity of the body
     *  @returns The new body
     */
    const createBody = (
      position: Vector,
      radius: number,
      mass: number,
      velocity: Vector,
    ): Body => {
      const body = Bodies.circle(position.x, position.y, radius, {
        plugin: { attractors: [applyGravityForces] },
      });
      body.frictionAir = 0;
      body.friction = 0;
      Body.setMass(body, mass);
      Body.setVelocity(body, velocity);
      body.render.fillStyle = "#ffffff"; //TODO: All bodies are colored white :/
      return body;
    };

    /**
     * @returns the resulting body of a merger between b1 and b2
     */
    const fuseBodies = (b1: Body, b2: Body) =>
      createBody(
        getMassCenter(b1, b2),
        getFusedRadius(b1, b2),
        getFusedMass(b1, b2),
        getFusedVelocity(b1, b2),
      );

    Events.on(engine, "collisionStart", ({ pairs }) => {
      const collisionGroups = linkCollisions(pairs);
      collisionGroups.forEach(collideGroup);
    });

    const mouseConstraint = MouseConstraint.create(engine);

    /**
     * Queries the engine for the bodies that are under the mouse and sets the focused body.
     */
    Events.on(mouseConstraint, "mousedown", (e) => {
      const zoom = getBoundsDimensions(render).width / width;
      const clickedCoords = {
        x: e.mouse.position.x * zoom + render.bounds.min.x,
        y: e.mouse.position.y * zoom + render.bounds.min.y,
      };
      const clickedPoints = Query.point(
        Composite.allBodies(engine.world),
        clickedCoords,
      );
      if (clickedPoints.length > 0) {
        setFocusedBody(clickedPoints[0]);
        runner.enabled = true;
      }
    });
    Events.on(engine, "afterUpdate", lookAtFocusedBody);

    document.addEventListener("wheel", (e: WheelEvent) => {
      const d = e.deltaY;
      const renderDim = getBoundsDimensions(render);
      const zoom = (15 * width) / renderDim.width;
      const aspectRatio = width / height;
      const xOffset = e.offsetX / width;
      const yOffset = e.offsetY / height;
      const xZoomOffset = focusedBody ? [0.5, 0.5] : [xOffset, 1 - xOffset];
      const yZoomOffset = focusedBody ? [0.5, 0.5] : [yOffset, 1 - yOffset];
      render.bounds.min.x =
        render.bounds.min.x - d * aspectRatio * (1 / zoom) * xZoomOffset[0];
      render.bounds.max.x =
        render.bounds.max.x + d * aspectRatio * (1 / zoom) * xZoomOffset[1];
      render.bounds.min.y =
        render.bounds.min.y - d * (1 / zoom) * yZoomOffset[0];
      render.bounds.max.y =
        render.bounds.max.y + d * (1 / zoom) * yZoomOffset[1];
    });

    document.addEventListener("mousedown", (e: MouseEvent) => {
      dragRef = [e.clientX, e.clientY];
    });

    document.addEventListener("mouseup", () => {
      dragRef = [-1, -1];
    });

    /**
     * Pans the viewport, if the dragRef is set.
     */
    document.addEventListener("mousemove", (e: MouseEvent) => {
      if (dragRef[0] > 0 && dragRef[1] > 0) {
        const dx = e.clientX - dragRef[0];
        const dy = e.clientY - dragRef[1];
        const multiplier = getBoundsDimensions(render).width / width;
        render.bounds.min.x = render.bounds.min.x - dx * multiplier;
        render.bounds.max.x = render.bounds.max.x - dx * multiplier;
        render.bounds.min.y = render.bounds.min.y - dy * multiplier;
        render.bounds.max.y = render.bounds.max.y - dy * multiplier;
        dragRef = [e.clientX, e.clientY];
        setFocusedBody(undefined); //Unsets the focused body, unlocking the viewport
      }
    });

    /* INITIALIZATION */

    // Populate the list of bodies
    init(bodies);

    // add all of the bodies to the world
    Composite.add(engine.world, bodies);

    // run the renderer
    Render.run(render);

    // create runner
    const runner = Runner.create();

    // run the engine
    Runner.run(runner, engine);

    return () => {
      Render.stop(render);
      World.clear(engine.world, true); //TODO
      Engine.clear(engine);
      render.canvas.remove();
      // render.canvas = null // TODO
      // render.context = null
      render.textures = {};
    };
  }, [
    width,
    height,
    maxR,
    rotationFactor,
    numberOfBodies,
    gravityConstant,
    vector,
  ]);

  return (
    <Box ref={scene} sx={{
      width,
      height,
      p: 0,
      m: 0,
    }}>
      <Menu
        SeedingValues={{
          maxR,
          rotationFactor,
          numberOfBodies,
          gravityConstant,
        }}
        setSeedingValues={onSaveSeedingValues}
      />
    </Box>
  );
};

export default SystemSeeder;
