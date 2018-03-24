'use strict';

const FRAME_RATE = 60;
const MAX_ROTATION_SPEED = Math.PI / 40;
const MIN_ROTATION_SPEED = 0.02;
const PLAYER_SPEED = 0.1;
const PI2 = 2 * Math.PI;

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0xffffff );

const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 1, 6);
camera.position.z = 6;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

class GameFieldObject {
  constructor(posX, posY, rotation, color) {
    this.geometry = new THREE.BoxGeometry(1, 1, .1);
    this.material = new THREE.MeshBasicMaterial({ color: color ? color : 0x433f81 });
    this.mesh = new THREE.Mesh(this.geometry, this.material);

    this.mesh.position.x = posX;
    this.mesh.position.y = posY;
    this.mesh.rotation.z = rotation;

    this.deltaX = null;
    this.deltaY = null;
    this.deltaZ = null;
  }

  updatePosition(x, y) {
    this.mesh.position.x = x;
    this.mesh.position.y = y;
  }

  updatePositionDelta(x, y, time) {
    this.deltaX = (x - this.mesh.position.x) / (time * FRAME_RATE / 1000);
    this.deltaY = (y - this.mesh.position.y) / (time * FRAME_RATE / 1000);
  }

  updateRotation(z) {
    this.mesh.rotation.z = z;
  }

  updateRotationDelta(rotation, time) {
    // normalize before applying

    let r = this.mesh.rotation.z % PI2;
    let newR = rotation % PI2;
    let rDirection;
    let rDist;

    r > Math.PI && (r -= PI2);
    r < -Math.PI && (r += PI2);

    newR > Math.PI && (newR -= PI2);
    newR < -Math.PI && (newR += PI2);

    if (newR >= r) {
      if (newR - r >= Math.PI) {
        rDirection = -1;
        rDist = r + PI2 - newR;
      } else {
        rDirection = 1;
        rDist = newR - r;
      }
    } else {
      if (r - newR >= Math.PI) {
        rDirection = 1;
        rDist = newR + PI2 - r;
      } else {
        rDirection = -1;
        rDist = r - newR;
      }
    }

    this.deltaZ = rDirection * rDist / (time * FRAME_RATE / 1000);
  }

  interpolate() {
    this.mesh.position.x += this.deltaX;
    this.mesh.position.y += this.deltaY;
    this.mesh.rotation.z += this.deltaZ;
  }

  destroy() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

class GameField {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.players = {};
    this.trackedId = null;
    this.trackedPosition = null;
    this.trackedRotation = null;

    // evironment creation

    scene.add(new GameFieldObject(0, 0, 0, 0xce502d).mesh);

    this.update();
  }

  update() {
    for (let id in this.players) {
      if (id === this.trackedId) {
        continue;
      }

      this.players[id].interpolate();
    }

    if (this.trackedObject) {
      this.camera.position.x = this.trackedObject.mesh.position.x;
      this.camera.position.y = this.trackedObject.mesh.position.y;
    }

    // draw on client freely with intention to correct after new game state has arrived

    let direction;

    if (inputManager.turnedOn) {
      inputManager.update();
      direction = inputManager.getInput();

      // calculate next step position by applying server-side logic

      let endPosition;
      let endRotation;
      let inputAngle = Math.atan2(direction.y, direction.x);
      let r = this.trackedRotation % PI2;
      let rDir;
      let rSpeed;

      if (r > Math.PI) {
        r -= PI2;
      }
      if (r <= -Math.PI) {
        r += PI2;
      }

      if (inputAngle >= r) {
        if (inputAngle - r >= Math.PI) {
          rDir = -1;
          rSpeed = r + PI2 - inputAngle;
        } else {
          rDir = 1;
          rSpeed = inputAngle - r;
        }
      } else {
        if (r - inputAngle >= Math.PI) {
          rDir = 1;
          rSpeed = inputAngle + PI2 - r;
        } else {
          rDir = -1;
          rSpeed = r - inputAngle;
        }
      }

      rSpeed /= 2;
      if (rSpeed > MAX_ROTATION_SPEED) {
        rSpeed = MAX_ROTATION_SPEED;
      }

      if (rSpeed <= MIN_ROTATION_SPEED) {
        rSpeed = MIN_ROTATION_SPEED;
      }

      rSpeed = rDir * rSpeed;
      endRotation = (r + rSpeed) % PI2;

      if (rSpeed < 0) {
        rSpeed += PI2;
      }
      endRotation = Math.floor(endRotation * 1000) / 1000;

      let deltaX = Math.floor(PLAYER_SPEED * Math.cos(r) * 10000) / 10000;
      let deltaY = Math.floor(PLAYER_SPEED * Math.sin(r) * 10000) / 10000;

      endPosition = {
        x: this.trackedPosition.x + deltaX,
        y: this.trackedPosition.y + deltaY
      };

      // apply calculated position and save the result

      this.trackedObject.mesh.position.x = endPosition.x;
      this.trackedObject.mesh.position.y = endPosition.y;
      this.trackedObject.mesh.rotation.z = endRotation;

      this.trackedPosition = endPosition;
      this.trackedRotation = endRotation;
    }

    requestAnimationFrame(this.update.bind(this));
    this.renderer.render(this.scene, this.camera);
  }

