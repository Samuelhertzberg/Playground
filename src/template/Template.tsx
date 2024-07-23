import { P5CanvasInstance, ReactP5Wrapper } from "@p5-wrapper/react";

const sketch = (p5: P5CanvasInstance) => {
  p5.setup = () => {
    p5.createCanvas(window.innerWidth, window.innerHeight);
  };

  p5.mouseClicked = () => {};

  p5.mouseMoved = () => {};

  p5.mouseDragged = () => {};

  p5.mousePressed = () => {};

  p5.mouseReleased = () => {};

  p5.draw = () => {
    p5.push();
    p5.pop();
  };
};

const Template = () => {
  return <ReactP5Wrapper sketch={sketch} />;
};

export default Template;
