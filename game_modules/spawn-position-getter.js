const gameConfig = require('./config');

// spawn distance depends on attack range of surrounding players

// TODO: create meaningful algorithm

function getSpawnPosition() {
  return {
    position: {
      x: {
        int: Math.random() > .5 ? 2 : -2,
        frac: 0
      },
      y: {
        int: Math.random() > .5 ? 2 : -2,
        frac: 0
      }
    },
    rotation: 500       // rad multiplied by 1000
  }
}

module.exports = getSpawnPosition;