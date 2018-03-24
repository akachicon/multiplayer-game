let poolSize = require('./config').GAME_ID_POOL_SIZE;
let pool = new Array(poolSize);       // true if id is used, false otherwise

module.exports = {
  getPool: getPool,
  isUsed: isUsed,
  addToUsed: addToUsed,
  remove: remove,
  getFreeId: getFreeId
};

function getPool() {
  return pool;
}

function isUsed(id) {
  return pool[id];
}

function addToUsed(id) {
  pool[id] = true;
}

function remove(id) {
  pool[id] = false;
}

function getFreeId() {
  for (let i = 0; i < pool.length; i++) {
    if (!pool[i]) {
      return i;
    }
  }
  return null;
}