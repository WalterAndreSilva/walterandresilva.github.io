const ROWS = 4;
const COLS = 4;

let board = [];
let currentPlayer = 1;
let selectedCell = null;
let validMoves = [];
let gameActive = true;

// 1 = Jugador 1 (Rojo), 2 = Jugador 2 (Azul)
// Disposición inicial de Dao en diagonal
const initialBoard = [
    [1, 0, 0, 2],
[0, 1, 2, 0],
[0, 2, 1, 0],
[2, 0, 0, 1]
];

// Elementos del DOM
const boardElement = document.getElementById('game-board');
const statusElement = document.getElementById('status');
const btnBoard = document.getElementById('btn-board');
const btnRules = document.getElementById('btn-rules');
const boardSection = document.getElementById('board-section');
const rulesSection = document.getElementById('rules-section');
const btnRestart = document.getElementById('btn-restart');
// Nuevos Elementos del DOM para el modal
const gameControlsElement = document.getElementById('game-controls');
const modalElement = document.getElementById('game-over-modal');
const modalMessageElement = document.getElementById('modal-message');
const modalBtnRestart = document.getElementById('modal-btn-restart');



// Inicializa o reinicia el estado de la partida
function initGame() {
    board = initialBoard.map(row => [...row]);
    currentPlayer = 1;
    selectedCell = null;
    validMoves = [];
    gameActive = true;

    modalElement.classList.add('hidden'); // Ocultar el cartel flotante
    gameControlsElement.classList.remove('hidden')

    updateStatus();
    renderBoard();
}

// Dibuja el tablero y las piezas
function renderBoard() {
    boardElement.innerHTML = '';
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');

            // Dibuja la pieza si la celda no está vacía
            const pieceVal = board[r][c];
            if (pieceVal !== 0) {
                const piece = document.createElement('div');
                piece.classList.add('piece');
                piece.classList.add(pieceVal === 1 ? 'player1' : 'player2');
                if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
                    piece.classList.add('selected');
                }
                cell.appendChild(piece);
            }

            cell.addEventListener('click', () => handleCellClick(r, c));
            boardElement.appendChild(cell);
        }
    }
}

// Maneja la interacción del usuario en cada celda
function handleCellClick(r, c) {
    if (!gameActive) return;

    // Si hace click en una pieza propia, seleccionarla
    if (board[r][c] === currentPlayer) {
        selectedCell = { r, c };
        calculateValidMoves(r, c);
        renderBoard();
        return;
    }

    // Si hace click en una celda válida, ejecutar el movimiento
    if (selectedCell && validMoves.some(m => m.r === r && m.c === c)) {
        board[r][c] = currentPlayer;
        board[selectedCell.r][selectedCell.c] = 0;

        selectedCell = null;
        validMoves = [];
        renderBoard();

        checkGameEnd();
    }
}

// Calcula hasta dónde se desliza la pieza en las 8 direcciones posibles
function calculateValidMoves(r, c) {
    validMoves = [];
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];

    directions.forEach(dir => {
        let nr = r + dir[0];
        let nc = c + dir[1];
        let lastEmpty = null;

        // Deslizamiento continuo hasta topar pared u otra pieza
        while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc] === 0) {
            lastEmpty = { r: nr, c: nc };
            nr += dir[0];
            nc += dir[1];
        }

        if (lastEmpty) {
            validMoves.push(lastEmpty);
        }
    });
}

// Analiza si el movimiento reciente terminó la partida
function checkGameEnd() {
    // 1. ¿Logró el jugador actual una condición de victoria?
    if (checkWin(currentPlayer)) {
        endGameShowModal(`¡El Jugador ${currentPlayer} ha ganado!`);
        return;
    }

    // 2. ¿Encerró accidentalmente al rival perdiendo la partida?
    if (checkTrapLoss(currentPlayer)) {
        const opponent = currentPlayer === 1 ? 2 : 1;
        endGameShowModal(`¡Jugador ${currentPlayer} atrapó al rival y PIERDE!\nGana Jugador ${opponent}.`);
        return;
    }

    // Cambiar de turno si nadie ganó aún
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    updateStatus();
}

// Nueva función que despliega el modal con el resultado
function endGameShowModal(message) {
    statusElement.innerText = message; // Actualiza el texto de atrás también
    modalMessageElement.innerText = message; // Pone el texto en el cartel
    modalElement.classList.remove('hidden'); // Muestra el modal
    gameControlsElement.classList.add('hidden');
    gameActive = false;
}

// Verifica las tres formas clásicas de ganar en Dao
function checkWin(p) {
    // 1. Ocupar las 4 esquinas
    if (board[0][0] === p && board[0][3] === p && board[3][0] === p && board[3][3] === p) return true;

    // 2. Formar un cuadrado 2x2
    for (let r = 0; r <= 2; r++) {
        for (let c = 0; c <= 2; c++) {
            if (board[r][c] === p && board[r+1][c] === p && board[r][c+1] === p && board[r+1][c+1] === p) return true;
        }
    }

    // 3. Formar una línea recta (horizontal o vertical)
    for (let i = 0; i < 4; i++) {
        let rowWin = true, colWin = true;
        for (let j = 0; j < 4; j++) {
            if (board[i][j] !== p) rowWin = false;
            if (board[j][i] !== p) colWin = false;
        }
        if (rowWin || colWin) return true;
    }

    return false;
}

// Verifica la regla donde un jugador pierde si acorrala la pieza del oponente en una esquina
function checkTrapLoss(p) {
    const opp = p === 1 ? 2 : 1;
    const corners = [
        { r: 0, c: 0, adj: [[0,1], [1,0], [1,1]] },
        { r: 0, c: 3, adj: [[0,2], [1,3], [1,2]] },
        { r: 3, c: 0, adj: [[2,0], [3,1], [2,1]] },
        { r: 3, c: 3, adj: [[3,2], [2,3], [2,2]] }
    ];

    for (let corner of corners) {
        if (board[corner.r][corner.c] === opp) {
            let trapped = true;
            for (let a of corner.adj) {
                if (board[a[0]][a[1]] !== p) {
                    trapped = false;
                    break;
                }
            }
            if (trapped) return true;
        }
    }
    return false;
}

// Actualiza el texto en la interfaz visual
function updateStatus() {
    statusElement.innerText = `Turno del Jugador ${currentPlayer}`;
    statusElement.style.color = currentPlayer === 1 ? '#ff7675' : '#74b9ff';
}

// Escuchadores de eventos para la navegación lateral
btnBoard.addEventListener('click', () => {
    btnBoard.classList.add('active');
    btnRules.classList.remove('active');
    boardSection.classList.remove('hidden');
    rulesSection.classList.add('hidden');
});

btnRules.addEventListener('click', () => {
    btnRules.classList.add('active');
    btnBoard.classList.remove('active');
    rulesSection.classList.remove('hidden');
    boardSection.classList.add('hidden');
});

btnRestart.addEventListener('click', initGame);
modalBtnRestart.addEventListener('click', initGame);

// Arrancar el juego por primera vez
initGame();
