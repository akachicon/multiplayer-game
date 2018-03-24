'use strict';

// Important things to consider***
//
// This game supposed to has some rotatory movement so there is some
// restrictions due to server updates. The problem is that the interpolation
// implementation between adjacent server states cannot get into account
// rotations which in sum result in a value lesser than one of these rotations values.
//
// E.g. if you rotate object 20 degrees clockwise and, after that, 40 degrees
// counter-clockwise at the same server tick, then the result will be 20 degrees
// counter-clockwise and users could just see 20 degrees rotation when run interpolation.
//
// This artifact can cause one player to get killed by another without rendering actual hitbox
// while killing, which is not appropriate.
//
// Considering mentioned above, the suggestion is to restrict the rotation speed of players to
// sensible amount of degrees per update, which in this implementation is about 12
// (max of PI / 45 at every frame with 50ms server time step).

const DATA_SEND_INTERVAL = 50;
const SERVER_TIMESTEP = 50;
const MAX_CLIENT_STATES = 1000;

const game = {
  id: null,
  status: null,
  joinInterval: null,
  leaveInterval: null,
  serverLastState: null,
  serverPreviousState: null,
  clientLastState: null,
  clientStates: new Array(MAX_CLIENT_STATES),
  playField: playField,
  inputManager: inputManager,
  event: null,
  position: { x: null, y: null },
  rotation: null
};

game.emit = function (event) {        // use this only after webrtc data-channel has been opened, these events supposed to be reliable
  switch (event) {
    case 'join':
      if (game.status === 'participant') {
        return;
      }
      game.joinInterval = setInterval(function () {
        if (game.leaveInterval) {         // if player allowed to join while trying to leave (but actually not leaved)
          return;                         // there might be a case when old game data sends to client while he try starting new game
        }                                 // it's worth to make game restart logic event based (sending data in event mask)

        dc.send(new Uint8Array([1]));
      }, DATA_SEND_INTERVAL);
      break;

    case 'leave':
      if (game.status === 'spectator') {
        return;
      }

      stopSendData();
      game.playField.end();

      game.leaveInterval = setInterval(function () {
        if (game.joinInterval) {
          return;
        }

        dc.send(new Uint8Array([0]));
      }, DATA_SEND_INTERVAL);
      break;
  }
};

game.ondata = function (data) {
  if (data.byteLength === 14
      || data.byteLength === 2) {        // status-request response

    let [response, id, pxint, pxfrac, pyint, pyfrac, rotation] = new Int16Array(data);
    game.position = { x: pxint + pxfrac / 10000, y: pyint + pyfrac / 10000};

    switch (response) {
      case 1:
        if (game.status === 'participant') {
          return;
        }

        game.status = 'participant';
        game.id = id;
        clearInterval(game.joinInterval);
        game.joinInterval = null;

        game.playField.start(id, pxint + pxfrac / 10000, pyint + pyfrac / 10000, rotation);
        startSendData(pxint + pxfrac / 10000, pyint + pyfrac / 10000, rotation);
        break;

      case 0:
        game.status = 'spectator';
        clearInterval(game.leaveInterval);
        game.leaveInterval = null;
        break;
    }
    return;
  }

  // handle incoming server state

  let serverState = parseData(new Int16Array(data));

  game.playField.updateToState(serverState, SERVER_TIMESTEP);

  if (!game.serverLastState) {
    game.serverLastState = serverState;
    game.serverPreviousState = serverState;
  } else {
    game.serverPreviousState = game.serverLastState;
    game.serverLastState = serverState;
  }
};

function startSendData(px, py, rotation) {
  let serverTick;
  let clientTick = 0;

  serverTick = game.serverLastState.serverTick;         // TODO: this means allow join only after first server game state message

  game.clientLastState = {
    serverTick: serverTick,
    clientTick: clientTick,
    position: { x: px, y: py },
    rotation: rotation,
    event: 0
  };

  game.inputManager.turnOn();

  game.inputInterval = setInterval(function () {
    let cls = game.clientLastState;
    let stateToSave = {};
    let stateToSend;

    if (cls.clientTick >= MAX_CLIENT_STATES - 1) {
      stateToSave.clientTick = 0;
    } else {
      stateToSave.clientTick = cls.clientTick + 1;
    }

    stateToSave.serverTick = game.serverLastState.serverTick;

    stateToSave.event = getEvent();
    let posrot = getPositionRotation();

    stateToSave.position = posrot.position;
    stateToSave.rotation = posrot.rotation;

    game.clientStates[stateToSave.clientTick] = stateToSave;
    game.clientLastState = stateToSave;

    let gameInput = game.inputManager.flushStackAsInt16Array();
    let stateData = new Int16Array([
      stateToSave.serverTick,
      stateToSave.clientTick,
      stateToSave.event
    ]);

    // [serverTick, clientTick, event, gameInputLength, x0, y0, x1, y1, ..., xn, yn]

    stateToSend = new Int16Array(stateData.length + gameInput.length);
    stateToSend.set(stateData);
    stateToSend.set(gameInput, stateData.length);

    dc.send(stateToSend.buffer);
  }, DATA_SEND_INTERVAL);
}

function getPositionRotation() {        // TODO: implement
  return {
    position: 'test position - have no need to be implemented right now',
    rotation: 'the same'
  };
}

function getEvent() {       // TODO: implement
  return 0;
}

function stopSendData() {
  game.inputManager.turnOff();
  clearInterval(game.inputInterval);
  game.inputInterval = null;
}

function parseData(arr) {
  // checks if this state is new, if not returns game.serverLastState

  let serverTick = arr[0];

  if (game.serverLastState
      && (serverTick - game.serverLastState.serverTick > 1000
        || (game.serverLastState.serverTick >= serverTick
          && game.serverLastState.serverTick - serverTick < 1000))) {
    return game.serverLastState;
  }

  let state = {
    serverTick: serverTick,
    clientTick: arr[1]
  };

  // state: { id0: { position, ... }, id1: { position, ... }, ... }

  for (let i = 2; i < arr.length; i += 7) {
    state[arr[i]] = {
      position: { x: arr[i + 1] + arr[i + 2] / 10000, y: arr[i + 3] + arr[i + 4] / 10000 },
      rotation: arr[i + 5] / 1000,
      event: arr[i + 6]
    }
  }

  return state;
}

/*

setInterval(() => {
  console.log(game);
}, 2000);
*/