  start(id, posX, posY, rotation) {
    this.trackedId = id + '';
    this.trackedObject = new GameFieldObject(posX, posY, rotation);
    this.scene.add(this.trackedObject.mesh);

    this.camera.position.x = posX;
    this.camera.position.y = posY;

    this.trackedPosition = { x: posX, y: posY };
    this.trackedRotation = rotation;
  }

  end() {
    if (!this.players[this.trackedId]) {
      this.players[this.trackedId] = this.trackedObject;
    }
    this.trackedId = null;
    this.trackedObject = null;
    this.trackedPosition = null;
    this.trackedRotation = null;

    this.camera.position.x = 0;
    this.camera.position.y = 0;
  }

  updateToState(gameState, dataSendInterval) {
    for (let id in gameState) {
      if (id === this.trackedId
          || id === 'clientTick'
          || id === 'serverTick') {
        continue;
      }

      let gameStateId = gameState[id];

      if (!this.players[id]) {
        this.players[id] = new GameFieldObject(
          gameStateId.position.x,
          gameStateId.position.y,
          gameStateId.rotation
        );
        this.scene.add(this.players[id].mesh);

      } else {
        this.players[id].updatePositionDelta(
          gameStateId.position.x,
          gameStateId.position.y,
          dataSendInterval
        );
        this.players[id].updateRotationDelta(gameStateId.rotation, dataSendInterval);
      }
    }

    for (let id in this.players) {
      if (id === this.trackedId){

        // actually it cannot be cause any state with trackedId will come after game.playField.start()

        this.scene.remove(this.players[id].mesh);
        delete this.players[id];
        continue;
      }

      if (!gameState[id]) {
        this.scene.remove(this.players[id].mesh);
        this.players[id].destroy();
        delete this.players[id];
      }
    }

    if (gameState[this.trackedId]) {
      this.updateTrackedObject(gameState[this.trackedId], gameState['clientTick']);
    }
  }

  updateTrackedObject(state, clientTick) {
    let checkState = game.clientStates[clientTick];
    let checkPosition = checkState.position;
    let checkRotation = checkState.rotation;

    let deltaX = state.position.x - checkPosition.x;
    let deltaY = state.position.y - checkPosition.y;

    // normalize then calculate rotation

    let r = checkRotation % PI2;
    let newR = state.rotation % PI2;
    let rDirection;
    let rDist;

    r > Math.PI && (r -= PI2);
    r < -Math.PI && (r += PI2);

    newR > Math.PI && (newR -= PI2);
    newR < -Math.PI && (newR += PI2);

    if (newR >= r) {
      if (newR - r >= Math.PI) {
        rDirection = -1;
        rDist = r + PI2 - newR;
      } else {
        rDirection = 1;
        rDist = newR - r;
      }
    } else {
      if (r - newR >= Math.PI) {
        rDirection = 1;
        rDist = newR + PI2 - r;
      } else {
        rDirection = -1;
        rDist = r - newR;
      }
    }

    let deltaZ = rDirection * rDist;

    if (Math.abs(deltaX) > 0.05) {
      this.trackedObject.mesh.position.x += deltaX;
      this.trackedPosition.x += deltaX;
    }

    if (Math.abs(deltaY) > 0.05) {
      this.trackedObject.mesh.position.y += deltaY;
      this.trackedPosition.y += deltaY;
    }

    if (Math.abs(deltaZ) > 0.02) {
      this.trackedObject.mesh.rotation.z += deltaZ;
      this.trackedRotation += deltaZ;
    }
  }
}

const playField = new GameField(scene, camera, renderer);