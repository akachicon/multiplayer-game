const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

module.exports = function (cluster) {
  app.use(express.static('public'));

  app.get('/', function (req, res) {
    res.render('index.html');
  });

  http.listen(3000);

  io.on('connection', function (socket) {
    socket.on('message', function (data) {
      data.socketId = socket.id;
      cluster.workers[1].send(data);
    });
  });

  cluster.on('message', function (worker, data) {
    if (data.querier && data.querier === 'garbagecollector') {
      io.clients(function (error, clients) {
        if (error) {
          console.log('io.clients ERROR: ', error);
        }
        for (let i = 0; i < data.ids.length; i++) {
          for (let j = 0; j < clients.length; j++) {
            if (data.ids[i] === clients[j]) {
              data.ids[i] = false;
              break;
            }
          }
        }
        setTimeout(function () {
          cluster.workers[1].send(data);
        }, 1000);
      });
    } else {
      let id = data.socketId;

      delete data.socketId;
      io.in(id).emit('message', data);
    }
  });
};

