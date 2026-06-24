// GridNexus Achievement & Badge Tracking Engine: Manages metrics, local storage, and real-time audio synthesis.
const AchievementsEngine = (function () {
    'use strict';

    // Core definitions for all available badges and achievements.
    const BADGES = [
        { id: 'first_blood', title: 'First Blood', desc: 'Secure a victory in any classic match.', icon: '<i class="fa-solid fa-crosshairs"></i>' },
        { id: 'giant_slayer', title: 'Giant Slayer', desc: 'Defeat the AI on Hard difficulty.', icon: '<i class="fa-solid fa-crown"></i>' },
        { id: 'matrix_master', title: 'Matrix Master', desc: 'Win a match on the expanded 5x5 grid.', icon: '<i class="fa-solid fa-border-all"></i>' },
        { id: 'ultimate_titan', title: 'Ultimate Titan', desc: 'Conquer the 9x9 Ultimate Nexus arena.', icon: '<i class="fa-solid fa-atom"></i>' },
        { id: 'blitz_survivor', title: 'Blitz Survivor', desc: 'Win a match with the Blitz protocol enabled.', icon: '<i class="fa-solid fa-bolt"></i>' },
        { id: 'tactical_draw', title: 'Stalemate', desc: 'Force a tie against the flawless Hard AI.', icon: '<i class="fa-solid fa-handshake"></i>' },
        { id: 'x_legion', title: 'X Legion', desc: 'Reach 10 total victories as Player X.', icon: '<i class="fa-solid fa-medal"></i>' },
        { id: 'o_dynasty', title: 'O Dynasty', desc: 'Reach 10 total victories as Player O.', icon: '<i class="fa-solid fa-shield-halved"></i>' },
        { id: 'tie_society', title: 'Tie Society', desc: 'Accumulate 10 match draws.', icon: '<i class="fa-solid fa-equals"></i>' }
    ];

    // Load existing unlocked badges from localStorage or initialize empty.
    let unlockedBadges = JSON.parse(localStorage.getItem('gridnexus_badges')) || [];
    // Persistent tracking of lifetime stats for score-based achievements.
    let stats = JSON.parse(localStorage.getItem('gridnexus_stats')) || { x_wins: 0, o_wins: 0, ties: 0 };

    // Resets all local achievement data.
    function resetAchievements() {
        unlockedBadges = [];
        stats = { x_wins: 0, o_wins: 0, ties: 0 };
        localStorage.removeItem('gridnexus_badges');
        localStorage.removeItem('gridnexus_stats');
        renderBadgesInModal();
        console.log("Achievement Matrix Purged.");
    }


    // Unlocks a badge (id: string) if it hasn't already been achieved.
    function unlockBadge(id) {
        if (unlockedBadges.includes(id)) return;

        unlockedBadges.push(id);
        
        // Persist achievement data with error handling for storage limits.
        try {
            localStorage.setItem('gridnexus_badges', JSON.stringify(unlockedBadges));
        } catch (storageError) {
            console.error("Failed to write achievement to localStorage: ", storageError);
        }

        // Trigger toast with sound feedback
        const badge = BADGES.find(b => b.id === id);
        if (badge && typeof window.showToast === 'function') {
            window.showToast(`Achievement Unlocked: ${badge.title}`, 'success');
        }

        // Refresh the UI layout matrix.
        renderBadgesInModal();
        
        // Apply flash animation to the new badge element.
        const element = document.querySelector(`[data-badge-id="${id}"]`);
        if (element) {
            element.classList.add('badge-just-unlocked');
        }
    }

    // Sets the unlocked badges from the database.
    function setUnlockedBadges(badges) {
        unlockedBadges = Array.isArray(badges) ? badges : [];
        localStorage.setItem('gridnexus_badges', JSON.stringify(unlockedBadges));
        renderBadgesInModal();
    }

    // Synchronizes local stats with backend data and re-evaluates milestones.
    function syncStats(newStats) {
        if (!newStats) return;
        stats.x_wins = newStats.X || 0;
        stats.o_wins = newStats.O || 0;
        stats.ties = newStats.ties || 0;
        evaluateMilestones();
    }

    // Updates lifetime statistics and evaluates score-based milestones.
    function recordResult(winner) {
        if (winner === 'X') stats.x_wins++;
        else if (winner === 'O') stats.o_wins++;
        else stats.ties++; // Handles 'Draw' or 'ties'

        localStorage.setItem('gridnexus_stats', JSON.stringify(stats));
        evaluateMilestones();
    }

    function evaluateMilestones() {
        // Ensure no milestones are evaluated or saved if all scores are zero
        if (stats.x_wins === 0 && stats.o_wins === 0 && stats.ties === 0) return;

        // Check for score-based milestone unlocks
        if (stats.x_wins >= 10) unlockBadge('x_legion');
        if (stats.o_wins >= 10) unlockBadge('o_dynasty');
        if (stats.ties >= 10) unlockBadge('tie_society');
        
        if (typeof window.saveUserAchievements === 'function') window.saveUserAchievements(unlockedBadges);
    }

    // Main UI update loop for the achievements modal interface.
    function renderBadgesInModal() {
        const container = document.getElementById('badges-grid-container');
        const titleEl = document.getElementById('badgesModalTitle');
        if (!container) return;

        // Update modal title with achievement progress and lifetime stats.
        if (titleEl) {
            titleEl.innerHTML = `
                Achievements <span class="badge-progress-count">(${unlockedBadges.length}/${BADGES.length})</span>
                <div style="font-size: 0.75rem; opacity: 0.6; margin-top: 5px; font-weight: normal;">
                    Lifetime Stats — X: ${stats.x_wins} | O: ${stats.o_wins} | Ties: ${stats.ties}
                </div>`;
        }
        container.innerHTML = '';

        BADGES.forEach(badge => {
            const isUnlocked = unlockedBadges.includes(badge.id);
            const tierClass = getTierClass(badge.id);
            
            const badgeCard = document.createElement('div');
            badgeCard.className = `badge-item ${isUnlocked ? 'unlocked' : 'locked'} ${tierClass}`;
            badgeCard.setAttribute('data-badge-id', badge.id);

            badgeCard.innerHTML = `
                <div class="badge-status-overlay">${isUnlocked ? '' : '<i class="fa-solid fa-lock"></i>'}</div>
                <div class="badge-icon-wrapper">${badge.icon}</div>
                <div class="badge-meta">
                    <h4>${badge.title}</h4>
                    <p>${badge.desc}</p>
                </div>
            `;

            container.appendChild(badgeCard);
        });
    }

    // Maps badge IDs to their respective CSS tier classes.
    function getTierClass(id) {
        const mapping = {
            'ultimate_titan': 'tier-legendary',
            'giant_slayer': 'tier-epic',
            'blitz_survivor': 'tier-rare',
            'matrix_master': 'tier-uncommon',
            'first_blood': 'tier-uncommon',
            'tactical_draw': 'tier-rare',
            'x_legion': 'tier-rare',
            'o_dynasty': 'tier-rare',
            'tie_society': 'tier-uncommon'
        };
        return mapping[id] || 'tier-common';
    }

    // Public API exposure.
    return {
        unlock: unlockBadge,
        render: renderBadgesInModal,
        getUnlockedCount: () => unlockedBadges.length,
        recordResult: recordResult,
        syncStats: syncStats,
        reset: resetAchievements,
        setBadges: setUnlockedBadges
    };
})();