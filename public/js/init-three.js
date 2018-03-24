const scene = new THREE.Scene();
scene.background = new THREE.Color( 0xffffff );

const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 1, 6);
camera.position.z = 6;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

class GameFieldObject {
  constructor(posX, posY, rotation, color) {
    let geometry = new THREE.BoxGeometry(1, 1, 1);
    let material = new THREE.MeshBasicMaterial({ color: color ? color : 0x433f81 });
    let mesh = new THREE.Mesh(geometry, material);

    mesh.position.x = posX;
    mesh.position.y = posY;
    mesh.rotation.z = rotation;

    this.mesh = mesh;
  }

  updatePosition(x, y, time) {
    this.mesh.position.x = x;
    this.mesh.position.y = y;
  }

  updateRotation(rotation, time) {
    this.mesh.rotation.z = rotation;
  }

  destroy() {

  }
}

class GameField {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.players = {};
    this.trackedId = null;

    // evironment creation

    scene.add(new GameFieldObject(0, 0, 0, 0xce502d).mesh);

    this.update();
  }

  update() {
    let direction;

    if (inputManager.turnedOn) {
      inputManager.update();
      direction = inputManager.getInput();
    }

    // draw on client freely with intention to correct after new game state has arrived
    // ...

    requestAnimationFrame(this.update.bind(this));
    this.renderer.render(this.scene, this.camera);
  }

  start(id, posX, posY, rotation) {
    this.trackedId = id + '';
    this.trackedObject = new GameFieldObject(posX, posY, rotation);
    this.scene.add(this.trackedObject.mesh);

    this.camera.position.x = posX;
    this.camera.position.y = posY;
  }

  end() {
    if (!this.players[this.trackedId]) {
      this.players[this.trackedId] = this.trackedObject;
    }
    this.trackedId = null;
    this.trackedObject = null;

    this.camera.position.x = 0;
    this.camera.position.y = 0;
  }

  updateToState(gameState, dataSendInterval) {      // TODO: call with time
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
        this.players[id].updatePosition(
          gameStateId.position.x,
          gameStateId.position.y
        );
        this.players[id].updateRotation(gameStateId.rotation);
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
      this.updateTrackedObject(gameState[this.trackedId]);
    }
  }

  updateTrackedObject(state) {
    this.trackedObject.updatePosition(state.position.x, state.position.y);
    this.trackedObject.updateRotation(state.rotation);

    this.camera.position.x = state.position.x;
    this.camera.position.y = state.position.y;
  }
}

const playField = new GameField(scene, camera, renderer);