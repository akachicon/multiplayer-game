const player = require('./player');

module.exports = dataHandler;

function dataHandler(data, sender) {
  if (data.byteLength === 1) {        // status-request message (join = 1, leave = 0)
    let [request] = new Uint8Array(data);
    let sgd = sender.gameData;

    switch (request) {
      case 1:
        if (sgd.status === 'participant') {       // cause it can arrive more than once
          let ls = sgd.lastState;
          sender.dc.send(new Int16Array([
            1, sgd.gameId, ls.position.x.int, ls.position.x.frac, ls.position.y.int, ls.position.y.frac, ls.rotation
          ]).buffer);
          return;
        }
        sgd.status = 'participant';
        let init = player.addToPending(sender.id);
        sender.dc.send(new Int16Array([
          1, init.id, init.position.x.int, init.position.x.frac, init.position.y.int, init.position.y.frac, init.rotation
        ]).buffer);
        break;

      case 0:
        sender.dc.send(data);
        if (sgd.status === 'spectator') {       // cause it can arrive more than once
          return;
        }
        sgd.status = 'spectator';
        player.removeFromGame(sender.id);
        break;
    }
    return;
  }

  if (sender.gameData.status !== 'participant') {
    return;
  }

  // handle client input data

  player.updateGameData(sender.id, data);
}