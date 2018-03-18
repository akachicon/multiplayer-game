const cluster = require('cluster');
const join = require('path').join;
const wsServer = require('./ws-server');

if (cluster.isMaster) {
  cluster.fork({ NODE_CHILD_PROCESS: 'wrtc-client' });
  wsServer(cluster);
} else {
  let module = process.env.NODE_CHILD_PROCESS;
  require(join(__dirname, module));
}
