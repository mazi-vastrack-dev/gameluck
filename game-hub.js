// ============================================================================
// GAME HUB CENTRAL MANAGER (game-hub.js)
// Centralized state, audio system, and dynamic header UI injection.
// ============================================================================

class GameHub {
    constructor() {
        this.statsKey = 'gameStats';
        this.muteKey = 'gameHubMute';
        this.themeKey = 'gameTheme';
        
        this.stats = this.loadStats();
        this.isMuted = localStorage.getItem(this.muteKey) === 'true';
        this.currentTheme = localStorage.getItem(this.themeKey) || 'dark';
        this.audioCtx = null;
        
        // Dynamic CSS injection for font
        this.injectGoogleFonts();
        
        // Wait for DOM to load to inject header and style adjustments
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        // Apply saved theme state
        this.applyTheme(this.currentTheme);

        // Only inject header if we are not in index.html or menu.html (if menu.html is bypassed)
        const path = window.location.pathname;
        const page = path.substring(path.lastIndexOf('/') + 1);
        
        // Push spacing for the header if we're in a game page
        if (page && page !== 'index.html' && page !== '') {
            document.body.style.paddingTop = '75px';
            this.injectHeader();
        }
    }

    applyTheme(theme) {
        if (theme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
        this.updateThemeBtn();
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        localStorage.setItem(this.themeKey, this.currentTheme);
        this.applyTheme(this.currentTheme);
    }

    injectGoogleFonts() {
        if (!document.getElementById('hub-fonts')) {
            const link = document.createElement('link');
            link.id = 'hub-fonts';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap';
            document.head.appendChild(link);
        }
        
        // Dynamic styles for the header and coin animation
        if (!document.getElementById('hub-global-styles')) {
            const styles = document.createElement('link');
            styles.id = 'hub-global-styles';
            styles.rel = 'stylesheet';
            styles.href = 'game-hub.css';
            document.head.appendChild(styles);
        }
    }

    loadStats() {
        const defaultStats = {
            username: '',
            userId: '',
            coins: 0,
            wins: 0,
            streaks: 0,
            bestStreak: 0,
            plays: {
                flappy: 0,
                archery: 0,
                turtle: 0,
                snake: 0,
                higherlower: 0,
                penalty: 0,
                treasure: 0
            },
            bestScores: {
                flappy: 0,
                snake: 0
            }
        };

        try {
            const saved = localStorage.getItem(this.statsKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Deep merge defaults to avoid issues with missing fields
                return {
                    ...defaultStats,
                    ...parsed,
                    plays: { ...defaultStats.plays, ...(parsed.plays || {}) },
                    bestScores: { ...defaultStats.bestScores, ...(parsed.bestScores || {}) }
                };
            }
        } catch (e) {
            console.error('Error loading stats from localStorage', e);
        }
        return defaultStats;
    }

    saveStats() {
        try {
            localStorage.setItem(this.statsKey, JSON.stringify(this.stats));
        } catch (e) {
            console.error('Error saving stats to localStorage', e);
        }
    }

    // --- COIN & WIN ACTIONS ---
    
    addCoins(amount) {
        if (amount <= 0) return;
        this.stats.coins += amount;
        this.saveStats();
        
        this.playCoinSound();
        this.triggerCoinAnimation(amount);
        this.updateHeaderUI();
        
        // Fire custom event for games that might want to listen
        window.dispatchEvent(new CustomEvent('coinsUpdated', { detail: { coins: this.stats.coins, added: amount } }));
    }

    recordGamePlayed(gameId) {
        if (this.stats.plays[gameId] !== undefined) {
            this.stats.plays[gameId]++;
            this.saveStats();
        }
    }

    recordWin(gameId, coinAmount = 0) {
        this.stats.wins++;
        this.stats.streaks++;
        if (this.stats.streaks > this.stats.bestStreak) {
            this.stats.bestStreak = this.stats.streaks;
        }
        this.saveStats();
        
        if (coinAmount > 0) {
            // Apply streak multiplier to coins if streak >= 3
            let multiplier = 1;
            if (this.stats.streaks >= 3) multiplier = 1.2;
            if (this.stats.streaks >= 5) multiplier = 1.5;
            if (this.stats.streaks >= 10) multiplier = 2.0;
            
            const finalCoins = Math.round(coinAmount * multiplier);
            this.addCoins(finalCoins);
        }
        
        this.updateHeaderUI();
    }

    recordLoss() {
        this.stats.streaks = 0;
        this.saveStats();
        this.updateHeaderUI();
    }

    recordBestScore(gameId, score) {
        if (this.stats.bestScores[gameId] !== undefined) {
            if (score > this.stats.bestScores[gameId]) {
                this.stats.bestScores[gameId] = score;
                this.saveStats();
                return true; // New record
            }
        }
        return false;
    }

    getDifficulty() {
        const params = new URLSearchParams(window.location.search);
        const difficulty = params.get('difficulty') || 'normal';
        return ['easy', 'normal', 'hard'].includes(difficulty) ? difficulty : 'normal';
    }

    // --- AUDIO SYSTEM ---

    initAudio() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    playTone(freq, duration, type = 'sine', gainStart = 0.15) {
        if (this.isMuted) return;
        try {
            this.initAudio();
            const osc = this.audioCtx.createOscillator();
            const gainNode = this.audioCtx.createGain();
            
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
            
            gainNode.gain.setValueAtTime(gainStart, this.audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
            
            osc.connect(gainNode);
            gainNode.connect(this.audioCtx.destination);
            
            osc.start();
            osc.stop(this.audioCtx.currentTime + duration);
        } catch (e) {
            console.warn('Web Audio playback failed', e);
        }
    }

    playClick() {
        this.playTone(600, 0.06, 'triangle', 0.1);
    }

    playCoinSound() {
        this.playTone(987.77, 0.08, 'sine', 0.15); // B5 note
        setTimeout(() => {
            this.playTone(1318.51, 0.25, 'sine', 0.15); // E6 note
        }, 80);
    }

    playWin() {
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            setTimeout(() => {
                this.playTone(freq, 0.15, 'sine', 0.12);
            }, idx * 100);
        });
    }

