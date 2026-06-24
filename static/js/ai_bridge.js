// SECTION 1: MODULE INITIALIZATION
// GridNexus AI API Communication Bridge: Handles centralized network requests for server-side AI move calculations.
const AIBridge = (function () {
    'use strict';

    // SECTION 2: ENDPOINT CONFIGURATION: Mappings to the Flask backend routes.
    const ENDPOINTS = {
        CLASSIC: '/api/classic-move',
        ULTIMATE: '/api/ultimate-move'
    };

    // SECTION 3: CLASSIC MODE HANDLER: Requests moves for 3x3 and 5x5 standard Tic-Tac-Toe variants.
    // @param {Array<string>} board, {number} size, {string} difficulty.
    // @returns {Promise<number>} Resolves to the absolute index selected by the AI.
    async function requestClassicMove(board, size, difficulty) {
        const payload = { board: board, size: size, difficulty: difficulty };

        try {
            const response = await fetch(ENDPOINTS.CLASSIC, {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Network Failure: ${response.status}`);
            }

            const data = await response.json();
            if (data.success && data.move !== undefined) return data.move;
            throw new Error("Invalid API response: 'move' index missing.");

        } catch (error) {
            console.error("AI Classic Bridge Communication Failure:", error);
            throw error;
        }
    }

    // SECTION 4: ULTIMATE MODE HANDLER: Requests moves for the complex 9x9 Ultimate Tic-Tac-Toe variant.
    // @param {Array<Array<string>>} macroBoard, {number|null} activeBoardIndex, {string} difficulty.
    // @returns {Promise<{sub_board: number, slot: number}>} Resolved coordinate vector.
    async function requestUltimateMove(macroBoard, activeBoardIndex, difficulty) {
        const payload = {
            macro_board: macroBoard,
            active_board_index: activeBoardIndex,
            difficulty: difficulty
        };

        try {
            const response = await fetch(ENDPOINTS.ULTIMATE, {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Network Failure: ${response.status}`);
            }

            const data = await response.json();
            if (data.success && data.sub_board !== undefined && data.slot !== undefined) {
                return { sub_board: data.sub_board, slot: data.slot };
            }
            throw new Error("Invalid API response: coordinate vector missing.");

        } catch (error) {
            console.error("AI Ultimate Bridge Communication Failure:", error);
            throw error;
        }
    }

    // SECTION 5: PUBLIC EXPOSURE: Returns the public methods to be used by the Game Engines.
    return {
        getClassicMove: requestClassicMove,
        getUltimateMove: requestUltimateMove
    };
})();