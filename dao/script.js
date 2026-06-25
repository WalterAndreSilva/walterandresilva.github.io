const ROWS = 4;
const COLS = 4;

let board = [];
let currentPlayer = 1;
let selectedCell = null;
let validMoves = [];
let gameActive = true;
let isPvE = false;

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
const btnPvP = document.getElementById('btn-pvp');
const btnCPU = document.getElementById('btn-cpu');
const btnRules = document.getElementById('btn-rules');
const boardSection = document.getElementById('board-section');
const rulesSection = document.getElementById('rules-section');
const btnRestart = document.getElementById('btn-restart');
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

    modalElement.classList.add('hidden');
    gameControlsElement.style.visibility = 'visible';

    updateStatus();
    renderBoard();
}

function renderBoard() {
    boardElement.innerHTML = '';
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');

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

function handleCellClick(r, c) {
    if (!gameActive) return;

    // Bloquear interacción si es el turno de la CPU
    if (isPvE && currentPlayer === 2) return;

    if (board[r][c] === currentPlayer) {
        selectedCell = { r, c };
        calculateValidMoves(r, c);
        renderBoard();
        return;
    }

    if (selectedCell && validMoves.some(m => m.r === r && m.c === c)) {
        board[r][c] = currentPlayer;
        board[selectedCell.r][selectedCell.c] = 0;

        selectedCell = null;
        validMoves = [];
        renderBoard();

        checkGameEnd();
    }
}

function calculateValidMoves(r, c) {
    validMoves = calculateValidMovesForPiece(r, c);
}

function calculateValidMovesForPiece(r, c) {
    let moves = [];
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];

    directions.forEach(dir => {
        let nr = r + dir[0];
        let nc = c + dir[1];
        let lastEmpty = null;

        while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc] === 0) {
            lastEmpty = { r: nr, c: nc };
            nr += dir[0];
            nc += dir[1];
        }

        if (lastEmpty) {
            moves.push(lastEmpty);
        }
    });
    return moves;
}

function checkGameEnd() {
    if (checkWin(currentPlayer)) {
        endGameShowModal(currentPlayer === 2 && isPvE ? `¡La CPU ha ganado!` : `¡El Jugador ${currentPlayer} ha ganado!`);
        return;
    }

    if (checkTrapLoss(currentPlayer)) {
        const opponent = currentPlayer === 1 ? 2 : 1;
        let winnerText = opponent === 2 && isPvE ? "La CPU" : `Jugador ${opponent}`;
        let loserText = currentPlayer === 2 && isPvE ? "La CPU" : `Jugador ${currentPlayer}`;

        endGameShowModal(`¡${loserText} atrapó al rival y PIERDE!\nGana ${winnerText}.`);
        return;
    }

    currentPlayer = currentPlayer === 1 ? 2 : 1;
    updateStatus();

    if (gameActive && isPvE && currentPlayer === 2) {
        setTimeout(makeAIMove, 600);
    }
}

// --- Lógica de la CPU ---
function makeAIMove() {
    if (!gameActive || currentPlayer !== 2) return;

    let allMoves = [];

    // Recopilar todos los movimientos válidos para la CPU
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] === 2) {
                let pieceMoves = calculateValidMovesForPiece(r, c);
                pieceMoves.forEach(move => {
                    allMoves.push({ from: { r, c }, to: move });
                });
            }
        }
    }

    if (allMoves.length === 0) return;

    let chosenMove = null;

    // Comprobar si hay un movimiento que gane inmediatamente
    for (let move of allMoves) {
        // Simular movimiento
        board[move.to.r][move.to.c] = 2;
        board[move.from.r][move.from.c] = 0;

        if (checkWin(2)) {
            chosenMove = move;
        }

        // Deshacer movimiento
        board[move.from.r][move.from.c] = 2;
        board[move.to.r][move.to.c] = 0;

        if (chosenMove) break; // Si encontramos uno ganador, detenemos la búsqueda
    }

    // Si no hay movimiento ganador, elegir uno al azar
    if (!chosenMove) {
        chosenMove = allMoves[Math.floor(Math.random() * allMoves.length)];
    }

    // Ejecutar el movimiento con un efecto visual seleccionando primero la ficha
    selectedCell = chosenMove.from;
    renderBoard();

    setTimeout(() => {
        board[chosenMove.to.r][chosenMove.to.c] = 2;
        board[chosenMove.from.r][chosenMove.from.c] = 0;
        selectedCell = null;
        renderBoard();
        checkGameEnd();
    }, 400);
}
// ------------------------

function endGameShowModal(message) {
    statusElement.innerText = message;
    modalMessageElement.innerText = message;
    modalElement.classList.remove('hidden');
    gameControlsElement.style.visibility = 'hidden';
    gameActive = false;
}

function checkWin(p) {
    if (board[0][0] === p && board[0][3] === p && board[3][0] === p && board[3][3] === p) return true;

    for (let r = 0; r <= 2; r++) {
        for (let c = 0; c <= 2; c++) {
            if (board[r][c] === p && board[r+1][c] === p && board[r][c+1] === p && board[r+1][c+1] === p) return true;
        }
    }

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

function updateStatus() {
    if (isPvE && currentPlayer === 2) {
        statusElement.innerText = `Turno de la CPU`;
    } else {
        statusElement.innerText = `Turno del Jugador ${currentPlayer}`;
    }
    statusElement.style.color = currentPlayer === 1 ? '#ff7675' : '#74b9ff';
}

// --- Gestión de Pestañas ---
function setActiveTab(activeBtn) {
    btnPvP.classList.remove('active');
    btnCPU.classList.remove('active');
    btnRules.classList.remove('active');
    activeBtn.classList.add('active');

    if (activeBtn !== btnRules) {
        boardSection.classList.remove('hidden');
        rulesSection.classList.add('hidden');
    }
}

btnPvP.addEventListener('click', () => {
    isPvE = false;
    setActiveTab(btnPvP);
    initGame();
});

btnCPU.addEventListener('click', () => {
    isPvE = true;
    setActiveTab(btnCPU);
    initGame();
});

btnRules.addEventListener('click', () => {
    setActiveTab(btnRules);
    rulesSection.classList.remove('hidden');
    boardSection.classList.add('hidden');
});

btnRestart.addEventListener('click', initGame);
modalBtnRestart.addEventListener('click', initGame);

// Iniciar
initGame();
