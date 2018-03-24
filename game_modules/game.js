const config = require('./config');
const state = require('./state');
const player = require('./player');
const ondata = require('./data-handler');

const players = player.list;

setInterval(function () {
  let newState = generateNewState();

  transmitState(newState.toSend);
  saveState(newState.toSave);

  if (++state.nextServerTick >= config.SERVER_MAX_TICK) {
    state.nextServerTick = 0;
  }
}, config.TIME_STEP);

module.exports = {
  ondata: ondata,
  player: player
};

function generateNewState() {
  let toSave = {};
  let toSend = [state.nextServerTick, -1];

  for (let id in players) {
    let plr = players[id];

    if (!plr.gameData || !plr.gameData.inGame) {
      continue;
    }

    let pls = plr.gameData.lastState;

    toSave[plr.gameData.gameId] = {
      position: pls.position,
      rotation: pls.rotation,
      event: pls.event
    };

    toSend.push(
      plr.gameData.gameId,
      pls.position.x.int,
      pls.position.x.frac,
      pls.position.y.int,
      pls.position.y.frac,
      pls.rotation,
      pls.event
    );
  }

  return {
    toSave: toSave,
    toSend: new Int16Array(toSend)
  }
}

function transmitState(toSend) {
  for (let id in players) {
    let plr = players[id];

    if (!plr.dcReady) {
      continue;
    }
    if (plr.gameData.inGame) {
      toSend[1] = plr.gameData.lastState.clientTick;
    }

    plr.dc.send(toSend.buffer);
  }
}

function saveState(toSave) {
  state.list[state.nextServerTick] = toSave;
}

