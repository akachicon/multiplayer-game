// This code should be used on client because any movement calculations must be equal

const config = require('./config');
const FMath = require('fmath');

const PLAYER_SPEED = config.PLAYER_SPEED;
const MIN_ROTATION_SPEED = config.MIN_ROTATION_SPEED;
const MAX_ROTATION_SPEED = config.MAX_ROTATION_SPEED;

const fMath = new FMath();

module.exports = function (startPosition, startRotation, input) {
  let currentPosition = {
    x: startPosition.x.int + startPosition.x.frac / 10000,
    y: startPosition.y.int + startPosition.y.frac / 10000,
  };
  let currentRotation = startRotation / 1000;
  let endPosition = {};
  let endRotation;

  for (let i = 0; i < input.length; i += 2) {
    let inputAngle = Math.atan2(input[i + 1], input[i]);
    let rotationAngle = currentRotation % (2 * Math.PI);
    let rotationDirection;
    let rotationSpeed;

    if (rotationAngle > Math.PI) {
      rotationAngle -= 2 * Math.PI;
    }
    if (rotationAngle <= - Math.PI) {
      rotationAngle += 2 * Math.PI;
    }

    if (inputAngle >= rotationAngle) {
      if (inputAngle - rotationAngle >= Math.PI) {
        rotationDirection = -1;
        rotationSpeed = rotationAngle + 2 * Math.PI - inputAngle;
      } else {
        rotationDirection = 1;
        rotationSpeed = inputAngle - rotationAngle;
      }
    } else {
      if (rotationAngle - inputAngle >= Math.PI) {
        rotationDirection = 1;
        rotationSpeed = inputAngle + 2 * Math.PI - rotationAngle;
      } else {
        rotationDirection = -1;
        rotationSpeed = rotationAngle - inputAngle;
      }
    }

    rotationSpeed /= 2;
    if (rotationSpeed > MAX_ROTATION_SPEED) {
      rotationSpeed = MAX_ROTATION_SPEED;
    }

    if (rotationSpeed <= MIN_ROTATION_SPEED)  {
      rotationSpeed = MIN_ROTATION_SPEED;
    }

    rotationSpeed = rotationDirection * rotationSpeed;
    endRotation = (currentRotation + rotationSpeed) % (2 * Math.PI);

    endRotation = Math.floor(endRotation * 1000) / 1000;

    let deltaX = Math.floor(PLAYER_SPEED * fMath.cos(currentRotation) * 10000) / 10000;
    let deltaY = Math.floor(PLAYER_SPEED * fMath.sin(currentRotation) * 10000) / 10000;

    endPosition = {
      x: currentPosition.x + deltaX,
      y: currentPosition.y + deltaY
    };

    currentPosition = {
      x: endPosition.x,
      y: endPosition.y
    };
    currentRotation = endRotation;
  }

  let result = {
    position: {
      x: {
        int: endPosition.x < 0 ? Math.ceil(endPosition.x) : Math.floor(endPosition.x),
        frac: Math.floor(endPosition.x % 1 * 10000)
      },
      y: {
        int: endPosition.y < 0 ? Math.ceil(endPosition.y) : Math.floor(endPosition.y),
        frac: Math.floor(endPosition.y % 1 * 10000)
      }
    },
    rotation: Math.floor(endRotation * 1000)
  };

  return result;
};
