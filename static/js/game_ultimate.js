// GridNexus Ultimate 9x9 Gameplay Controller - Implements nested micro-macro state rules, tactical lock masks, blitz runtimes, and real-time audio synthesis.
const UltimateGameEngine = (function () {
    'use strict';

    // SECTION 1: STATE CONFIGURATION - Core board logic and gameplay state tracking.
    let macroBoard = [];
    let macroStatus = [];
    let activeBoardIndex = null;
    let currentTurn = 'X';
    let isGameActive = false;
    let gameplayMode = 'ai';
    let aiDifficulty = 'hard';
    let isBlitzEnabled = false;
    let blitzTimerId = null;
    let timeLeft = 10;
    
    const Elements = { container: null, announcer: null, timerDisplay: null, scoreX: null, scoreO: null, scoreTies: null };
    const scores = { X: 0, O: 0, ties: 0 };

    // SECTION 3: MATCH LIFECYCLE - Initializes and resets match state for the 9x9 arena.

    function initializeUltimateMatch(mode, difficulty, blitz, initialScores) {
        gameplayMode = mode;
        aiDifficulty = difficulty;
        isBlitzEnabled = blitz;

        // Initialize scores from provided values or reset to 0
        scores.X = initialScores ? initialScores.X : 0;
        scores.O = initialScores ? initialScores.O : 0;
        scores.ties = initialScores ? initialScores.ties : 0;


        Elements.container = document.getElementById('game-board-container');
        Elements.announcer = document.getElementById('turn-announcer');
        Elements.timerDisplay = document.getElementById('blitz-timer-display');
        Elements.scoreX = document.getElementById('score-x-val');
        Elements.scoreO = document.getElementById('score-o-val');
        Elements.scoreTies = document.getElementById('score-ties-val');

        resetUltimateState();
    }

    function resetUltimateState() {
        stopUltimateBlitzTimer();
        
        macroBoard = Array.from({ length: 9 }, () => Array(9).fill(""));
        macroStatus = Array(9).fill(null);
        activeBoardIndex = null;
        currentTurn = 'X';
        // scores = { X: 0, O: 0, ties: 0 }; // Scores should persist across restarts unless explicitly cleared
        isGameActive = true;

        if (isBlitzEnabled) {
            Elements.timerDisplay.classList.remove('hidden');
            startUltimateBlitzTimer();
        } else {
            Elements.timerDisplay.classList.add('hidden');
        }

        updateScoreboardDOM(); // Update scoreboard with current scores
        renderMacroGridDOM();
        updateAnnouncerUI();
    }

    // SECTION 4: RENDERING ENGINE - Constructs the nested micro-macro DOM architecture.

    function renderMacroGridDOM() {
        Elements.container.innerHTML = '';

        const macroGridDiv = document.createElement('div');
        macroGridDiv.className = 'ultimate-macro-grid';

        for (let subIdx = 0; subIdx < 9; subIdx++) {
            const microGridSector = document.createElement('div');
            microGridSector.className = 'micro-grid-sector';
            microGridSector.setAttribute('data-sub-board', subIdx);

            for (let slotIdx = 0; slotIdx < 9; slotIdx++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.setAttribute('data-sub', subIdx);
                cell.setAttribute('data-slot', slotIdx);

                cell.addEventListener('click', () => handleCellClick(subIdx, slotIdx));
                microGridSector.appendChild(cell);
            }

            macroGridDiv.appendChild(microGridSector);
        }

        Elements.container.appendChild(macroGridDiv);
        synchronizeGridLockMasks();
    }

    // SECTION 5: INTERACTION & GAME LOGIC - Handles input validation, moves, and AI delegation.

    async function handleCellClick(subIdx, slotIdx, isProgrammatic = false) {
        if (!isGameActive || macroBoard[subIdx][slotIdx] !== "") return;
        if (activeBoardIndex !== null && activeBoardIndex !== subIdx) return;
        if (macroStatus[subIdx] !== null) return;
        if (gameplayMode === 'ai' && currentTurn === 'O' && !isProgrammatic) return;

        executeUltimateMove(subIdx, slotIdx, currentTurn);
        evaluateMicroGridResolution(subIdx);

        if (evaluateGlobalOutcome()) return;

        activeBoardIndex = slotIdx;
        if (macroStatus[activeBoardIndex] !== null || !macroBoard[activeBoardIndex].includes("")) {
            activeBoardIndex = null;
        }

        currentTurn = currentTurn === 'X' ? 'O' : 'X';
        updateAnnouncerUI();
        synchronizeGridLockMasks();

        if (isBlitzEnabled) startUltimateBlitzTimer();

        if (gameplayMode === 'ai' && currentTurn === 'O' && isGameActive) {
            try {
                const aiMove = await AIBridge.getUltimateMove(macroBoard, activeBoardIndex, aiDifficulty);
                if (aiMove && isGameActive) {
                    handleCellClick(aiMove.sub_board, aiMove.slot, true);
                }
            } catch (error) {
                console.error("Ultimate AI pipeline error, launching emergency backup move:", error);
                const legalMoves = getLocalLegalMoves();
                if (legalMoves.length > 0) {
                    handleCellClick(legalMoves[0].sub, legalMoves[0].slot, true);
                }
            }
        }
    }

    function executeUltimateMove(subIdx, slotIdx, symbol) {
        macroBoard[subIdx][slotIdx] = symbol;

        const cell = Elements.container.querySelector(`[data-sub="${subIdx}"][data-slot="${slotIdx}"]`);
        if (cell) {
            cell.setAttribute('data-symbol', symbol);
            cell.innerHTML = `<span class="cell-mark">${symbol}</span>`;
        }
    }

    // SECTION 6: GRID SYNCHRONIZATION - Manages visual states (locked/active) of sub-sectors.

    function synchronizeGridLockMasks() {
        const sectors = Elements.container.querySelectorAll('.micro-grid-sector');
        
        sectors.forEach(sector => {
            const subIdx = parseInt(sector.getAttribute('data-sub-board'), 10);
            sector.classList.remove('locked', 'active-target');

            if (macroStatus[subIdx] !== null) {
                return; 
            }

            if (activeBoardIndex === null) {
                sector.classList.remove('locked');
            } else if (activeBoardIndex === subIdx) {
                sector.classList.add('active-target');
            } else {
                sector.classList.add('locked');
            }
        });
    }

    // SECTION 7: WIN DETECTION - Algorithms for scanning both micro-grids and the global macro-grid.
    const WIN_COMBINATIONS = [ 
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Horizontals
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Verticals
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    function evaluateMicroGridResolution(subIdx) {
        const board = macroBoard[subIdx];

        for (const line of WIN_COMBINATIONS) {
            if (board[line[0]] !== "" && board[line[0]] === board[line[1]] && board[line[0]] === board[line[2]]) {
                macroStatus[subIdx] = board[line[0]];
                applyVisualSectorResolution(subIdx, board[line[0]]);
                window.showToast(`Sector Captured by ${board[line[0]]}!`, 'success');
                return;
            }
        }

        if (!board.includes("")) {
            macroStatus[subIdx] = 'Draw';
            applyVisualSectorResolution(subIdx, 'Draw');
        }
    }

    function applyVisualSectorResolution(subIdx, outcome) {
        const sector = Elements.container.querySelector(`[data-sub-board="${subIdx}"]`);
        if (sector) {
            sector.classList.remove('active-target', 'locked');
            sector.classList.add(`resolved-${outcome.toLowerCase()}`);
        }
    }

    function evaluateGlobalOutcome() {
        for (const line of WIN_COMBINATIONS) {
            if (macroStatus[line[0]] && macroStatus[line[0]] !== 'Draw' &&
                macroStatus[line[0]] === macroStatus[line[1]] && macroStatus[line[0]] === macroStatus[line[2]]) {
                concludeMatch(macroStatus[line[0]], line);
                return true;
            }
        }

        if (!macroStatus.includes(null)) {
            concludeMatch('Draw', null);
            return true;
        }
        return false;
    }

    // SECTION 8: MATCH CONCLUSION - Finalizes scores and updates achievements.

    function concludeMatch(winner, winningLine) {
        stopUltimateBlitzTimer();
        isGameActive = false;
        activeBoardIndex = null;
        synchronizeGridLockMasks();

        if (winner === 'Draw') {
            scores.ties++;
            Elements.announcer.innerText = "Global Ultimate Stalemate Achieved.";
            window.showToast("Global Ultimate Stalemate Achieved.", 'info');
            AchievementsEngine.recordResult('Draw');
        } else {
            scores[winner]++;
            Elements.announcer.innerText = `Ultimate Victory For Player ${winner}!`;
            window.showToast(`Ultimate Victory for Player ${winner}!`, winner === 'X' ? 'victory' : 'fail');
            AchievementsEngine.recordResult(winner);

            if (winningLine) {
                winningLine.forEach(subIdx => {
                    const sector = Elements.container.querySelector(`[data-sub-board="${subIdx}"]`);
                    if (sector) sector.classList.add(`winning-sequence-${winner.toLowerCase()}`);
                });
            }

            if (gameplayMode === 'ai' && winner === 'X') {
                AchievementsEngine.unlock('ultimate_titan');
                if (aiDifficulty === 'hard') AchievementsEngine.unlock('giant_slayer');
                if (isBlitzEnabled) AchievementsEngine.unlock('blitz_survivor');
            }
        }
        updateScoreboardDOM();
        if (typeof window.saveUserScores === 'function') window.saveUserScores(scores);
    }

    // SECTION 9: BLITZ PROTOCOL

    function startUltimateBlitzTimer() {
        stopUltimateBlitzTimer();
        timeLeft = 10;
        Elements.timerDisplay.innerText = `00:${timeLeft < 10 ? '0' : ''}${timeLeft}`;
        Elements.timerDisplay.classList.remove('timer-warning-active');

        blitzTimerId = setInterval(() => {
            timeLeft--;
            Elements.timerDisplay.innerText = `00:${timeLeft < 10 ? '0' : ''}${timeLeft}`;
            if (timeLeft <= 3 && timeLeft > 0) {
                Elements.timerDisplay.classList.add('timer-warning-active');
                window.showToast(`${timeLeft} seconds remaining!`, 'timer');
            }
            if (timeLeft <= 0) {
                stopUltimateBlitzTimer();
                forceUltimateTimeoutPlay();
            }
        }, 1000);
    }

    function stopUltimateBlitzTimer() {
        if (blitzTimerId) {
            clearInterval(blitzTimerId);
            blitzTimerId = null;
        }
    }

    // SECTION 10: HELPERS & UI

    function getLocalLegalMoves() {
        const moves = [];
        if (activeBoardIndex !== null && macroStatus[activeBoardIndex] === null) {
            for (let i = 0; i < 9; i++) {
                if (macroBoard[activeBoardIndex][i] === "") moves.push({ sub: activeBoardIndex, slot: i });
            }
            return moves;
        }
        for (let s = 0; s < 9; s++) {
            if (macroStatus[s] === null) {
                for (let c = 0; c < 9; c++) {
                    if (macroBoard[s][c] === "") moves.push({ sub: s, slot: c });
                }
            }
        }
        return moves;
    }

    function forceUltimateTimeoutPlay() {
        if (!isGameActive) return;
        const legalOptions = getLocalLegalMoves();
        if (legalOptions.length > 0) {
            const pick = legalOptions[Math.floor(Math.random() * legalOptions.length)];
            handleCellClick(pick.sub, pick.slot, true);
        }
    }

    function updateAnnouncerUI() {
        if (gameplayMode === 'ai') {
            Elements.announcer.innerText = currentTurn === 'X' ? "Your Turn (X)" : "AI Analyzing Layer Vectors (O)...";
        } else {
            Elements.announcer.innerText = `Player ${currentTurn}'s Macro Sector Turn`;
        }
    }

    function updateScoreboardDOM() {
         if (Elements.scoreX) Elements.scoreX.innerText = scores.X;
        if (Elements.scoreO) Elements.scoreO.innerText = scores.O;
        if (Elements.scoreTies) Elements.scoreTies.innerText = scores.ties;
    }

    // SECTION 11: PUBLIC API
    return {
        startMatch: function(mode, difficulty, blitz, initialScores) {
            initializeUltimateMatch(mode, difficulty, blitz, initialScores);
        },
        restartMatch: resetUltimateState,
        abortMatch: () => { stopUltimateBlitzTimer(); isGameActive = false; },
        setScores: function(newScores) {
            scores.X = newScores.X; scores.O = newScores.O; scores.ties = newScores.ties;
            updateScoreboardDOM();
        },
        clearScores: () => { scores.X = 0; scores.O = 0; scores.ties = 0; updateScoreboardDOM(); }
    };
})();