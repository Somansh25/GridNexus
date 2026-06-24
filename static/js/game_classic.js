// GridNexus Classic & Expanded Gameplay Controller : Handles 3x3 and 5x5 grid matrices, blitz countdown loops, and audio synthesis.
const ClassicGameEngine = (function () {
    'use strict';

    // SECTION 1: STATE CONFIGURATION - Core game state, configuration parameters, and score tracking.
    let boardState = [];
    let gridSize = 3;
    let winStreakRequirement = 3;
    let currentTurn = 'X';
    let isGameActive = false;
    let gameplayMode = 'ai';
    let aiDifficulty = 'hard';
    
    let isBlitzEnabled = false;
    let blitzTimerId = null;
    let timeLeft = 10;

    const Elements = {
        container: null,
        announcer: null,
        timerDisplay: null,
        scoreX: null,
        scoreO: null,
        scoreTies: null
    };

    const scores = { X: 0, O: 0, ties: 0 };

    // SECTION 3: MATCH LIFECYCLE - Handles initial setup and state resets for new matches.

    function initializeMatch(size, mode, difficulty, blitz, initialScores) {
        gridSize = parseInt(size, 10);
        gameplayMode = mode;
        aiDifficulty = difficulty;
        isBlitzEnabled = blitz;
        winStreakRequirement = gridSize === 3 ? 3 : 4;
        
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

        resetMatchState();
    }

    function resetMatchState() {
        stopBlitzTimer();
        boardState = Array(gridSize * gridSize).fill("");
        currentTurn = 'X';
        // scores = { X: 0, O: 0, ties: 0 }; // Scores should persist across restarts unless explicitly cleared
        isGameActive = true;

        if (isBlitzEnabled) {
            Elements.timerDisplay.classList.remove('hidden');
            startBlitzTimer();
        } else {
            Elements.timerDisplay.classList.add('hidden');
        }

        updateScoreboardDOM(); // Update scoreboard with current scores
        renderVisualGrid();
        updateAnnouncerText();
    }

    // SECTION 4: RENDERING ENGINE - Dynamically constructs the game board DOM elements.

    function renderVisualGrid() {
        Elements.container.innerHTML = '';
        
        const gridDiv = document.createElement('div');
        gridDiv.className = gridSize === 3 ? 'grid-3x3' : 'grid-5x5';

        for (let i = 0; i < boardState.length; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.setAttribute('data-index', i);
            
            cell.addEventListener('click', () => handleCellSelection(i));
            gridDiv.appendChild(cell);
        }

        Elements.container.appendChild(gridDiv);
    }

    // SECTION 5: INTERACTION & GAME LOGIC - Processes player moves, AI turns, and board state updates.

    async function handleCellSelection(index, isProgrammatic = false) {
        if (!isGameActive || boardState[index] !== "") return;

        if (gameplayMode === 'ai' && currentTurn === 'O' && !isProgrammatic) return;

        executeMove(index, currentTurn);

        if (evaluateMatchOutcome()) return;

        currentTurn = currentTurn === 'X' ? 'O' : 'X';
        updateAnnouncerText();
        
        if (isBlitzEnabled) startBlitzTimer();

        if (gameplayMode === 'ai' && currentTurn === 'O' && isGameActive) {
            const boardDOM = Elements.container;
            if (boardDOM) boardDOM.classList.add('board-computing-lock');

            try {
                const aiMove = await AIBridge.getClassicMove(boardState, gridSize, aiDifficulty);
                
                if (boardDOM) boardDOM.classList.remove('board-computing-lock');
                
                if (aiMove !== undefined && isGameActive) {
                    handleCellSelection(aiMove, true);
                }
            } catch (error) {
                if (boardDOM) boardDOM.classList.remove('board-computing-lock');
                console.error("Classic AI processing bridge vector dropped, launching structural safety fallback:", error);
                
                const openSpots = boardState.map((val, i) => val === "" ? i : null).filter(v => v !== null);
                if (openSpots.length > 0 && isGameActive) {
                    handleCellSelection(openSpots[0], true);
                }
            }
        }
    }

    function executeMove(index, symbol) {
        boardState[index] = symbol;

        const cell = Elements.container.querySelector(`[data-index="${index}"]`);
        if (cell) {
            cell.setAttribute('data-symbol', symbol);
            cell.innerHTML = `<span class="cell-mark">${symbol}</span>`;
        }
    }

    // SECTION 6: WIN DETECTION - Scans the board for winning alignments or draws.

    function checkCombinations() {
        const size = gridSize;
        const streak = winStreakRequirement;

        const checkLine = (cells) => {
            if (cells.length < streak) return null;
            for (let i = 0; i <= cells.length - streak; i++) {
                const chunk = cells.slice(i, i + streak);
                if (chunk.every(idx => boardState[idx] === 'X')) return { winner: 'X', indices: chunk };
                if (chunk.every(idx => boardState[idx] === 'O')) return { winner: 'O', indices: chunk };
            }
            return null;
        };

        // 1. Rows
        for (let r = 0; r < size; r++) {
            const row = [];
            for (let c = 0; c < size; c++) row.push(r * size + c);
            const res = checkLine(row); if (res) return res;
        }

        // 2. Columns
        for (let c = 0; c < size; c++) {
            const col = [];
            for (let r = 0; r < size; r++) col.push(r * size + c);
            const res = checkLine(col); if (res) return res;
        }

        // 3. Diagonals (Left-To-Right)
        for (let r = 0; r <= size - streak; r++) {
            for (let c = 0; c <= size - streak; c++) {
                const diag = [];
                for (let i = 0; i < streak; i++) diag.push((r + i) * size + (c + i));
                if (boardState[diag[0]] !== "" && diag.every(idx => boardState[idx] === boardState[diag[0]])) {
                    return { winner: boardState[diag[0]], indices: diag };
                }
            }
        }
        // 4. Diagonals (Right-To-Left)
        for (let r = 0; r <= size - streak; r++) {
            for (let c = streak - 1; c < size; c++) {
                const diag = [];
                for (let i = 0; i < streak; i++) diag.push((r + i) * size + (c - i));
                if (boardState[diag[0]] !== "" && diag.every(idx => boardState[idx] === boardState[diag[0]])) {
                    return { winner: boardState[diag[0]], indices: diag };
                }
            }
        }

        return null;
    }

    function evaluateMatchOutcome() {
        const result = checkCombinations();

        if (result) {
            stopBlitzTimer();
            isGameActive = false;
            scores[result.winner]++;
            updateScoreboardDOM();
            AchievementsEngine.recordResult(result.winner);
            
            Elements.announcer.innerText = `Victory for Alignment ${result.winner}!`;
            window.showToast(`Victory for Alignment ${result.winner}!`, result.winner === 'X' ? 'victory' : 'fail');

            result.indices.forEach(idx => {
                const cell = Elements.container.querySelector(`[data-index="${idx}"]`);
                if (cell) cell.classList.add(`winning-sequence-${result.winner.toLowerCase()}`);
            });

            if (gameplayMode === 'ai' && result.winner === 'X') {
                AchievementsEngine.unlock('first_blood');
                if (aiDifficulty === 'hard') AchievementsEngine.unlock('giant_slayer');
                if (gridSize === 5) AchievementsEngine.unlock('matrix_master');
                if (isBlitzEnabled) AchievementsEngine.unlock('blitz_survivor');
            }
            if (typeof window.saveUserScores === 'function') window.saveUserScores(scores);
            return true;
        }

        if (!boardState.includes("")) {
            stopBlitzTimer();
            isGameActive = false;
            scores.ties++;
            updateScoreboardDOM();
            AchievementsEngine.recordResult('Draw');
            Elements.announcer.innerText = "Match Concluded: Technical Draw Matrix.";
            window.showToast("Match Concluded: Technical Draw Matrix.", 'info');

            if (gameplayMode === 'ai' && aiDifficulty === 'hard') {
                AchievementsEngine.unlock('tactical_draw');
            }
            if (typeof window.saveUserScores === 'function') window.saveUserScores(scores);
            return true;
        }

        return false;
    }

    // SECTION 7: BLITZ PROTOCOL - Manages the high-speed timed gameplay mode.

    function startBlitzTimer() {
        stopBlitzTimer();
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
                stopBlitzTimer();
                forceTimeoutForfeit();
            }
        }, 1000);
    }

    function stopBlitzTimer() {
        if (blitzTimerId) {
            clearInterval(blitzTimerId);
            blitzTimerId = null;
        }
    }

    function forceTimeoutForfeit() {
        if (!isGameActive) return;
        const openSpots = boardState.map((val, i) => val === "" ? i : null).filter(v => v !== null);
        
        if (openSpots.length > 0) {
            const randomPick = openSpots[Math.floor(Math.random() * openSpots.length)];
            handleCellSelection(randomPick);
        }
    }

    // SECTION 8: UI SYNCHRONIZERS - Updates UI components based on game state.

    function updateAnnouncerText() {
        if (gameplayMode === 'ai') {
            Elements.announcer.innerText = currentTurn === 'X' ? "Your Turn (X)" : "AI Processing Data (O)...";
        } else {
            Elements.announcer.innerText = `Local Player ${currentTurn}'s Move`;
        }
    }

    function updateScoreboardDOM() {
        if (Elements.scoreX) Elements.scoreX.innerText = scores.X;
        if (Elements.scoreO) Elements.scoreO.innerText = scores.O;
        if (Elements.scoreTies) Elements.scoreTies.innerText = scores.ties;
    }

    // SECTION 9: PUBLIC API
    return {
        startMatch: function(size, mode, difficulty, blitz, initialScores) {
            initializeMatch(size, mode, difficulty, blitz, initialScores);
        },
        restartMatch: resetMatchState,
        abortMatch: () => { stopBlitzTimer(); isGameActive = false; },
        setScores: function(newScores) {
            scores.X = newScores.X; scores.O = newScores.O; scores.ties = newScores.ties;
            updateScoreboardDOM();
        },
        clearScores: () => { scores.X = 0; scores.O = 0; scores.ties = 0; updateScoreboardDOM(); }
    };
})();