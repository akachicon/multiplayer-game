'use strict';

let ioConnectionString = window.location.origin;
let socket = null;
let socketReady = false;
let label = 'game';
let dc = null;
let dcReady = false;
let dataChannelSettings = {
  'game': {
    ordered: false,
    maxRetransmits: 0
  }
};
let pendingCandidates = [];
let pc = new RTCPeerConnection({
  iceServers: [{ url: 'stun:stun.l.google.com:19302' }]
});

pc.onicecandidate = function(event) {
  let candidate = event.candidate;

  if (!candidate) {
    return;
  }

  if (socketReady) {
    socket.emit('message', {
      type: 'ice',
      sdp: {
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex
      }
    });
  } else {
    pendingCandidates.push(candidate);
  }
};

createDataChannels();

function createDataChannels() {
  let channel = pc.createDataChannel(label, dataChannelSettings[label]);

  dc = channel;
  channel.binaryType = 'arraybuffer';

  channel.onopen = function() {
    dcReady = true;
    onComplete();
  };

  channel.onmessage = function(evt) {
    game.ondata(evt.data);
  };

  channel.onclose = function() {

  };

  channel.onerror = handleError;

  createOffer();
}

function createOffer() {
  pc.createOffer(
    setLocalDesc,
    handleError
  );
}

function setLocalDesc(desc) {
  pc.setLocalDescription(
    new RTCSessionDescription(desc),
    sendOffer.bind(null, desc),
    handleError
  );
}

function sendOffer(offer) {
  socket = io.connect(ioConnectionString);

  socket.on('connect', function () {
    socketReady = true;

    pendingCandidates.forEach(function (candidate) {
      socket.emit('message', {
        type: 'ice',
        sdp: {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex
        }
      });
    });
    socket.emit('message', {
      type: offer.type,
      sdp: offer.sdp
    });
  });

  socket.on('message', function(data) {
    if ('answer' === data.type) {
      setRemoteDesc(data);
    } else if ('ice' === data.type) {
      if (data.sdp.candidate) {
        let candidate = new RTCIceCandidate(data.sdp.candidate);
        pc.addIceCandidate(candidate);
      }
    }
  });
}

function setRemoteDesc(desc) {
  pc.setRemoteDescription(
    new RTCSessionDescription(desc),
    waitForDataChannels,
    handleError
  );
}

function onComplete() {
  pendingCandidates = [];
}

function waitForDataChannels() {

}

function handleError(err) {
  throw err;
}