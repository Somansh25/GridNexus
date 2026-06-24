/**
 * GridNexus Central Single-Page Architecture Master Controller
 * Orchestrates view navigation matrix transitions, state bindings, 
 * button event mapping, and code-synthesized audio UI click pulses.
 */
document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    // Application state store for reactive-like UI management
    let appState = {
        authenticated: false,
        userName: "",
        activeRoute: "landing",
        userScores: {
            X: 0,
            O: 0,
            ties: 0
        }
    };

    // ==========================================================================
    // 1. GLOBAL ATTACHMENTS (Declared first to ensure buttons never fail)
    // ==========================================================================
        
    // Global Navigation & Viewport Router System
    window.navigateTo = function(target) {
        // Modal triggers
        if (target === 'loginModal' || target === 'signupModal') {
            const modal = document.getElementById(target);
            if (modal) modal.classList.remove('hidden');
            return;
        }

        // Deactivate landing/features/help panels cleanly
        document.querySelectorAll('.page-view').forEach(page => page.classList.remove('active'));
        
        // Hide nested app layout panels safely
        const viewsToHide = ['dashboard-view', 'setup-view', 'arena-view'];
        viewsToHide.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        // Activate targeted single-page view matrix
        if (target === 'landing') {
            const el = document.getElementById('page-landing');
            if (el) el.classList.add('active');
        } else if (target === 'features') {
            const el = document.getElementById('page-features');
            if (el) el.classList.add('active');
        } else if (target === 'help') {
            const el = document.getElementById('page-help');
            if (el) el.classList.add('active');
        } else if (target === 'dashboard') {
            const el = document.getElementById('dashboard-view');
            if (el) el.classList.remove('hidden');
        }

        // Highlight active navigation items across desktop header & mobile sidebar drawers simultaneously
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        const activeLinks = document.querySelectorAll(`[id="link-${target}"]`);
        if (activeLinks.length > 0) {
            activeLinks.forEach(link => link.classList.add('active'));
        } else if (['dashboard', 'setup', 'arena'].includes(target)) {
            const dbLinks = document.querySelectorAll('[id="link-dashboard"]');
            dbLinks.forEach(link => link.classList.add('active'));
        }

        // Auto-Close mobile views to preserve real estate
        const sidebar = document.getElementById('mobilePopupSidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        if (sidebar && sidebar.classList.contains('active')) sidebar.classList.remove('active');
        if (backdrop && backdrop.classList.contains('active')) backdrop.classList.remove('active');
    };

    async function checkIdentityStatus() {
        try {
            const res = await fetch('/api/auth/status');
            if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
            const data = await res.json();
            if (data.logged_in) {
                mapAuthenticatedIdentity(data.name, data.scores, data.achievements);
            } else {
                clearAuthenticatedIdentity();
            }
        } catch (e) {
            console.warn("Identity service unreachable or session check failed:", e);
        }
    }

    // Responsive Sidebar Interface System
    window.toggleMobileSidebar = function() {
        const sidebar = document.getElementById('mobilePopupSidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        
        if (sidebar && backdrop) {
            const isClosing = sidebar.classList.contains('active');
            
            if (isClosing) {
                sidebar.classList.remove('active');
                backdrop.classList.remove('active');
                setTimeout(() => {
                    if (!sidebar.classList.contains('active')) {
                        sidebar.style.display = 'none';
                        backdrop.style.display = 'none';
                    }
                }, 300);
            } else {
                sidebar.style.display = 'block';
                backdrop.style.display = 'block';
                requestAnimationFrame(() => {
                    sidebar.classList.add('active');
                    backdrop.classList.add('active');
                });
            }
        }
    };

    // Responsive Toast Notification Architecture
    window.showToast = function(message, type) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const soundMap = {
            'success': '/static/audio/success-sound.mp3',
            'timer': '/static/audio/timer-sound.mp3',
            'error': '/static/audio/error-sound.mp3',
            'warning': '/static/audio/warning-sound.mp3',
            'info': '/static/audio/info-sound.mp3',
            'fail': '/static/audio/failure-sound.mp3',
            'victory': '/static/audio/victory-sound.mp3'
        };

        const audio = new Audio(soundMap[type] || soundMap['info']);
        
        audio.play().catch(error => {
            console.log("Audio playback delayed until user interacts with the page.", error);
        });

        const toastElement = document.createElement('div');
        toastElement.classList.add('toast-notification', `toast-${type}`);
        
        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;
        toastElement.appendChild(messageSpan);

        container.appendChild(toastElement);

        setTimeout(() => { toastElement.classList.add('toast-show'); }, 20);

        setTimeout(() => {
            toastElement.classList.remove('toast-show');
            toastElement.classList.add('toast-hide');
            setTimeout(() => { toastElement.remove(); }, 300);
        }, 4000);
    };

    // Modal Visibility Controllers
    window.closeModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('hidden');
    };

    window.switchModal = function(showId, hideId) {
        window.closeModal(hideId);
        window.navigateTo(showId);
    };

    window.handleModalOutSideClick = function(event, modalId) {
        const modal = document.getElementById(modalId);
        if (event.target === modal) window.closeModal(modalId);
    };

    // Dropdown Profile Drawer Management
    window.toggleProfileMenu = function() {
        const dropdown = document.getElementById('dropDownMenu');
        if (dropdown) {
            dropdown.classList.toggle('hidden');
            const avatar = document.getElementById('profileAvatar');
            if (avatar) avatar.setAttribute('aria-expanded', !dropdown.classList.contains('hidden'));
        }
    };

    window.handleLogout = async function() {
        try {
            const res = await fetch('/api/auth/logout', { method: 'POST' });
            if (!res.ok) throw new Error('Logout failed on server');
            clearAuthenticatedIdentity();
            window.showToast('Logged out successfully.', 'info');
            window.navigateTo('landing');
        } catch (e) {
            console.error("Logout process error:", e);
            window.showToast('Logout failed.', 'error');
        }
    };

    window.executeLoginFlow = async function() {
        const loginBtn = document.querySelector('#loginModal .btn-primary');
        if (loginBtn) loginBtn.disabled = true;

        const email = document.getElementById('loginEmail').value;
        const pass = document.getElementById('loginPassword').value;
        const errBlock = document.getElementById('loginErrorMsg');
        
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: pass })
            });
            const data = await res.json();
            if (data.success) {
                window.closeModal('loginModal');
                mapAuthenticatedIdentity(data.name, data.scores, data.achievements);
                window.showToast(`Welcome, ${data.name}!`, 'success');
                window.navigateTo('dashboard');
            } else {
                if(errBlock) {
                    errBlock.innerText = data.message;
                    errBlock.classList.remove('hidden');
                }
                window.showToast(data.message, 'error');
            }
        } catch (e) {
            window.showToast("Server connection error.", "error");
        } finally {
            if (loginBtn) loginBtn.disabled = false;
        }
    };

    window.executeSignupFlow = async function() {
        const signupBtn = document.querySelector('#signupModal .btn-primary');
        if (signupBtn) signupBtn.disabled = true;

        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const pass = document.getElementById('signupPassword').value;
        const errBlock = document.getElementById('signupErrorMsg');
        
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(pass)) {
            const msg = "Password must be 8+ chars with uppercase and number.";
            if(errBlock) {
                errBlock.innerText = msg;
                errBlock.classList.remove('hidden');
            }
            window.showToast(msg, 'error');
            if (signupBtn) signupBtn.disabled = false;
            return;
        }

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password: pass })
            });
            const data = await res.json();
            if (data.success) {
                window.closeModal('signupModal');
                // Automatically log the user in since the session is established on the server
                mapAuthenticatedIdentity(data.name, data.scores, data.achievements);
                window.showToast(`Welcome, ${data.name}! Account created.`, "success");
                window.navigateTo('dashboard');
            } else {
                if(errBlock) {
                    errBlock.innerText = data.message;
                    errBlock.classList.remove('hidden');
                }
                window.showToast(data.message, 'error');
            } 
        } catch (e) {
            window.showToast("Network error.", "error");
            console.error("Signup fetch failed:", e);
        } finally {
            if (signupBtn) signupBtn.disabled = false;
        }
    };

    function mapAuthenticatedIdentity(name, scores, achievements) {
        appState.authenticated = true;
        // Use simple text replacement for safety
        const tempDiv = document.createElement('div');
        tempDiv.textContent = name || "Challenger";
        appState.userName = tempDiv.textContent;

        appState.userScores = scores || { X: 0, O: 0, ties: 0 };

        const nas = document.getElementById('navAuthSection');
        const upm = document.getElementById('userProfileMenu');
        const avt = document.getElementById('profileAvatar');
        const ppt = document.getElementById('player-profile-tag');
        const dName = document.getElementById('dropdown-user-name');
        const sWins = document.getElementById('stat-wins');
        const sTies = document.getElementById('stat-ties');
        
        if (nas) nas.classList.add('hidden');
        if (upm) upm.classList.remove('hidden'); // Ensure the profile menu is visible
        if (avt) avt.innerText = appState.userName.charAt(0).toUpperCase();
        if (dName) dName.innerText = appState.userName;
        if (sWins) sWins.innerText = (appState.userScores.X || 0) + (appState.userScores.O || 0);
        if (sTies) sTies.innerText = appState.userScores.ties || 0;
        if (ppt) ppt.innerText = appState.userName;

        // Update game engines with loaded scores
        if (typeof ClassicGameEngine !== 'undefined') ClassicGameEngine.setScores(appState.userScores);
        if (typeof UltimateGameEngine !== 'undefined') UltimateGameEngine.setScores(appState.userScores);

        // Sync Achievement Engine with current score state
        if (typeof AchievementsEngine !== 'undefined') {
            AchievementsEngine.syncStats(appState.userScores);
            AchievementsEngine.setBadges(achievements || []);
        }
    }

    function clearAuthenticatedIdentity() {
        appState.authenticated = false;
        appState.userName = "";
        appState.userScores = { X: 0, O: 0, ties: 0 };

        const nas = document.getElementById('navAuthSection');
        const upm = document.getElementById('userProfileMenu');
        if (nas) nas.classList.remove('hidden');
        if (upm) upm.classList.add('hidden');

        // Reset game engine scores
        if (typeof ClassicGameEngine !== 'undefined') ClassicGameEngine.clearScores();
        if (typeof UltimateGameEngine !== 'undefined') UltimateGameEngine.clearScores();
        if (typeof AchievementsEngine !== 'undefined') AchievementsEngine.reset();
    }

    // Function to save scores to the backend
    window.saveUserScores = async function(currentScores) {
        if (!appState.authenticated) return; // Only save if authenticated

        try {
            const res = await fetch('/api/update-scores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentScores)
            });
            const data = await res.json();
            if (!data.success) console.error("Failed to save scores:", data.message);
        } catch (e) {
            console.error("Error saving scores:", e);
        }
    };

    // Function to save achievements to the backend
    window.saveUserAchievements = async function(badges) {
        if (!appState.authenticated) return;
        try {
            await fetch('/api/update-achievements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ badges: badges })
            });
        } catch (e) {
            console.error("Error saving achievements:", e);
        }
    };

    // Function to clear user scores
    window.clearUserScores = async function() {
        if (!appState.authenticated) return;
        if (!confirm("Are you sure you want to clear all your lifetime scores? This action cannot be undone.")) return;

        try {
            const res = await fetch('/api/clear-scores', { method: 'POST' });
            if (!res.ok) throw new Error('Clear scores failed on server');
            window.showToast('Your scores have been reset.', 'info');
            clearAuthenticatedIdentity(); // This will also reset local scores and UI
            mapAuthenticatedIdentity(appState.userName, { X: 0, O: 0, ties: 0 }); // Re-map with cleared scores
        } catch (e) {
            console.error("Clear scores process error:", e);
            window.showToast('Failed to clear scores.', 'error');
        }
    }

    // Dynamic FAQ Accordion Component Toggle System
    window.toggleFAQ = function(element) {
        const panel = element.nextElementSibling;
        const icon = element.querySelector('.faq-icon i');
        const isExpanded = element.getAttribute('aria-expanded') === 'true';
        
        element.setAttribute('aria-expanded', !isExpanded);
        if (panel) {
            panel.classList.toggle('active');
            if (panel.classList.contains('active')) {
                panel.style.maxHeight = panel.scrollHeight + "px";
            } else {
                panel.style.maxHeight = null;
            }
        }
        if (icon) {
            icon.className = !isExpanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
        }
    };

    // ==========================================
    // 2. GLOBAL PLATFORM ROUTING STATES
    // ==========================================
    let currentActiveVariant = '3';
    let currentActiveMode = 'ai';
    let currentActiveDifficulty = 'hard';
    let isBlitzProtocolChecked = false;

    // ==========================================
    // 3. DOM INTERFACE COMPONENT REGISTRIES
    // ==========================================
    const ConfigElements = {
        setupTitle: document.getElementById('setup-title'), // Corrected ID from 'setup-title'
        modeAI: document.getElementById('mode-ai-btn'),
        modeLocal: document.getElementById('mode-local-btn'),
        difficultyWrapper: document.getElementById('difficulty-selection-wrapper'),
        difficultyButtons: document.querySelectorAll('.diff-btn'),
        blitzToggle: document.getElementById('blitz-toggle'),
        engageButton: document.getElementById('initialize-game-btn')
    };

    const ProfileElements = {
        usernameInput: document.getElementById('username-input'),
        saveProfileBtn: document.getElementById('save-profile-btn'),
        profileTag: document.getElementById('player-profile-tag'),
        clearScoresBtn: document.getElementById('clear-scores-btn') // New button
    };

    const GlobalControls = {
        viewBadgesBtn: document.getElementById('view-badges-btn'),
        closeModalBtn: document.getElementById('close-modal-btn'),
        abortMatchBtn: document.getElementById('abort-match-btn'),
        instantRestartBtn: document.getElementById('instant-restart-btn'),
        backToMenuBtn: document.querySelector('.back-to-menu-btn')
    };

    function transitToViewPanel(activeViewTarget) {
        if (!activeViewTarget) return;
        const panelIds = ['dashboard-view', 'setup-view', 'arena-view'];
        panelIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        activeViewTarget.classList.remove('hidden');
    }

    // ==========================================
    // 5. EVENT INTERFACES & HANDLERS (Safe Implementation)
    // ==========================================
    document.querySelectorAll('.start-setup-btn').forEach(button => {
        button.addEventListener('click', function () {
            currentActiveVariant = this.getAttribute('data-variant');
            
            if (ConfigElements.setupTitle) {
                if (currentActiveVariant === 'ultimate') {
                    ConfigElements.setupTitle.innerText = "Configure Ultimate 9×9 Match Parameters";
                } else {
                    ConfigElements.setupTitle.innerText = `Configure ${currentActiveVariant}×${currentActiveVariant} Match Parameters`;
                }
            }
            transitToViewPanel(document.getElementById('setup-view'));
        });
    });

    if (ProfileElements.saveProfileBtn) {
        ProfileElements.saveProfileBtn.addEventListener('click', function () {
            if (ProfileElements.usernameInput && ProfileElements.profileTag) {
                const value = ProfileElements.usernameInput.value.trim();
                if (value.length > 0) {
                    ProfileElements.profileTag.innerText = `Challenger: ${value}`;
                    // Sync profile name to backend if authenticated
                    if (appState.authenticated) {
                        fetch('/api/sync-profile', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ nickname: value })
                        });
                    }
                }
            }
        });
    }

    // Event listener for Clear Scores button
    if (ProfileElements.clearScoresBtn) {
        ProfileElements.clearScoresBtn.addEventListener('click', function() {
            window.clearUserScores();
        });
    }
    if (ConfigElements.modeAI) {
        ConfigElements.modeAI.addEventListener('click', function () {
            currentActiveMode = 'ai';
            ConfigElements.modeAI.classList.add('active');
            if (ConfigElements.modeLocal) ConfigElements.modeLocal.classList.remove('active');
            if (ConfigElements.difficultyWrapper) ConfigElements.difficultyWrapper.classList.remove('hidden');
        });
    }

    if (ConfigElements.modeLocal) {
        ConfigElements.modeLocal.addEventListener('click', function () {
            currentActiveMode = 'local';
            ConfigElements.modeLocal.classList.add('active');
            if (ConfigElements.modeAI) ConfigElements.modeAI.classList.remove('active');
            if (ConfigElements.difficultyWrapper) ConfigElements.difficultyWrapper.classList.add('hidden');
        });
    }

    ConfigElements.difficultyButtons.forEach(button => {
        button.addEventListener('click', function () {
            ConfigElements.difficultyButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            currentActiveDifficulty = this.getAttribute('data-diff');
        });
    });

    if (GlobalControls.backToMenuBtn) {
        GlobalControls.backToMenuBtn.addEventListener('click', function () {
            transitToViewPanel(document.getElementById('dashboard-view'));
        });
    }

    if (ConfigElements.engageButton) {
        ConfigElements.engageButton.addEventListener('click', function () {
            if (ConfigElements.blitzToggle) isBlitzProtocolChecked = ConfigElements.blitzToggle.checked;

            transitToViewPanel(document.getElementById('arena-view'));

            if (currentActiveVariant === 'ultimate') {
                if (typeof ClassicGameEngine !== 'undefined') ClassicGameEngine.abortMatch();
                if (typeof UltimateGameEngine !== 'undefined') { // Pass current user scores
                    UltimateGameEngine.startMatch(currentActiveMode, currentActiveDifficulty, isBlitzProtocolChecked, appState.userScores);
                }
            } else {
                if (typeof UltimateGameEngine !== 'undefined') UltimateGameEngine.abortMatch();
                if (typeof ClassicGameEngine !== 'undefined') { // Pass current user scores
                    ClassicGameEngine.startMatch(currentActiveVariant, currentActiveMode, currentActiveDifficulty, isBlitzProtocolChecked, appState.userScores);
                }
            }
        });
    }

    if (GlobalControls.instantRestartBtn) {
        GlobalControls.instantRestartBtn.addEventListener('click', function () {
            if (currentActiveVariant === 'ultimate') {
                if (typeof UltimateGameEngine !== 'undefined') UltimateGameEngine.restartMatch();
            } else {
                if (typeof ClassicGameEngine !== 'undefined') ClassicGameEngine.restartMatch();
            }
        });
    }

    if (GlobalControls.abortMatchBtn) {
        GlobalControls.abortMatchBtn.addEventListener('click', function () {
            if (typeof ClassicGameEngine !== 'undefined') ClassicGameEngine.abortMatch();
            if (typeof UltimateGameEngine !== 'undefined') UltimateGameEngine.abortMatch();
            transitToViewPanel(document.getElementById('dashboard-view'));
        });
    }

    if (GlobalControls.viewBadgesBtn) {
        GlobalControls.viewBadgesBtn.addEventListener('click', function () {
            if (typeof AchievementsEngine !== 'undefined' && typeof AchievementsEngine.render === 'function') {
                AchievementsEngine.render();
            }
            const m = document.getElementById('badges-modal');
            if (m) m.classList.remove('hidden');
        });
    }

    if (GlobalControls.closeModalBtn) {
        GlobalControls.closeModalBtn.addEventListener('click', function () {
            const m = document.getElementById('badges-modal');
            if (m) m.classList.add('hidden');
        });
    }

    const bm = document.getElementById('badges-modal');
    if (bm) {
        bm.addEventListener('click', function (event) {
            if (event.target === bm) {
                bm.classList.add('hidden');
            }
        });
    }

    window.addEventListener('keyup', function (event) {
        if (event.key === 'Escape') {
            const targetModal = document.getElementById('badges-modal');
            if (targetModal && !targetModal.classList.contains('hidden')) {
                targetModal.classList.add('hidden');
            }
        }
    });

    // Safe pre-initialization check for Achievements Engine
    if (typeof AchievementsEngine !== 'undefined' && typeof AchievementsEngine.render === 'function') {
        AchievementsEngine.render();
    } else {
        console.warn("AchievementsEngine definition missing or blocked. Check file naming matrices.");
    }

    // Dynamic Rule Search Matrix Filtering
    const helpSearchInput = document.getElementById('help-search-input') || document.getElementById('faqSearch');
    if (helpSearchInput) {
        helpSearchInput.addEventListener('input', function() {
            const query = this.value.toLowerCase().trim();
            const rulesManifest = document.querySelectorAll('#rules-sidebar-drawer .drawer-content p');
            
            rulesManifest.forEach(rule => {
                const ruleText = rule.textContent.toLowerCase();
                if (ruleText.includes(query)) {
                    rule.style.display = 'block';
                    rule.style.opacity = '1';
                } else {
                    rule.style.display = 'none';
                    rule.style.opacity = '0';
                }
            });
        });
    }

    // Initial check for authentication status and load scores
    checkIdentityStatus().then(() => {
        // After status is checked, if authenticated, scores will be loaded into appState.userScores
    });
});