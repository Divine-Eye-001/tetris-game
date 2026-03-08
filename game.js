const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');
const TEST_VAR = "Hello Github Desktop";

// 适配屏幕
const screenWidth = wx.getSystemInfoSync().windowWidth;
const screenHeight = wx.getSystemInfoSync().windowHeight;
canvas.width = screenWidth;
canvas.height = screenHeight;

// 游戏配置
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = Math.floor(screenWidth / COLS);
const COLORS = [null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF'];

// 方块形状定义
const SHAPES = [
  [],
  [[0, 1, 0], [1, 1, 1], [0, 0, 0]], // T
  [[2, 0, 0], [2, 2, 2], [0, 0, 0]], // L
  [[0, 0, 3], [3, 3, 3], [0, 0, 0]], // J
  [[4, 4], [4, 4]],                   // O
  [[0, 5, 0], [0, 5, 0], [0, 5, 5]], // S
  [[0, 6, 0], [0, 6, 0], [6, 6, 0]], // Z
  [[7, 7, 7, 7]]                      // I
];

let board = [];
let score = 0;
let gameOver = false;
let currentPiece = null;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;

// 初始化棋盘
function initBoard() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

// 创建新方块
function createPiece() {
  const typeId = Math.floor(Math.random() * 7) + 1;
  return {
    matrix: SHAPES[typeId],
    pos: { x: Math.floor(COLS / 2) - 1, y: 0 },
    type: typeId
  };
}

// 碰撞检测
function collide(board, piece) {
  const m = piece.matrix;
  for (let y = 0; y < m.length; ++y) {
    for (let x = 0; x < m[y].length; ++x) {
      if (m[y][x] !== 0 &&
         (board[y + piece.pos.y] && board[y + piece.pos.y][x + piece.pos.x]) !== 0) {
        return true;
      }
    }
  }
  return false;
}

// 合并方块到棋盘
function merge(board, piece) {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        board[y + piece.pos.y][x + piece.pos.x] = value;
      }
    });
  });
}

// 消除行
function arenaSweep() {
  let rowCount = 0;
  outer: for (let y = board.length - 1; y > 0; --y) {
    for (let x = 0; x < board[y].length; ++x) {
      if (board[y][x] === 0) continue outer;
    }
    const row = board.splice(y, 1)[0].fill(0);
    board.unshift(row);
    ++y;
    rowCount++;
  }
  if (rowCount > 0) score += rowCount * 10;
}

// 绘制函数
function draw() {
  // 清空背景
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 绘制棋盘
  board.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        ctx.fillStyle = COLORS[value];
        ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
      }
    });
  });

  // 绘制当前方块
  if (currentPiece) {
    currentPiece.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          ctx.fillStyle = COLORS[currentPiece.type];
          ctx.fillRect((x + currentPiece.pos.x) * BLOCK_SIZE, 
                       (y + currentPiece.pos.y) * BLOCK_SIZE, 
                       BLOCK_SIZE - 1, BLOCK_SIZE - 1);
        }
      });
    });
  }

  // 绘制分数
  ctx.fillStyle = '#FFF';
  ctx.font = '20px Arial';
  ctx.fillText(`Score: ${score}`, 10, 30);

  // 绘制游戏结束
  if (gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FFF';
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);
    ctx.font = '20px Arial';
    ctx.fillText('Tap to Restart', canvas.width / 2, canvas.height / 2 + 40);
  }
  
  // 绘制虚拟按钮提示
  if (!gameOver) {
      ctx.fillStyle = '#FFF';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('左半屏：左移 | 右半屏：右移/旋转', canvas.width / 2, screenHeight - 20);
  }
}

// 方块下落
function playerDrop() {
  currentPiece.pos.y++;
  if (collide(board, currentPiece)) {
    currentPiece.pos.y--;
    merge(board, currentPiece);
    currentPiece = createPiece();
    arenaSweep();
    if (collide(board, currentPiece)) {
      gameOver = true;
    }
  }
  dropCounter = 0;
}

// 方块移动
function playerMove(dir) {
  currentPiece.pos.x += dir;
  if (collide(board, currentPiece)) {
    currentPiece.pos.x -= dir;
  }
}

// 方块旋转
function playerRotate() {
  const pos = currentPiece.pos.x;
  let offset = 1;
  const matrix = currentPiece.matrix;
  // 转置矩阵实现旋转
  for (let y = 0; y < matrix.length; ++y) {
    for (let x = 0; x < y; ++x) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
    matrix[y].reverse();
  }
  // 墙踢检测
  while (collide(board, currentPiece)) {
    currentPiece.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > matrix[0].length) {
      // 旋转失败，还原（简化处理）
      return; 
    }
  }
}

// 游戏主循环
function update(time = 0) {
  const deltaTime = time - lastTime;
  lastTime = time;
  dropCounter += deltaTime;
  if (dropCounter > dropInterval) {
    if (!gameOver) playerDrop();
  }
  draw();
  requestAnimationFrame(update);
}

// 触摸控制
wx.onTouchStart(res => {
  if (gameOver) {
    // 重置游戏
    initBoard();
    score = 0;
    gameOver = false;
    currentPiece = createPiece();
    return;
  }
  const touch = res.touches[0];
  if (touch.clientX < screenWidth / 2) {
    playerMove(-1); // 左移
  } else {
    // 简单逻辑：右侧点击先尝试旋转，失败则右移（可优化为虚拟按键）
    // 这里简化为：右侧点击旋转
    playerRotate(); 
  }
});

// 启动游戏
initBoard();
currentPiece = createPiece();
update();
