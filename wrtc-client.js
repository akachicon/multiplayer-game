const wrtc = require('wrtc');
const game = require('./game_modules/game');

const player = game.player;
const peers = game.player.list;

initGarbageCollector();

process.on('message', function (data) {
  if (data.querier && data.querier === 'garbagecollector') {
    collectGarbage(data);
    return;
  }

  let socketId = data.socketId;
  delete data.socketId;

  if (!peers[socketId]) {
    peers[socketId] = {
      id: socketId,
      pc: null,
      offer: null,
      answer: null,
      remoteReceived: false,
      pendingCandidates: [],
      dcReady: false,
      dc: null,
      gameData: {
        status: null,
        gameId: null,
        lastState: null,
        inGame: false
      }
    };
  }

  let peer = peers[socketId];
  let pc = peer.pc;

  if ('offer' === data.type) {
    pc = peer.pc = new wrtc.RTCPeerConnection({
      iceServers: [{ url: 'stun:stun.l.google.com:19302' }]
    }, {
      optional: [{ DtlsSrtpKeyAgreement: false }]
    });

    pc.onicecandidate = function(candidate) {
      socketEmitMsg(socketId, {
        type: 'ice',
        sdp: {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex
        }
      });
    };

    peer.offer = new wrtc.RTCSessionDescription(data);

    handleDataChannels(peer, pc);
  } else if ('ice' === data.type) {
    if (peer.remoteReceived) {
      if (data.sdp.candidate) {
        pc.addIceCandidate(new wrtc.RTCIceCandidate(data.sdp));
      }
    } else {
      peer.pendingCandidates.push(data);
    }
  }
});

function handleDataChannels(peer, pc) {
  pc.ondatachannel = function(evt) {
    let channel = evt.channel;

    peer.dc = channel;
    channel.binaryType = 'arraybuffer';

    channel.onopen = function() {
      peer.dcReady = true;
      peer.pendingCandidates = [];

      peer.gameData.status = 'spectator';
    };

    channel.onmessage = function(evt) {
      game.ondata(evt.data, peer);
    };

    channel.onclose = function() {
      try {
        player.removeFromGame(peer.id);
      } catch (err) {}

      try {
        peers[peer.id].pc.close();
        delete peers[peer.id];
      } catch (err) {}
    };

    channel.onerror = handleError;
  };

  setRemoteDesc(peer, pc);
}

function setRemoteDesc(peer, pc) {
  pc.setRemoteDescription(
    peer.offer,
    createAnswer.bind(null, peer, pc),
    handleError
  );
}

function createAnswer(peer, pc) {
  peer.remoteReceived = true;

  peer.pendingCandidates.forEach(function(candidate) {
    if (candidate.sdp) {
      pc.addIceCandidate(new wrtc.RTCIceCandidate(candidate.sdp));
    }
  });

  pc.createAnswer(
    setLocalDesc.bind(null, peer, pc),
    handleError
  );
}

function setLocalDesc(peer, pc, desc) {
  peer.answer = desc;
  pc.setLocalDescription(
    desc,
    sendAnswer.bind(null, peer),
    handleError
  );
}

function sendAnswer(peer) {
  socketEmitMsg(peer.id, peer.answer);
}

function handleError(error) {
  console.log('RTCPeerConnection ERROR:', error);
}

function socketEmitMsg(id, data) {
  data.socketId = id;
  process.send(data);
}

function initGarbageCollector() {
  setInterval(function () {
    if (!Object.keys(peers).length) {
      return;
    }
    process.send({
      querier: 'garbagecollector',
      ids: Object.keys(peers)
    });
  }, 3000);
}

function collectGarbage(data) {
  data.ids.forEach(function (id) {
    if (!id || !peers[id]) {
      return;
    }
    let peer = peers[id];

    try {
      player.removeFromGame(peer.id);
    } catch (err) {}

    try {
      peer.pc.close();
    } catch (err) {}

    try {
      peer.dc.removeAllListeners();
    } catch (err) {}

    try {
      peer.pc.removeAllListeners();
    } catch (err) {}

    delete peers[id];
  });
}

setInterval(() => {
  for (let id in peers) {
    // console.log(id, peers[id].gameData);

    try {
      console.log(peers[id].gameData.position.x);
    } catch (e) {}
  }
}, 2000);