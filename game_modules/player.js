const playerList = {};
const state = require('./state');
const idPool = require('./id-pool');
const getSpawnPosition = require('./spawn-position-getter');
const mdp = require('./movement-data-processor');

module.exports = {
  addToPending: addToPending,
  removeFromGame: removeFromGame,
  updateGameData: updateGameData,
  list: playerList
};

function addToPending(id) {
  // send id to client so that he could know where his position is among others
  // id supposed to be 0..255 while peer's id is rather big random string
  // initial client-tick is 0 by client-server convention

  let pgd = playerList[id].gameData;
  let position;
  let rotation;
  let event;

  pgd.gameId = idPool.getFreeId();
  idPool.addToUsed(pgd.gameId);

  let spawn = getSpawnPosition();
  position = spawn.position;
  rotation = spawn.rotation;

  // event is a bit mask of two bytes

  event = 0;

  pgd.lastState = {
    serverTick: state.nextServerTick,
    clientTick: -1,
    position: position,
    rotation: rotation,
    event: event
  };

  return {
    id: pgd.gameId,
    position: position,
    rotation: rotation
  }
}

function updateGameData(id, data) {
  let pgd = playerList[id].gameData;
  let clientState = new Int16Array(data);
  let lastClientTick = clientState[1];

  if (!pgd.inGame) {
    pgd.inGame = true;        // means it will be shown at next server transmission
  }

  if (lastClientTick - pgd.lastState.clientTick > 500
      || (pgd.lastState.clientTick >= lastClientTick
        && pgd.lastState.clientTick - lastClientTick < 500)) {
    return;
  }

  // clientState signature: [serverTick, clientTick, event, inputX0, inputY0, inputX1, inputY1, ...]

  let lastPosition = pgd.lastState.position;
  let lastRotation = pgd.lastState.rotation;

  pgd.lastState = {
    serverTick: state.nextServerTick,
    clientTick: clientState[1],
    event: clientState[2]       // TODO: implement event logic
  };

  let newGameData = mdp(lastPosition, lastRotation, new Int16Array(data, 6));

  pgd.lastState.position = newGameData.position;
  pgd.lastState.rotation = newGameData.rotation;
}

function  removeFromGame(id) {
  let pgd = playerList[id].gameData;

  pgd.gameId = null;
  pgd.inGame = false;           // it's possible to add onbeforeremove event
  idPool.remove(pgd.gameId);
}