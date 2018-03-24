'use strict';

// To provide equal conditions for all players, input should use
// some type of fixedUpdate. In this implementation input uses
// THREE.js updates, which might be not equal in terms of time
// for different players depending on their devices.

class InputManager {
  constructor(mouseMoveHandler) {
    this.currentX = 0;
    this.currentY = 0;
    this.stack = [];
    this.turnedOn = false;

    this.onmousemove = (e) => {       // TODO: make deferred
      let mouseInput = mouseMoveHandler(e);

      this.currentX = Math.floor(mouseInput.x);
      this.currentY = Math.floor(mouseInput.y);
    };

    document.body.onmousemove = this.onmousemove;
  }

  turnOn() {
    this.turnedOn = true;
  }

  turnOff() {
    this.turnedOn = false;
  }

  update() {
    if (!this.turnedOn) {
      return;
    }

    this.stack.push({
      x: this.currentX,
      y: this.currentY
    })
  }

  getInput() {
    return {
      x: this.currentX,
      y: this.currentY
    }
  }

  flushStackAsInt16Array() {
    // [ x0, y0, x1, y1, ..., xn, yn ]

    let length = this.stack.length;

    let inputStack = new Int16Array(2 * length);
    let idx = 0;

    this.stack.forEach(function (coords) {
      inputStack[idx++] = coords.x;
      inputStack[idx++] = coords.y;
    });

    this.stack = [];

    return inputStack;
  }
}

const inputManager = new InputManager(mouseMoveHandler);

function mouseMoveHandler(e) {
  let dirX = e.clientX;
  let dirY = e.clientY;

  return {
    x: Math.round((dirX - window.innerWidth / 2)),
    y: Math.round((window.innerHeight / 2 - dirY))
  }
}