    playLose() {
        const notes = [392.00, 349.23, 311.13, 246.94]; // G4, F4, D#4, B3
        notes.forEach((freq, idx) => {
            setTimeout(() => {
                this.playTone(freq, 0.2, 'sawtooth', 0.12);
            }, idx * 130);
        });
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        localStorage.setItem(this.muteKey, this.isMuted);
        this.updateHeaderMuteBtn();
    }

    // --- UI INJECTION ---

    injectHeader() {
        const header = document.createElement('header');
        header.className = 'hub-header';
        header.innerHTML = `
            <a href="index.html" class="hub-logo" id="hubLobbyBtn">
                <span class="logo-icon">🎮</span>
                <span class="logo-text">ARCADE LOBBY</span>
            </a>
            <div class="hub-stats">
                <div class="hub-stat-item coin-item" id="hubCoinWrapper">
                    <span class="coin-icon">🪙</span>
                    <span class="hub-stat-value" id="hubCoins">${this.stats.coins}</span>
                    <div class="coin-float-container" id="hubCoinFloatContainer"></div>
                </div>
                <div class="hub-stat-item streak-item">
                    <span class="streak-icon">🔥</span>
                    <span class="hub-stat-value" id="hubStreak">${this.stats.streaks}</span>
                </div>
                <button class="hub-audio-toggle" id="hubThemeBtn" title="Toggle Theme" style="margin-right: -4px;">
                    <span class="audio-icon" id="hubThemeIcon">🌙</span>
                </button>
                <button class="hub-audio-toggle" id="hubAudioBtn" title="Toggle Sound">
                    <span class="audio-icon" id="hubAudioIcon">🔊</span>
                </button>
            </div>
        `;
        document.body.prepend(header);
        
        // Add listeners
        document.getElementById('hubAudioBtn').addEventListener('click', () => {
            this.initAudio();
            this.toggleMute();
        });

        document.getElementById('hubThemeBtn').addEventListener('click', () => {
            this.toggleTheme();
        });
        
        document.getElementById('hubLobbyBtn').addEventListener('click', () => {
            this.playClick();
        });
        
        this.updateHeaderMuteBtn();
        this.updateThemeBtn();
    }

    updateThemeBtn() {
        const iconEl = document.getElementById('hubThemeIcon');
        if (iconEl) {
            iconEl.textContent = this.currentTheme === 'light' ? '☀️' : '🌙';
        }
    }

    updateHeaderUI() {
        const coinsEl = document.getElementById('hubCoins');
        const streakEl = document.getElementById('hubStreak');
        
        if (coinsEl) coinsEl.textContent = this.stats.coins;
        if (streakEl) streakEl.textContent = this.stats.streaks;
    }

    updateHeaderMuteBtn() {
        const iconEl = document.getElementById('hubAudioIcon');
        const btnEl = document.getElementById('hubAudioBtn');
        if (!iconEl || !btnEl) return;
        
        if (this.isMuted) {
            iconEl.textContent = '🔇';
            btnEl.classList.add('muted');
        } else {
            iconEl.textContent = '🔊';
            btnEl.classList.remove('muted');
        }
    }

    triggerCoinAnimation(amount) {
        const container = document.getElementById('hubCoinFloatContainer');
        const coinWrapper = document.getElementById('hubCoinWrapper');
        if (!container || !coinWrapper) return;
        
        // Trigger bubble bounce on coin icon
        coinWrapper.classList.remove('payout');
        void coinWrapper.offsetWidth; // Trigger reflow
        coinWrapper.classList.add('payout');
        
        // Create floating text
        const floater = document.createElement('span');
        floater.className = 'coin-float-text';
        floater.textContent = `+${amount}`;
        container.appendChild(floater);
        
        // Clean up element after animation
        setTimeout(() => {
            floater.remove();
        }, 1200);
    }
}

// Instantiate global manager
window.gameHub = new GameHub();
