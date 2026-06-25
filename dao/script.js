const ROWS = 4;
const COLS = 4;

let board = [];
let currentPlayer = 1;
let selectedCell = null;
let validMoves = [];
let gameActive = true;
let isPvE = false;
let currentLang = 'en';

const translations = {
    es: {
        pvp: "P vs P",
        pvcpu: "P vs CPU",
        rulesBtn: "Reglas",
        restart: "Reiniciar Juego",
        rulesTitle: "Reglas de Dao",
        rulesP1: "Dao es un juego abstracto para dos jugadores en un tablero de 4x4. El objetivo es cumplir <strong>una</strong> de las siguientes condiciones de victoria:",
        rulesL1: "Formar una línea recta (horizontal o vertical) con tus 4 piezas.",
        rulesL2: "Formar un cuadrado de 2x2 con tus piezas en cualquier lugar del tablero.",
        rulesL3: "Ocupar las 4 esquinas del tablero.",
        rulesMoveTitle: "Movimiento",
        rulesMoveP: "En tu turno, debes seleccionar y mover una de tus piezas. Las piezas se deslizan ortogonal o diagonalmente (como una reina en ajedrez) pero <strong>deben continuar moviéndose</strong> hasta chocar con el borde del tablero o con otra pieza.",
        rulesSpecialTitle: "Regla Especial (Atrapado)",
        rulesSpecialP: "Si al finalizar tu movimiento encierras una pieza del oponente en una esquina usando 3 de tus piezas, ¡pierdes automáticamente la partida por obligarlo a no poder moverse!",
        playAgain: "Volver a jugar",
        turnP1: "Turno del Jugador 1",
        turnP2: "Turno del Jugador 2",
        turnCPU: "Turno de la CPU",
        winP1: "¡El Jugador 1 ha ganado!",
        winP2: "¡El Jugador 2 ha ganado!",
        winCPU: "¡La CPU ha ganado!",
        trapLoss: "¡{loser} atrapó al rival y PIERDE!\nGana {winner}.",
        player1: "Jugador 1",
        player2: "Jugador 2",
        cpu: "La CPU",
        langToggle: "🌐 ES"
    },
    en: {
        pvp: "P vs P",
        pvcpu: "P vs CPU",
        rulesBtn: "Rules",
        restart: "Restart Game",
        rulesTitle: "Dao Rules",
        rulesP1: "Dao is an abstract two-player game on a 4x4 board. The goal is to fulfill <strong>one</strong> of the following win conditions:",
        rulesL1: "Form a straight line (horizontal or vertical) with your 4 pieces.",
        rulesL2: "Form a 2x2 square with your pieces anywhere on the board.",
        rulesL3: "Occupy the 4 corners of the board.",
        rulesMoveTitle: "Movement",
        rulesMoveP: "On your turn, you must select and move one of your pieces. Pieces slide orthogonally or diagonally (like a queen in chess) but <strong>must continue moving</strong> until they hit the edge of the board or another piece.",
        rulesSpecialTitle: "Special Rule (Trapped)",
        rulesSpecialP: "If at the end of your move you trap an opponent's piece in a corner using 3 of your pieces, you automatically lose the game for forcing them into a position where they cannot move!",
        playAgain: "Play Again",
        turnP1: "Player 1's Turn",
        turnP2: "Player 2's Turn",
        turnCPU: "CPU's Turn",
        winP1: "Player 1 has won!",
        winP2: "Player 2 has won!",
        winCPU: "CPU has won!",
        trapLoss: "{loser} trapped the opponent and LOSES!\n{winner} wins.",
        player1: "Player 1",
        player2: "Player 2",
        cpu: "The CPU",
        langToggle: "🌐 EN"
    }
};

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
const btnLang = document.getElementById('btn-lang');

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
        let winMessage = currentPlayer === 1 ? translations[currentLang].winP1 :
        (isPvE ? translations[currentLang].winCPU : translations[currentLang].winP2);
        endGameShowModal(winMessage);
        return;
    }

    if (checkTrapLoss(currentPlayer)) {
        const opponent = currentPlayer === 1 ? 2 : 1;
        let winnerText = opponent === 2 && isPvE ? translations[currentLang].cpu : translations[currentLang]["player" + opponent];
        let loserText = currentPlayer === 2 && isPvE ? translations[currentLang].cpu : translations[currentLang]["player" + currentPlayer];

        let trapMessage = translations[currentLang].trapLoss
        .replace("{loser}", loserText)
        .replace("{winner}", winnerText);

        endGameShowModal(trapMessage);
        return;
    }

    currentPlayer = currentPlayer === 1 ? 2 : 1;
    updateStatus();

    if (gameActive && isPvE && currentPlayer === 2) {
        setTimeout(makeAIMove, 600);
    }
}

function makeAIMove() {
    if (!gameActive || currentPlayer !== 2) return;

    let allMoves = [];

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

    for (let move of allMoves) {
        board[move.to.r][move.to.c] = 2;
        board[move.from.r][move.from.c] = 0;

        if (checkWin(2)) {
            chosenMove = move;
        }

        board[move.from.r][move.from.c] = 2;
        board[move.to.r][move.to.c] = 0;

        if (chosenMove) break;
    }

    if (!chosenMove) {
        chosenMove = allMoves[Math.floor(Math.random() * allMoves.length)];
    }

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
    if (!gameActive) return;

    if (isPvE && currentPlayer === 2) {
        statusElement.innerText = translations[currentLang].turnCPU;
    } else {
        statusElement.innerText = currentPlayer === 1 ? translations[currentLang].turnP1 : translations[currentLang].turnP2;
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

// --- Gestión de Idiomas ---
function updateTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLang][key]) {
            el.innerHTML = translations[currentLang][key];
        }
    });

    btnLang.innerText = translations[currentLang].langToggle;
    updateStatus();
}

function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'es' : 'en';
    updateTranslations();
}

btnLang.addEventListener('click', toggleLanguage);

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

initGame();
updateTranslations();
