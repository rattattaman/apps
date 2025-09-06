const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const paddleWidth = 10, paddleHeight = 80;
const ballSize = 10;

let leftY = (canvas.height - paddleHeight) / 2;
let rightY = leftY;
let leftUp = false, leftDown = false, rightUp = false, rightDown = false;

let ballX = canvas.width / 2, ballY = canvas.height / 2;
let ballDX = 4, ballDY = 4;

let leftScore = 0, rightScore = 0;

document.addEventListener('keydown', (e) => {
  if (e.key === 'w' || e.key === 'W') leftUp = true;
  if (e.key === 's' || e.key === 'S') leftDown = true;
  if (e.key === 'ArrowUp') rightUp = true;
  if (e.key === 'ArrowDown') rightDown = true;
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'w' || e.key === 'W') leftUp = false;
  if (e.key === 's' || e.key === 'S') leftDown = false;
  if (e.key === 'ArrowUp') rightUp = false;
  if (e.key === 'ArrowDown') rightDown = false;
});

function update() {
  const speed = 6;
  if (leftUp) leftY = Math.max(0, leftY - speed);
  if (leftDown) leftY = Math.min(canvas.height - paddleHeight, leftY + speed);
  if (rightUp) rightY = Math.max(0, rightY - speed);
  if (rightDown) rightY = Math.min(canvas.height - paddleHeight, rightY + speed);

  ballX += ballDX;
  ballY += ballDY;

  if (ballY <= 0 || ballY + ballSize >= canvas.height) ballDY *= -1;

  if (ballX <= paddleWidth && ballY + ballSize > leftY && ballY < leftY + paddleHeight) {
    ballDX *= -1;
    ballX = paddleWidth;
  }
  if (
    ballX + ballSize >= canvas.width - paddleWidth &&
    ballY + ballSize > rightY &&
    ballY < rightY + paddleHeight
  ) {
    ballDX *= -1;
    ballX = canvas.width - paddleWidth - ballSize;
  }

  if (ballX < 0) {
    rightScore++;
    resetBall();
  } else if (ballX > canvas.width) {
    leftScore++;
    resetBall();
  }
}

function resetBall() {
  ballX = canvas.width / 2 - ballSize / 2;
  ballY = canvas.height / 2 - ballSize / 2;
  ballDX = Math.random() > 0.5 ? 4 : -4;
  ballDY = Math.random() * 4 - 2;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.fillRect(canvas.width / 2 - 1, 0, 2, canvas.height);
  ctx.fillRect(0, leftY, paddleWidth, paddleHeight);
  ctx.fillRect(canvas.width - paddleWidth, rightY, paddleWidth, paddleHeight);
  ctx.fillRect(ballX, ballY, ballSize, ballSize);
  ctx.font = '20px monospace';
  ctx.fillText(leftScore, canvas.width / 4, 20);
  ctx.fillText(rightScore, (canvas.width * 3) / 4, 20);
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

resetBall();
loop();
