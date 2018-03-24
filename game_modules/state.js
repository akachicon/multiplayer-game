const config = require('./config');

const list = new Array(config.SERVER_MAX_TICK);
let nextServerTick = 0;

module.exports = {
  list: list,
  nextServerTick: nextServerTick
};