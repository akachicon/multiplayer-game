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
    let response = new Uint16Array(evt.data);
    let dot;

    // console.log(response[0], response[1]);

    dot = document.createElement('div');
    dot.className = "dot";
    dot.style.left = response[0] + "px";
    dot.style.top = response[1] + "px";
    document.body.appendChild(dot);
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
  startEchoMouseMove();
}

function waitForDataChannels() {

}

function handleError(err) {
  throw err;
}

function startEchoMouseMove() {
  document.body.style.height = innerHeight;
  document.body.style.width = innerWidth;

  document.onmousemove = handleMouseMove;

  function handleMouseMove(event) {
    let dot, eventDoc, doc, body, pageX, pageY;

    // If pageX/Y aren't available and clientX/Y
    // are, calculate pageX/Y - logic taken from jQuery
    // Calculate pageX/Y if missing and clientX/Y available
    if (event.pageX === null && event.clientX !== null) {
      eventDoc = (event.target && event.target.ownerDocument) || document;
      doc = eventDoc.documentElement;
      body = eventDoc.body;

      event.pageX = event.clientX +
        (doc && doc.scrollLeft || body && body.scrollLeft || 0) -
        (doc && doc.clientLeft || body && body.clientLeft || 0);
      event.pageY = event.clientY +
        (doc && doc.scrollTop  || body && body.scrollTop  || 0) -
        (doc && doc.clientTop  || body && body.clientTop  || 0 );
    }

    let data = new Uint16Array([event.pageX, event.pageY]);

    dc.send(data.buffer);
  }
}