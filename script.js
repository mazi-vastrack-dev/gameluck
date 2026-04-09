// ==================== GAME STATE ====================
const DIRECTIONS = {
    TL: { name: 'Top Left', emoji: '↖️', x: 'left', y: 'top' },
    TC: { name: 'Top Center', emoji: '⬆️', x: 'center', y: 'top' },
    TR: { name: 'Top Right', emoji: '↗️', x: 'right', y: 'top' },
    ML: { name: 'Mid Left', emoji: '⬅️', x: 'left', y: 'mid' },
    MC: { name: 'Center', emoji: '⏺️', x: 'center', y: 'mid' },
    MR: { name: 'Mid Right', emoji: '➡️', x: 'right', y: 'mid' },
    BL: { name: 'Bottom Left', emoji: '↙️', x: 'left', y: 'bottom' },
    BC: { name: 'Bottom Center', emoji: '⬇️', x: 'center', y: 'bottom' },
    BR: { name: 'Bottom Right', emoji: '↘️', x: 'right', y: 'bottom' },
};

const DIFFICULTY_CONFIG = {
    easy: {
        winChance: 0.30,
        label: 'Easy (30% win chance)',
        biasStrength: 0.3,
    },
    normal: {
        winChance: 0.15,
        label: 'Normal (15% win chance)',
        biasStrength: 0.6,
    },
    hard: {
        winChance: 0.08,
        label: 'Hard (8% win chance)',
        biasStrength: 0.75,
    },
    impossible: {
        winChance: 0.03,
        label: 'Impossible (3% win chance)',
        biasStrength: 0.90,
    },
};

let gameState = {
    selectedDirection: null,
    chosenDirection: null,
    isPlaying: false,
    difficulty: 'normal',
    attempts: 0,
    wins: 0,
    animating: false,
};

// ==================== AUDIO SYSTEM ====================
class AudioSystem {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.volume = 0.2;
    }

    playTone(frequency, duration, type = 'sine') {
        try {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.type = type;
            osc.frequency.value = frequency;
            gain.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            osc.start(this.audioContext.currentTime);
            osc.stop(this.audioContext.currentTime + duration);
        } catch (e) {
            // Audio not available
        }
    }

    playWinSound() {
        this.playTone(400, 0.1);
        setTimeout(() => this.playTone(500, 0.1), 120);
        setTimeout(() => this.playTone(600, 0.2), 240);
    }

    playLoseSound() {
        this.playTone(400, 0.1);
        setTimeout(() => this.playTone(300, 0.1), 120);
        setTimeout(() => this.playTone(200, 0.2), 240);
    }

    playClickSound() {
        this.playTone(600, 0.05);
    }
}

const audioSystem = new AudioSystem();

// ==================== UTILITY FUNCTIONS ====================

function getRandomDirection(userDirection) {
    const config = DIFFICULTY_CONFIG[gameState.difficulty];
    const directionKeys = Object.keys(DIRECTIONS);
    const userWins = Math.random() < config.winChance;

    if (userWins) {
        return userDirection;
    }

    const otherDirections = directionKeys.filter(dir => dir !== userDirection);
    const weightedPool = [];
    const userDirObj = DIRECTIONS[userDirection];

    otherDirections.forEach(dir => {
        const dirObj = DIRECTIONS[dir];
        const xMatch = userDirObj.x === dirObj.x ? 1 : 0;
        const yMatch = userDirObj.y === dirObj.y ? 1 : 0;
        const proximity = xMatch + yMatch;

        let weight = proximity === 2 ? 0.5 : proximity === 1 ? 1.5 : 3;

        for (let i = 0; i < weight * config.biasStrength * 10; i++) {
            weightedPool.push(dir);
        }
    });

    return weightedPool.length > 0 ? weightedPool[Math.floor(Math.random() * weightedPool.length)] : otherDirections[Math.floor(Math.random() * otherDirections.length)];
}

function updateStats() {
    document.getElementById('attempts').textContent = gameState.attempts;
    document.getElementById('wins').textContent = gameState.wins;
    const winRate = gameState.attempts > 0 ? Math.round((gameState.wins / gameState.attempts) * 100) : 0;
    document.getElementById('winRate').textContent = winRate + '%';
}


// ==================== DIRECTION BUTTONS ====================
function createDirectionButtons() {
    const grid = document.getElementById('directionGrid');
    grid.innerHTML = '';

    Object.entries(DIRECTIONS).forEach(([key, dir]) => {
        const btn = document.createElement('button');
        btn.className = 'direction-btn';
        btn.dataset.direction = key;
        btn.innerHTML = `${dir.emoji}<div class="label">${dir.name.split(' ').join(' ')}</div>`;
        btn.addEventListener('click', () => selectDirection(key, btn));
        grid.appendChild(btn);
    });
}

function selectDirection(directionKey, buttonElement) {
    if (gameState.isPlaying || gameState.animating) return;

    // Deselect all buttons
    document.querySelectorAll('.direction-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    // Select this button
    buttonElement.classList.add('selected');
    gameState.selectedDirection = directionKey;

    // Show kick button
    document.getElementById('kickBtn').style.display = 'inline-block';
    audioSystem.playClickSound();
}

// ==================== GAME LOGIC ====================
async function kick() {
    if (!gameState.selectedDirection || gameState.isPlaying || gameState.animating) return;

    gameState.isPlaying = true;
    gameState.animating = true;
    gameState.attempts++;

    // Get the chosen direction based on difficulty and selection
    gameState.chosenDirection = getRandomDirection(gameState.selectedDirection);

    // Disable all buttons
    document.querySelectorAll('.direction-btn').forEach(btn => btn.disabled = true);
    document.getElementById('kickBtn').disabled = true;

    // Animate goalkeeper diving
    const gk = document.getElementById('goalkeeper');
    gk.classList.add('diving');

    // Animate ball
    const ball = document.getElementById('ball');
    ball.classList.add('animating');

    audioSystem.playClickSound();

    await new Promise(resolve => setTimeout(resolve, 800));

    // Evaluate the result
    const won = gameState.selectedDirection === gameState.chosenDirection;

    if (won) {
        audioSystem.playWinSound();
        gameState.wins++;
    } else {
        audioSystem.playLoseSound();
    }

    gameState.animating = false;
    updateStats();

    await new Promise(resolve => setTimeout(resolve, 500));
    showResult(won);
}

function showResult(won) {
    const resultContainer = document.getElementById('resultContainer');
    const resultIcon = document.getElementById('resultIcon');
    const resultText = document.getElementById('resultText');
    const resultDetails = document.getElementById('resultDetails');

    if (won) {
        resultIcon.textContent = '✅⚽🎉';
        resultText.textContent = 'GOAL! You predicted correctly!';
        resultDetails.textContent = `You chose ${DIRECTIONS[gameState.selectedDirection].name}`;
    } else {
        resultIcon.textContent = '❌';
        resultText.textContent = 'Miss! The goalkeeper saved it!';
        resultDetails.textContent = `You chose ${DIRECTIONS[gameState.selectedDirection].name}, but the ball went to ${DIRECTIONS[gameState.chosenDirection].name}`;
    }

    resultContainer.style.display = 'flex';
}

function resetGame() {
    gameState.selectedDirection = null;
    gameState.chosenDirection = null;
    gameState.isPlaying = false;
    gameState.animating = false;

    document.getElementById('resultContainer').style.display = 'none';
    document.getElementById('kickBtn').style.display = 'none';
    document.getElementById('kickBtn').disabled = false;
    document.querySelectorAll('.direction-btn').forEach(btn => btn.disabled = false);

    const gk = document.getElementById('goalkeeper');
    gk.classList.remove('diving');

    const ball = document.getElementById('ball');
    ball.classList.remove('animating');

    createDirectionButtons();
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', () => {
    createDirectionButtons();

    // Difficulty selector
    const difficultySelect = document.getElementById('difficultySelect');
    difficultySelect.addEventListener('change', (e) => {
        gameState.difficulty = e.target.value;
    });

    // Kick button
    document.getElementById('kickBtn').addEventListener('click', kick);

    // Try again button
    document.getElementById('tryAgainBtn').addEventListener('click', resetGame);

    // Cancel button
    document.getElementById('cancelBtn').addEventListener('click', () => {
        document.getElementById('resultContainer').style.display = 'none';
        resetGame();
    });

    updateStats();
    console.log('✅ Penalty Kick Game loaded!');
});
console.log("Script loaded!");
const GAME_CONFIG = { flappyBird: {name: "Flappy"} };
function createGameCards() {
  const g = document.getElementById("gamesGrid");
  if (g) {
    g.innerHTML = "<div>Test Card</div>";
    console.log("Card created!");
  }
}
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded - creating cards");
  createGameCards();
});// Simple arcade system test
const GAME_CONFIG = {
    flappyBird: { name: '🐦 Flappy Bird', icon: '🐦', type: 'skill', description: 'Fly!', rewards: { easy: 10, normal: 25, hard: 50 }, features: ['Fly'], difficulties: ['easy', 'normal', 'hard'] },
    archeryPrediction: { name: '🏹 Archery', icon: '🏹', type: 'prediction', description: 'Predict!', rewards: { easy: 15, normal: 30, hard: 60 }, features: ['Predict'], difficulties: ['easy', 'normal', 'hard'] },
    turtleRace: { name: '🐢 Turtle Race', icon: '🐢', type: 'prediction', description: 'Race!', rewards: { easy: 20, normal: 40, hard: 80 }, features: ['Race'], difficulties: ['easy', 'normal', 'hard'] },
    snakeGame: { name: '🐍 Snake', icon: '🐍', type: 'skill', description: 'Eat!', rewards: { easy: 5, normal: 15, hard: 30 }, features: ['Eat'], difficulties: ['easy', 'normal', 'hard'] },
    higherLower: { name: '🎱 Higher/Lower', icon: '🎱', type: 'prediction', description: 'Guess!', rewards: { easy: 12, normal: 25, hard: 50 }, features: ['Guess'], difficulties: ['easy', 'normal', 'hard'] },
    penaltyKick: { name: '⚽ Penalty', icon: '⚽', type: 'prediction', description: 'Kick!', rewards: { easy: 10, normal: 20, hard: 40 }, features: ['Kick'], difficulties: ['easy', 'normal', 'hard'] },
};

let globalState = { coins: 0, wins: 0, streak: 0, bestStreak: 0, currentGame: null, currentDifficulty: 'normal' };

const DIRECTIONS = { TL: { name: 'Top Left', emoji: '↖️' }, TC: { name: 'Top', emoji: '⬆️' }, TR: { name: 'Top Right', emoji: '↗️' }, ML: { name: 'Left', emoji: '⬅️' }, MC: { name: 'Center', emoji: '⏺️' }, MR: { name: 'Right', emoji: '➡️' }, BL: { name: 'Bottom Left', emoji: '↙️' }, BC: { name: 'Bottom', emoji: '⬇️' }, BR: { name: 'Bottom Right', emoji: '↘️' } };

const DIFFICULTY_CONFIG = { easy: { winChance: 0.30, label: '🟢 Easy', multiplier: 1 }, normal: { winChance: 0.15, label: '🟡 Normal', multiplier: 1.5 }, hard: { winChance: 0.08, label: '🔴 Hard', multiplier: 2.5 } };

class AudioSystem { constructor() { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.volume = 0.2; } playTone(f, d, t = 'sine') { try { const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = t; o.frequency.value = f; g.gain.setValueAtTime(this.volume, this.ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + d); o.connect(g); g.connect(this.ctx.destination); o.start(this.ctx.currentTime); o.stop(this.ctx.currentTime + d); } catch (e) {} } playWinSound() { this.playTone(400, 0.1); setTimeout(() => this.playTone(500, 0.1), 120); setTimeout(() => this.playTone(600, 0.2), 240); } playLoseSound() { this.playTone(400, 0.1); setTimeout(() => this.playTone(300, 0.1), 120); setTimeout(() => this.playTone(200, 0.2), 240); } playClickSound() { this.playTone(600, 0.05); } playCollectSound() { this.playTone(800, 0.08); setTimeout(() => this.playTone(1000, 0.08), 80); } }

const audioSystem = new AudioSystem();

function getRandomDirection(userDir) { const cfg = DIFFICULTY_CONFIG[globalState.currentDifficulty]; const dirs = Object.keys(DIRECTIONS); if (Math.random() < cfg.winChance) return userDir; return dirs[Math.floor(Math.random() * dirs.length)]; }

function addCoins(amt) { globalState.coins += Math.round(amt * DIFFICULTY_CONFIG[globalState.currentDifficulty].multiplier); updateGlobalStats(); }
function addWin() { globalState.wins++; globalState.streak++; if (globalState.streak > globalState.bestStreak) globalState.bestStreak = globalState.streak; updateGlobalStats(); }
function resetStreak() { globalState.streak = 0; updateGlobalStats(); }

function updateGlobalStats() { const c = document.getElementById('totalCoins'); const s = document.getElementById('currentStreak'); const w = document.getElementById('totalWins'); if (c) c.textContent = globalState.coins; if (s) s.textContent = globalState.streak; if (w) w.textContent = globalState.wins; }

function showMenu() { document.getElementById('mainMenu').classList.add('active'); document.getElementById('gameContainer').classList.add('hidden'); document.getElementById('gameShowcase').classList.add('hidden'); }

function showShowcase(gameId) { globalState.currentGame = gameId; const cfg = GAME_CONFIG[gameId]; document.getElementById('showcaseTitle').textContent = cfg.name; document.getElementById('showcaseDescription').textContent = cfg.description; const feat = document.getElementById('showcaseFeatures'); feat.innerHTML = cfg.features.map(f => `<li>✓ ${f}</li>`).join(''); const rew = document.getElementById('showcaseRewards'); rew.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;"><div>Easy: ${cfg.rewards.easy}</div><div>Normal: ${cfg.rewards.normal}</div><div>Hard: ${cfg.rewards.hard}</div></div>`; const diff = document.getElementById('showcaseDifficulty'); diff.innerHTML = cfg.difficulties.map(d => `<button class="difficulty-btn" onclick="selectDifficulty('${d}')">${DIFFICULTY_CONFIG[d].label}</button>`).join(''); document.getElementById('gameShowcase').classList.remove('hidden'); }

function selectDifficulty(diff) { globalState.currentDifficulty = diff; document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('selected')); if (event.target) event.target.classList.add('selected'); audioSystem.playClickSound(); }

function startGame() { document.getElementById('mainMenu').classList.remove('active'); document.getElementById('gameShowcase').classList.add('hidden'); document.getElementById('gameContainer').classList.remove('hidden'); document.getElementById('gameTitle').textContent = GAME_CONFIG[globalState.currentGame].name; }

function backToMenu() { showMenu(); }

function createGameCards() { const g = document.getElementById('gamesGrid'); if (!g) return; g.innerHTML = ''; Object.entries(GAME_CONFIG).forEach(([id, cfg]) => { const c = document.createElement('div'); c.style.cssText = `background:linear-gradient(135deg,${cfg.type === 'skill' ? '#FF6B6B,#E74C3C' : '#4ECDC4,#44A08D'});padding:20px;border-radius:12px;cursor:pointer;transition:all 0.3s;text-align:center;color:white;box-shadow:0 4px 15px rgba(0,0,0,0.2);`; c.innerHTML = `<div style="font-size:50px;margin-bottom:15px;">${cfg.icon}</div><div style="font-weight:bold;margin-bottom:10px;">${cfg.name}</div><div style="font-size:12px;opacity:0.9;">${cfg.type === 'skill' ? 'Skill' : 'Prediction'}</div>`; c.addEventListener('click', () => showShowcase(id)); g.appendChild(c); }); }

document.addEventListener('DOMContentLoaded', () => { createGameCards(); document.getElementById('closeShowcase')?.addEventListener('click', () => { document.getElementById('gameShowcase').classList.add('hidden'); showMenu(); }); document.getElementById('playGameBtn')?.addEventListener('click', startGame); document.getElementById('backToMenu')?.addEventListener('click', backToMenu); updateGlobalStats(); console.log('✅ Arcade loaded!'); });

window.showShowcase = showShowcase;
window.selectDifficulty = selectDifficulty;
window.startGame = startGame;
window.backToMenu = backToMenu;
// MULTI-GAME ARCADE SYSTEM
const GAME_CONFIG = {
    flappyBird: { name: '🐦 Flappy Bird', icon: '🐦', type: 'skill', description: 'Tap to fly!', rewards: { easy: 10, normal: 25, hard: 50 }, features: ['Obstacles', 'Score'], difficulties: ['easy', 'normal', 'hard'] },
    archeryPrediction: { name: '🏹 Archery', icon: '🏹', type: 'prediction', description: 'Predict zones!', rewards: { easy: 15, normal: 30, hard: 60 }, features: ['3 Zones', 'Levels'], difficulties: ['easy', 'normal', 'hard'] },
    turtleRace: { name: '🐢 Turtle Race', icon: '🐢', type: 'prediction', description: 'Pick winner!', rewards: { easy: 20, normal: 40, hard: 80 }, features: ['Racers', 'Hidden'], difficulties: ['easy', 'normal', 'hard'] },
    snakeGame: { name: '🐍 Snake', icon: '🐍', type: 'skill', description: 'Eat food!', rewards: { easy: 5, normal: 15, hard: 30 }, features: ['Grid', 'Score'], difficulties: ['easy', 'normal', 'hard'] },
    higherLower: { name: '🎱 Higher/Lower', icon: '🎱', type: 'prediction', description: 'Guess it!', rewards: { easy: 12, normal: 25, hard: 50 }, features: ['Numbers', 'Guess'], difficulties: ['easy', 'normal', 'hard'] },
    penaltyKick: { name: '⚽ Penalty', icon: '⚽', type: 'prediction', description: 'Predict zones!', rewards: { easy: 10, normal: 20, hard: 40 }, features: ['9 Zones', 'AI'], difficulties: ['easy', 'normal', 'hard'] },
};

let globalState = { coins: 0, wins: 0, streak: 0, bestStreak: 0, currentGame: null, currentDifficulty: 'normal' };

const DIRECTIONS = {
    TL: { name: 'Top Left', emoji: '↖️' }, TC: { name: 'Top', emoji: '⬆️' }, TR: { name: 'Top Right', emoji: '↗️' },
    ML: { name: 'Left', emoji: '⬅️' }, MC: { name: 'Center', emoji: '⏺️' }, MR: { name: 'Right', emoji: '➡️' },
    BL: { name: 'Bottom Left', emoji: '↙️' }, BC: { name: 'Bottom', emoji: '⬇️' }, BR: { name: 'Bottom Right', emoji: '↘️' }
};

const DIFFICULTY_CONFIG = {
    easy: { winChance: 0.30, label: '🟢 Easy', multiplier: 1 },
    normal: { winChance: 0.15, label: '🟡 Normal', multiplier: 1.5 },
    hard: { winChance: 0.08, label: '🔴 Hard', multiplier: 2.5 }
};

class AudioSystem {
    constructor() { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.volume = 0.2; }
    playTone(f, d, t = 'sine') {
        try {
            const o = this.ctx.createOscillator(), g = this.ctx.createGain();
            o.type = t; o.frequency.value = f;
            g.gain.setValueAtTime(this.volume, this.ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + d);
            o.connect(g); g.connect(this.ctx.destination);
            o.start(this.ctx.currentTime); o.stop(this.ctx.currentTime + d);
        } catch (e) {}
    }
    playWinSound() { this.playTone(400, 0.1); setTimeout(() => this.playTone(500, 0.1), 120); setTimeout(() => this.playTone(600, 0.2), 240); }
    playLoseSound() { this.playTone(400, 0.1); setTimeout(() => this.playTone(300, 0.1), 120); setTimeout(() => this.playTone(200, 0.2), 240); }
    playClickSound() { this.playTone(600, 0.05); }
    playCollectSound() { this.playTone(800, 0.08); setTimeout(() => this.playTone(1000, 0.08), 80); }
}

const audioSystem = new AudioSystem();

function getRandomDirection(userDir) {
    const cfg = DIFFICULTY_CONFIG[globalState.currentDifficulty];
    const dirs = Object.keys(DIRECTIONS);
    if (Math.random() < cfg.winChance) return userDir;
    return dirs[Math.floor(Math.random() * dirs.length)];
}

function addCoins(amt) { globalState.coins += Math.round(amt * DIFFICULTY_CONFIG[globalState.currentDifficulty].multiplier); updateGlobalStats(); }
function addWin() { globalState.wins++; globalState.streak++; if (globalState.streak > globalState.bestStreak) globalState.bestStreak = globalState.streak; updateGlobalStats(); }
function resetStreak() { globalState.streak = 0; updateGlobalStats(); }

function updateGlobalStats() {
    const c = document.getElementById('totalCoins');
    const s = document.getElementById('currentStreak');
    const w = document.getElementById('totalWins');
    if (c) c.textContent = globalState.coins;
    if (s) s.textContent = globalState.streak;
    if (w) w.textContent = globalState.wins;
}

function showMenu() {
    document.getElementById('mainMenu').classList.add('active');
    document.getElementById('gameContainer').classList.add('hidden');
    document.getElementById('gameShowcase').classList.add('hidden');
}

function showShowcase(gameId) {
    globalState.currentGame = gameId;
    const cfg = GAME_CONFIG[gameId];
    document.getElementById('showcaseTitle').textContent = cfg.name;
    document.getElementById('showcaseDescription').textContent = cfg.description;
    const feat = document.getElementById('showcaseFeatures');
    feat.innerHTML = cfg.features.map(f => `<li>✓ ${f}</li>`).join('');
    const rew = document.getElementById('showcaseRewards');
    rew.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;"><div>🟢 Easy: ${cfg.rewards.easy}</div><div>🟡 Normal: ${cfg.rewards.normal}</div><div>🔴 Hard: ${cfg.rewards.hard}</div></div>`;
    const diff = document.getElementById('showcaseDifficulty');
    diff.innerHTML = cfg.difficulties.map(d => `<button class="difficulty-btn" onclick="selectDiffficulty('${d}')">${DIFFICULTY_CONFIG[d].label}</button>`).join('');
    renderGamePreview(gameId);
    document.getElementById('gameShowcase').classList.remove('hidden');
}

function selectDiffficulty(diff) {
    globalState.currentDifficulty = diff;
    document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('selected'));
    if (event.target) event.target.classList.add('selected');
    audioSystem.playClickSound();
}

function startGame() {
    document.getElementById('mainMenu').classList.remove('active');
    document.getElementById('gameShowcase').classList.add('hidden');
    document.getElementById('gameContainer').classList.remove('hidden');
    document.getElementById('gameTitle').textContent = GAME_CONFIG[globalState.currentGame].name;
    const content = document.getElementById('gameContent');
    content.innerHTML = '';
    
    switch (globalState.currentGame) {
        case 'flappyBird': new FlappyBirdGame(content); break;
        case 'archeryPrediction': new ArcheryGame(content); break;
        case 'turtleRace': new TurtleRaceGame(content); break;
        case 'snakeGame': new SnakeGame(content); break;
        case 'higherLower': new HigherLowerGame(content); break;
        case 'penaltyKick': new PenaltyKickGame(content); break;
    }
}

function backToMenu() { showMenu(); document.getElementById('gameContent').innerHTML = ''; }

function renderGamePreview(gameId) {
    const p = document.getElementById('showcaseVideo');
    p.innerHTML = '';
    const cfg = { flappyBird: '<div style="text-align:center;padding:40px;background:#87CEEB;"><div style="font-size:60px;">🐦</div></div>', archeryPrediction: '<div style="text-align:center;padding:40px;background:#D4A373;color:white;"><div style="font-size:40px;">🎯</div></div>', turtleRace: '<div style="text-align:center;padding:40px;background:#90EE90;"><div style="font-size:50px;">🐢 🐢 🐢</div></div>', snakeGame: '<div style="text-align:center;padding:40px;background:#1a1a1a;color:#0f0;"><div style="font-size:30px;">🐍🟩🟩</div></div>', higherLower: '<div style="text-align:center;padding:40px;background:#4169E1;color:white;"><div style="font-size:40px;">8 + ? = ?</div></div>', penaltyKick: '<div style="text-align:center;padding:40px;background:#2d5016;color:white;"><div style="font-size:40px;">⚽</div></div>' };
    p.innerHTML = cfg[gameId] || '';
}

class FlappyBirdGame {
    constructor(c) { this.c = c; this.running = true; this.score = 0; this.y = 150; this.vel = 0; this.init(); }
    init() {
        this.c.innerHTML = `<div style="max-width:400px;margin:20px auto;"><div id="flappyGame" style="position:relative;width:400px;height:300px;background:#87CEEB;border:3px #333;overflow:hidden;"><div id="bird" style="position:absolute;width:30px;height:30px;left:50px;top:150px;font-size:30px;">🐦</div></div><div style="text-align:center;margin-top:20px;">Score: <span id="flappyScore">0</span></div></div>`;
        document.addEventListener('click', () => this.flap());
        this.loop();
    }
    flap() { if (!this.running) return; this.vel = -8; audioSystem.playClickSound(); }
    loop() {
        if (!this.running) return;
        this.vel += 0.5; this.y += this.vel;
        const b = document.getElementById('bird');
        if (b) b.style.top = this.y + 'px';
        if (this.y > 270 || this.y < 0) { this.end(); return; }
        document.getElementById('flappyScore').textContent = this.score;
        setTimeout(() => this.loop(), 20);
    }
    end() { this.running = false; audioSystem.playLoseSound(); addCoins(this.score); resetStreak(); setTimeout(() => { alert(`Game Over! Score: ${this.score}`); backToMenu(); }, 300); }
}

class ArcheryGame {
    constructor(c) { this.c = c; this.score = 0; this.round = 0; this.init(); }
    init() {
        this.c.innerHTML = `<div style="max-width:500px;margin:20px auto;"><h3 style="text-align:center;">🏹 Round ${this.round + 1}</h3><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:30px 0;"><div class="archery-zone" data-zone="left" style="background:#FFB6C1;padding:40px;border-radius:8px;cursor:pointer;text-align:center;font-size:30px;">⬅️</div><div class="archery-zone" data-zone="center" style="background:#87CEEB;padding:40px;border-radius:8px;cursor:pointer;text-align:center;font-size:30px;">🎯</div><div class="archery-zone" data-zone="right" style="background:#90EE90;padding:40px;border-radius:8px;cursor:pointer;text-align:center;font-size:30px;">➡️</div></div><div id="archeryResult" style="display:none;text-align:center;padding:20px;background:#f0f0f0;border-radius:8px;"><div id="archeryResultText" style="font-size:20px;font-weight:bold;margin-bottom:10px;"></div><button class="btn btn-primary" onclick="window.archeryGame.next()">Next</button></div><div style="text-align:center;margin-top:20px;">Score: <strong>${this.score}</strong></div></div>`;
        this.c.querySelectorAll('.archery-zone').forEach(z => z.addEventListener('click', (e) => { this.select(e.target.closest('.archery-zone').dataset.zone); }));
        window.archeryGame = this;
    }
    select(z) {
        const won = Math.random() < DIFFICULTY_CONFIG[globalState.currentDifficulty].winChance;
        const r = this.c.querySelector('#archeryResult');
        const rt = this.c.querySelector('#archeryResultText');
        if (won) { audioSystem.playWinSound(); rt.innerHTML = '✅ HIT!'; this.score += 30; addWin(); addCoins(30); } else { audioSystem.playLoseSound(); rt.innerHTML = '❌ MISSED!'; resetStreak(); }
        this.c.querySelectorAll('.archery-zone').forEach(z => z.style.pointerEvents = 'none');
        r.style.display = 'block';
        this.round++;
    }
    next() { this.init(); }
}

class TurtleRaceGame {
    constructor(c) { this.c = c; this.score = 0; this.init(); }
    init() {
        const t = [{ id: 0, name: 'Speedy', color: '#FF6B6B' }, { id: 1, name: 'Slider', color: '#4ECDC4' }, { id: 2, name: 'Turbo', color: '#45B7D1' }, { id: 3, name: 'Flash', color: '#96CEB4' }, { id: 4, name: 'Rocket', color: '#FFEAA7' }];
        this.t = t.map(x => ({...x, speed: Math.random() * 3 + 1, x: 0}));
        this.w = this.t[Math.floor(Math.random() * this.t.length)];
        this.c.innerHTML = `<div style="max-width:500px;margin:20px auto;"><h3 style="text-align:center;">🏁 Pick Winner!</h3><div style="background:#90EE90;padding:20px;border-radius:8px;margin-bottom:20px;">${this.t.map(x => `<div style="margin:15px 0;height:40px;background:white;position:relative;"><div style="position:absolute;left:10px;top:5px;">🐢 ${x.name}</div><div class="turtle-progress" data-id="${x.id}" style="height:100%;width:0%;background:${x.color};"></div></div>`).join('')}</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:10px;margin-bottom:20px;">${this.t.map(x => `<button class="turtle-btn" data-id="${x.id}" style="padding:15px;background:${x.color};border:none;border-radius:8px;cursor:pointer;color:white;font-weight:bold;">Pick ${x.name}</button>`).join('')}</div><div id="turtleResult" style="display:none;text-align:center;padding:20px;background:#f0f0f0;border-radius:8px;"><div id="turtleResultText"></div><button class="btn btn-primary" onclick="window.turtleGame.init()">Next</button></div></div>`;
        this.c.querySelectorAll('.turtle-btn').forEach(b => b.addEventListener('click', (e) => { this.selected = parseInt(e.target.dataset.id); }));
        window.turtleGame = this;
        setTimeout(() => this.race(), 500);
    }
    race() {
        let p = 0;
        const a = () => {
            this.t.forEach(x => {
                const w = x === this.w ? p : p * 0.6;
                const b = this.c.querySelector(`.turtle-progress[data-id="${x.id}"]`);
                if (b) b.style.width = w + '%';
            });
            p += 2;
            if (p < 100) setTimeout(a, 30);
            else this.end();
        };
        a();
    }
    end() {
        const won = this.selected === this.w.id;
        const r = this.c.querySelector('#turtleResult');
        const rt = this.c.querySelector('#turtleResultText');
        if (won) { audioSystem.playWinSound(); rt.innerHTML = '✅ Correct!'; this.score += 40; addWin(); addCoins(40); } else { audioSystem.playLoseSound(); rt.innerHTML = '❌ Wrong!'; resetStreak(); }
        r.style.display = 'block';
        this.c.querySelectorAll('.turtle-btn').forEach(b => b.disabled = true);
    }
}

class SnakeGame {
    constructor(c) { this.c = c; this.running = true; this.score = 0; this.s = [{x:5, y:5}]; this.f = {x:7, y:7}; this.d = {x:1, y:0}; this.nd = {x:1, y:0}; this.init(); }
    init() {
        this.c.innerHTML = `<div style="max-width:400px;margin:20px auto;"><h3 style="text-align:center;">🐍 Snake</h3><div id="snakeGame" style="display:grid;grid-template-columns:repeat(10,30px);gap:1px;background:#333;padding:10px;border-radius:8px;margin:20px auto;"></div><div style="text-align:center;">Score: <span id="snakeScore">0</span></div></div>`;
        document.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            if (k === 'arrowup' || k === 'w') { if (this.d.y === 0) this.nd = {x:0, y:-1}; }
            else if (k === 'arrowdown' || k === 's') { if (this.d.y === 0) this.nd = {x:0, y:1}; }
            else if (k === 'arrowleft' || k === 'a') { if (this.d.x === 0) this.nd = {x:-1, y:0}; }
            else if (k === 'arrowright' || k === 'd') { if (this.d.x === 0) this.nd = {x:1, y:0}; }
        });
        this.loop();
    }
    loop() {
        if (!this.running) return;
        this.d = this.nd;
        const h = {x: this.s[0].x + this.d.x, y: this.s[0].y + this.d.y};
        if (h.x < 0 || h.x >= 10 || h.y < 0 || h.y >= 10) { this.end(); return; }
        if (this.s.some(x => x.x === h.x && x.y === h.y)) { this.end(); return; }
        this.s.unshift(h);
        if (h.x === this.f.x && h.y === this.f.y) { audioSystem.playCollectSound(); this.score += 10; this.f = {x: Math.floor(Math.random() * 10), y: Math.floor(Math.random() * 10)}; } else this.s.pop();
        this.render();
        setTimeout(() => this.loop(), 100);
    }
    render() {
        const g = document.getElementById('snakeGame');
        g.innerHTML = '';
        for (let i = 0; i < 100; i++) {
            const x = i % 10, y = Math.floor(i / 10);
            const c = document.createElement('div');
            c.style.cssText = 'width:30px;height:30px;background:#111;border-radius:4px;';
            if (this.s.some(s => s.x === x && s.y === y)) { c.style.background = '#0f0'; c.textContent = this.s[0].x === x && this.s[0].y === y ? '😮' : '🟩'; c.style.fontSize = '16px'; c.style.display = 'flex'; c.style.alignItems = 'center'; c.style.justifyContent = 'center'; } else if (this.f.x === x && this.f.y === y) { c.style.background = '#f44'; c.textContent = '🍎'; c.style.fontSize = '16px'; c.style.display = 'flex'; c.style.alignItems = 'center'; c.style.justifyContent = 'center'; }
            g.appendChild(c);
        }
        document.getElementById('snakeScore').textContent = this.score;
    }
    end() { this.running = false; audioSystem.playLoseSound(); addCoins(this.score); resetStreak(); setTimeout(() => { alert(`Game Over! Score: ${this.score}`); backToMenu(); }, 300); }
}

class HigherLowerGame {
    constructor(c) { this.c = c; this.score = 0; this.init(); }
    init() {
        const n1 = Math.floor(Math.random() * 20) + 1, n2 = Math.floor(Math.random() * 20) + 1, h = Math.floor(Math.random() * 20) + 1, t = n1 + n2 + h;
        this.c.innerHTML = `<div style="max-width:500px;margin:20px auto;"><h3>🎱 Higher or Lower?</h3><div style="display:grid;grid-template-columns:1fr auto 1fr;gap:20px;margin:40px 0;"><div style="background:#FF6B6B;padding:40px;border-radius:8px;text-align:center;color:white;"><div style="font-size:14px;">Ball 1</div><div style="font-size:50px;font-weight:bold;">${n1}</div></div><div style="text-align:center;font-size:40px;font-weight:bold;">+</div><div style="background:#4ECDC4;padding:40px;border-radius:8px;text-align:center;color:white;"><div style="font-size:14px;">Ball 2</div><div style="font-size:50px;font-weight:bold;">${n2}</div></div></div><div style="background:#FFD93D;padding:30px;border-radius:8px;text-align:center;margin-bottom:30px;">Total = ${n1} + ${n2} + ? = ?</div><p style="text-align:center;margin-bottom:20px;">Will it be HIGHER or LOWER than ${t}?</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;"><button style="padding:15px;background:#4ECDC4;border:none;border-radius:8px;cursor:pointer;color:white;font-weight:bold;" onclick="window.hlGame.guess('higher', ${n1}, ${n2}, ${h}, ${t})">📈 HIGHER</button><button style="padding:15px;background:#FF6B6B;border:none;border-radius:8px;cursor:pointer;color:white;font-weight:bold;" onclick="window.hlGame.guess('lower', ${n1}, ${n2}, ${h}, ${t})">📉 LOWER</button></div><div id="hlResult" style="display:none;text-align:center;padding:20px;background:#f0f0f0;border-radius:8px;margin-top:20px;"><div id="hlResultText"></div><button style="margin-top:10px;padding:10px 20px;background:blue;border:none;color:white;border-radius:4px;cursor:pointer;" onclick="window.hlGame.init()">Next</button></div></div>`;
        window.hlGame = this;
    }
    guess(g, n1, n2, h, t) {
        const a = n1 + n2 + h, won = (g === 'higher' && a >= t) || (g === 'lower' && a <= t);
        const r = this.c.querySelector('#hlResult'), rt = this.c.querySelector('#hlResultText');
        if (won) { audioSystem.playWinSound(); rt.innerHTML = `✅ Correct! Sum was ${a}`; this.score += 25; addWin(); addCoins(25); } else { audioSystem.playLoseSound(); rt.innerHTML = `❌ Wrong! Sum was ${a}`; resetStreak(); }
        this.c.querySelectorAll('button').forEach(b => { if (!b.textContent.includes('Next')) b.disabled = true; });
        r.style.display = 'block';
    }
}

class PenaltyKickGame {
    constructor(c) { this.c = c; this.score = 0; this.selected = null; this.init(); }
    init() {
        this.c.innerHTML = `<div style="max-width:500px;margin:20px auto;"><h3 style="text-align:center;">⚽ Penalty Kick</h3><div id="directionGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:30px 0;max-width:300px;margin-left:auto;margin-right:auto;"></div><div style="text-align:center;margin:20px 0;"><button style="padding:15px 40px;background:blue;border:none;border-radius:8px;cursor:pointer;color:white;font-weight:bold;font-size:18px;" onclick="window.pkGame.kick()">🦵 KICK!</button></div><div id="pkResult" style="display:none;text-align:center;padding:20px;background:#f0f0f0;border-radius:8px;"><div id="pkResultText"></div><button style="margin-top:10px;padding:10px 20px;background:blue;border:none;color:white;border-radius:4px;cursor:pointer;" onclick="window.pkGame.init()">Again</button></div><div style="text-align:center;margin-top:20px;">Score: ${this.score}</div></div>`;
        const g = this.c.querySelector('#directionGrid');
        Object.entries(DIRECTIONS).forEach(([k, d]) => {
            const b = document.createElement('button');
            b.dataset.d = k;
            b.innerHTML = d.emoji;
            b.style.cssText = 'padding:15px;border:2px solid #ddd;border-radius:8px;background:white;cursor:pointer;font-size:24px;';
            b.addEventListener('click', () => this.selectD(k, b));
            g.appendChild(b);
        });
        window.pkGame = this;
    }
    selectD(d, b) {
        this.c.querySelectorAll('#directionGrid button').forEach(x => { x.style.background = 'white'; x.style.borderColor = '#ddd'; });
        b.style.background = '#ff6f00';
        b.style.borderColor = '#ff6f00';
        this.selected = d;
        audioSystem.playClickSound();
    }
    kick() {
        if (!this.selected) return;
        const c = getRandomDirection(this.selected);
        const won = this.selected === c;
        if (won) { audioSystem.playWinSound(); addWin(); addCoins(20); this.score += 20; } else { audioSystem.playLoseSound(); resetStreak(); }
        const r = this.c.querySelector('#pkResult');
        const rt = this.c.querySelector('#pkResultText');
        rt.innerHTML = won ? '⚽✅ GOAL!' : '❌ MISS!';
        r.style.display = 'block';
    }
}

function createGameCards() {
    const g = document.getElementById('gamesGrid');
    if (!g) return;
    g.innerHTML = '';
    Object.entries(GAME_CONFIG).forEach(([id, cfg]) => {
        const c = document.createElement('div');
        c.style.cssText = `background:linear-gradient(135deg,${cfg.type === 'skill' ? '#FF6B6B,#E74C3C' : '#4ECDC4,#44A08D'});padding:20px;border-radius:12px;cursor:pointer;transition:all 0.3s;text-align:center;color:white;box-shadow:0 4px 15px rgba(0,0,0,0.2);`;
        c.innerHTML = `<div style="font-size:50px;margin-bottom:15px;">${cfg.icon}</div><div style="font-weight:bold;margin-bottom:10px;">${cfg.name}</div><div style="font-size:12px;opacity:0.9;">${cfg.type === 'skill' ? '🎮 Skill' : '🎰 Prediction'}</div>`;
        c.addEventListener('click', () => showShowcase(id));
        g.appendChild(c);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    createGameCards();
    document.getElementById('closeShowcase')?.addEventListener('click', () => { document.getElementById('gameShowcase').classList.add('hidden'); showMenu(); });
    document.getElementById('playGameBtn')?.addEventListener('click', startGame);
    document.getElementById('backToMenu')?.addEventListener('click', backToMenu);
    updateGlobalStats();
    console.log('✅ Arcade loaded!');
});

window.showShowcase = showShowcase;
window.selectDiffficulty = selectDiffficulty;
window.startGame = startGame;
window.backToMenu = backToMenu;
// COMPREHENSIVE MULTI-GAME ARCADE SYSTEM

const GAME_CONFIG = {
    flappyBird: {
        name: '🐦 Flappy Bird',
        icon: '🐦',
        type: 'skill',
        description: 'Tap to keep the bird flying! Avoid obstacles.',
        rewards: { easy: 10, normal: 25, hard: 50 },
        features: [ 'Obstacle Avoidance', 'Continuous Gameplay', 'Combo Multiplier' ],
        difficulties: ['easy', 'normal', 'hard'],
    },
    archeryPrediction: {
        name: '🏹 Archery Prediction',
        icon: '🏹',
        type: 'prediction',
        description: 'Predict where the arrow will hit!',
        rewards: { easy: 15, normal: 30, hard: 60 },
        features: ['Zone Prediction', '3 Difficulty Levels', 'Streak Bonuses'],
        difficulties: ['easy', 'normal', 'hard'],
    },
    turtleRace: {
        name: '🐢 Turtle Race',
        icon: '🐢',
        type: 'prediction',
        description: 'Pick the winning turtle!',
        rewards: { easy: 20, normal: 40, hard: 80 },
        features: ['Multiple Racers', 'Hidden Variables', 'Visual Effects'],
        difficulties: ['easy', 'normal', 'hard'],
    },
    snakeGame: {
        name: '🐍 Snake Arcade',
        icon: '🐍',
        type: 'skill',
        description: 'Eat food to grow! Classic arcade action!',
        rewards: { easy: 5, normal: 15, hard: 30 },
        features: ['Progressive Difficulty', 'Collision Detection', 'Score Multiplier'],
        difficulties: ['easy', 'normal', 'hard'],
    },
    higherLower: {
        name: '🎱 Higher or Lower',
        icon: '🎱',
        type: 'prediction',
        description: 'Guess if the hidden number makes it higher or lower!',
        rewards: { easy: 12, normal: 25, hard: 50 },
        features: ['Quick Decision Making', 'Escalating Difficulty', 'Clear Feedback'],
        difficulties: ['easy', 'normal', 'hard'],
    },
    penaltyKick: {
        name: '⚽ Penalty Kick',
        icon: '⚽',
        type: 'prediction',
        description: 'Predict where the penalty kick will go!',
        rewards: { easy: 10, normal: 20, hard: 40 },
        features: ['9 Direction Zones', 'Advanced AI', 'Crowd Reactions'],
        difficulties: ['easy', 'normal', 'hard'],
    },
};

let globalState = {
    coins: 0,
    wins: 0,
    streak: 0,
    bestStreak: 0,
    gamesPlayed: {},
    currentGame: null,
    currentDifficulty: 'normal',
};

const DIRECTIONS = {
    TL: { name: 'Top Left', emoji: '↖️' },
    TC: { name: 'Top Center', emoji: '⬆️' },
    TR: { name: 'Top Right', emoji: '↗️' },
    ML: { name: 'Mid Left', emoji: '⬅️' },
    MC: { name: 'Center', emoji: '⏺️' },
    MR: { name: 'Mid Right', emoji: '➡️' },
    BL: { name: 'Bottom Left', emoji: '↙️' },
    BC: { name: 'Bottom Center', emoji: '⬇️' },
    BR: { name: 'Bottom Right', emoji: '↘️' },
};

const DIFFICULTY_CONFIG = {
    easy: { winChance: 0.30, label: '🟢 Easy (30%)', multiplier: 1 },
    normal: { winChance: 0.15, label: '🟡 Normal (15%)', multiplier: 1.5 },
    hard: { winChance: 0.08, label: '🔴 Hard (8%)', multiplier: 2.5 },
};

// AUDIO SYSTEM
class AudioSystem {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.volume = 0.2;
    }
    playTone(freq, dur, type = 'sine') {
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(this.ctx.currentTime);
            osc.stop(this.ctx.currentTime + dur);
        } catch (e) {}
    }
    playWinSound() {
        this.playTone(400, 0.1);
        setTimeout(() => this.playTone(500, 0.1), 120);
        setTimeout(() => this.playTone(600, 0.2), 240);
    }
    playLoseSound() {
        this.playTone(400, 0.1);
        setTimeout(() => this.playTone(300, 0.1), 120);
        setTimeout(() => this.playTone(200, 0.2), 240);
    }
    playClickSound() {
        this.playTone(600, 0.05);
    }
    playCollectSound() {
        this.playTone(800, 0.08);
        setTimeout(() => this.playTone(1000, 0.08), 80);
    }
}

const audioSystem = new AudioSystem();

// UTILITY FUNCTIONS
function getRandomDirection(userDirection) {
    const config = DIFFICULTY_CONFIG[globalState.currentDifficulty];
    const dirs = Object.keys(DIRECTIONS);
    if (Math.random() < config.winChance) return userDirection;
    return dirs[Math.floor(Math.random() * dirs.length)];
}

function addCoins(amount) {
    globalState.coins += Math.round(amount * DIFFICULTY_CONFIG[globalState.currentDifficulty].multiplier);
    updateGlobalStats();
}

function addWin() {
    globalState.wins++;
    globalState.streak++;
    if (globalState.streak > globalState.bestStreak) globalState.bestStreak = globalState.streak;
    updateGlobalStats();
}

function resetStreak() {
    globalState.streak = 0;
    updateGlobalStats();
}

function updateGlobalStats() {
    const coins = document.getElementById('totalCoins');
    const streak = document.getElementById('currentStreak');
    const wins = document.getElementById('totalWins');
    if (coins) coins.textContent = globalState.coins;
    if (streak) streak.textContent = globalState.streak;
    if (wins) wins.textContent = globalState.wins;
}

// NAVIGATION
function showMenu() {
    document.getElementById('mainMenu').classList.add('active');
    document.getElementById('gameContainer').classList.add('hidden');
    document.getElementById('gameShowcase').classList.add('hidden');
}

function showShowcase(gameId) {
    globalState.currentGame = gameId;
    const cfg = GAME_CONFIG[gameId];
    document.getElementById('showcaseTitle').textContent = cfg.name;
    document.getElementById('showcaseDescription').textContent = cfg.description;
    const feat = document.getElementById('showcaseFeatures');
    feat.innerHTML = cfg.features.map(f => `<li>✓ ${f}</li>`).join('');
    const rew = document.getElementById('showcaseRewards');
    rew.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;"><div>🟢 Easy: ${cfg.rewards.easy}💰</div><div>🟡 Normal: ${cfg.rewards.normal}💰</div><div>🔴 Hard: ${cfg.rewards.hard}💰</div></div>`;
    const diff = document.getElementById('showcaseDifficulty');
    diff.innerHTML = cfg.difficulties.map(d => `<button class="difficulty-btn" onclick="selectDifficulty('${d}')">${DIFFICULTY_CONFIG[d].label}</button>`).join('');
    renderGamePreview(gameId);
    document.getElementById('gameShowcase').classList.remove('hidden');
}

function selectDifficulty(difficulty) {
    globalState.currentDifficulty = difficulty;
    document.querySelectorAll('.difficulty-btn').forEach(btn => btn.classList.remove('selected'));
    event.target.classList.add('selected');
    audioSystem.playClickSound();
}

function startGame() {
    document.getElementById('mainMenu').classList.remove('active');
    document.getElementById('gameShowcase').classList.add('hidden');
    document.getElementById('gameContainer').classList.remove('hidden');
    document.getElementById('gameTitle').textContent = GAME_CONFIG[globalState.currentGame].name;
    const content = document.getElementById('gameContent');
    content.innerHTML = '';
    
    switch (globalState.currentGame) {
        case 'flappyBird': new FlappyBirdGame(content); break;
        case 'archeryPrediction': new ArcheryGame(content); break;
        case 'turtleRace': new TurtleRaceGame(content); break;
        case 'snakeGame': new SnakeGame(content); break;
        case 'higherLower': new HigherLowerGame(content); break;
        case 'penaltyKick': new PenaltyKickGame(content); break;
    }
    updateGlobalStats();
}

function backToMenu() {
    showMenu();
    document.getElementById('gameContent').innerHTML = '';
}

// GAME PREVIEW
function renderGamePreview(gameId) {
    const preview = document.getElementById('showcaseVideo');
    preview.innerHTML = '';
    switch (gameId) {
        case 'flappyBird':
            preview.innerHTML = `<div style="text-align:center;padding:40px;background:linear-gradient(to bottom,#87CEEB,#E0F6FF);border-radius:8px;"><div style="font-size:60px;animation:float 3s infinite;">🐦</div><div style="font-size:40px;margin:20px 0;">🏜️ ━━</div><p>Tap to fly up!</p></div>`;
            break;
        case 'archeryPrediction':
            preview.innerHTML = `<div style="text-align:center;padding:40px;background:linear-gradient(135deg,#D4A373,#8B4513);border-radius:8px;color:white;"><div style="font-size:80px;margin-bottom:20px;">🎯</div><div style="display:flex;justify-content:center;gap:20px;font-size:30px;"><div>⬅️</div><div>🏹➡️</div><div>➡️</div></div><p>Predict the zone!</p></div>`;
            break;
        case 'turtleRace':
            preview.innerHTML = `<div style="text-align:center;padding:40px;background:linear-gradient(to bottom,#90EE90,#00AA00);border-radius:8px;"><div style="font-size:50px;margin:20px 0;">🐢 🐢 🐢</div><div style="font-size:30px;animation:slide 2s infinite;">→ → →</div><p>Pick the winner!</p></div>`;
            break;
        case 'snakeGame':
            preview.innerHTML = `<div style="text-align:center;padding:40px;background:linear-gradient(135deg,#2a2a2a,#1a1a1a);border-radius:8px;color:#00ff00;"><div style="font-size:30px;font-family:monospace;">🐍🟩🟩🟩</div><div style="font-size:50px;margin:20px 0;">🍎</div><p>Eat & Grow!</p></div>`;
            break;
        case 'higherLower':
            preview.innerHTML = `<div style="text-align:center;padding:40px;background:linear-gradient(135deg,#4169E1,#1C1C7C);border-radius:8px;color:white;"><div style="font-size:40px;margin:20px 0;">8 + ? = ?</div><div style="font-size:50px;margin:20px 0;">📈 📉</div><p>Higher or Lower?</p></div>`;
            break;
        case 'penaltyKick':
            preview.innerHTML = `<div style="text-align:center;padding:40px;background:linear-gradient(to bottom,#2d5016,#1a1a1a);border-radius:8px;color:white;"><div style="font-size:40px;margin-bottom:20px;">⚽</div><div style="font-size:12px;font-family:monospace;display:inline-block;background:#333;padding:10px;border-radius:4px;">⬆️ ⬆️ ⬆️<br>← ⚽ →<br>⬇️ ⬇️ ⬇️</div><p>Pick a direction!</p></div>`;
            break;
    }
}

// GAME CLASSES
class FlappyBirdGame {
    constructor(container) {
        this.container = container;
        this.gameRunning = true;
        this.score = 0;
        this.birdY = 150;
        this.birdVel = 0;
        this.gravity = 0.5;
        this.obstacles = [];
        this.gameHeight = 300;
        this.init();
    }
    init() {
        this.container.innerHTML = `
            <div style="max-width:400px;margin:20px auto;">
                <div id="flappyGame" style="position:relative;width:400px;height:300px;background:linear-gradient(to bottom,#87CEEB,#E0F6FF);border:3px solid #333;margin:20px auto;overflow:hidden;">
                    <div id="bird" style="position:absolute;width:30px;height:30px;left:50px;top:150px;font-size:30px;">🐦</div>
                </div>
                <div style="text-align:center;margin-top:20px;">
                    <div style="font-size:24px;font-weight:bold;">Score: <span id="flappyScore">0</span></div>
                </div>
            </div>
        `;
        document.addEventListener('click', () => this.flap());
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') { e.preventDefault(); this.flap(); }
        });
        this.gameLoop();
    }
    flap() {
        if (!this.gameRunning) return;
        this.birdVel = -8;
        audioSystem.playClickSound();
    }
    gameLoop() {
        if (!this.gameRunning) return;
        this.birdVel += this.gravity;
        this.birdY += this.birdVel;
        const bird = document.getElementById('bird');
        if (bird) bird.style.top = this.birdY + 'px';
        if (this.birdY > this.gameHeight - 30 || this.birdY < 0) {
            this.endGame();
            return;
        }
        document.getElementById('flappyScore').textContent = this.score;
        setTimeout(() => this.gameLoop(), 20);
    }
    endGame() {
        this.gameRunning = false;
        audioSystem.playLoseSound();
        addCoins(this.score);
        resetStreak();
        setTimeout(() => {
            alert(`Game Over! Score: ${this.score}\nCoins: +${Math.round(this.score * DIFFICULTY_CONFIG[globalState.currentDifficulty].multiplier)}`);
            backToMenu();
        }, 300);
    }
}

class ArcheryGame {
    constructor(container) {
        this.container = container;
        this.score = 0;
        this.round = 0;
        this.init();
    }
    init() {
        this.container.innerHTML = `
            <div style="max-width:500px;margin:20px auto;">
                <h3 style="text-align:center;">🏹 Prediction Round ${this.round + 1}</h3>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:30px 0;">
                    <div class="archery-zone" data-zone="left" style="background:linear-gradient(135deg,#FFB6C1,#FF69B4);padding:40px;border-radius:8px;cursor:pointer;text-align:center;font-size:30px;user-select:none;">⬅️ LEFT</div>
                    <div class="archery-zone" data-zone="center" style="background:linear-gradient(135deg,#87CEEB,#4169E1);padding:40px;border-radius:8px;cursor:pointer;text-align:center;font-size:30px;user-select:none;">🎯 CENTER</div>
                    <div class="archery-zone" data-zone="right" style="background:linear-gradient(135deg,#90EE90,#228B22);padding:40px;border-radius:8px;cursor:pointer;text-align:center;font-size:30px;user-select:none;">RIGHT ➡️</div>
                </div>
                <div id="archeryResult" style="display:none;text-align:center;padding:20px;background:#f0f0f0;border-radius:8px;margin:20px 0;">
                    <div id="archeryResultText" style="font-size:20px;font-weight:bold;margin-bottom:10px;"></div>
                    <button class="btn btn-primary" onclick="document.querySelector('#archeryResult').parentElement.game.nextRound()">Next Round</button>
                </div>
                <div style="text-align:center;margin-top:20px;font-size:18px;">Score: <strong>${this.score}</strong></div>
            </div>
        `;
        this.container.querySelectorAll('.archery-zone').forEach(z => z.addEventListener('click', (e) => {
            this.selectZone(e.target.closest('.archery-zone').dataset.zone);
        }));
        this.container.parentElement.game = this;
    }
    selectZone(zone) {
        const won = Math.random() < DIFFICULTY_CONFIG[globalState.currentDifficulty].winChance;
        const resultDiv = this.container.querySelector('#archeryResult');
        const resultText = this.container.querySelector('#archeryResultText');
        if (won) {
            audioSystem.playWinSound();
            resultText.innerHTML = '✅ Direct Hit! 🎯';
            this.score += 30;
            addWin();
            addCoins(30);
        } else {
            audioSystem.playLoseSound();
            resultText.innerHTML = '❌ Missed! Try again.';
            resetStreak();
        }
        this.container.querySelectorAll('.archery-zone').forEach(z => z.style.pointerEvents = 'none');
        resultDiv.style.display = 'block';
        this.round++;
    }
    nextRound() {
        this.init();
    }
}

class TurtleRaceGame {
    constructor(container) {
        this.container = container;
        this.score = 0;
        this.init();
    }
    init() {
        const turtles = [ 
            { id: 0, name: 'Speedy', color: '#FF6B6B' },
            { id: 1, name: 'Slider', color: '#4ECDC4' },
            { id: 2, name: 'Turbo', color: '#45B7D1' },
            { id: 3, name: 'Flash', color: '#96CEB4' },
            { id: 4, name: 'Rocket', color: '#FFEAA7' },
        ];
        this.turtles = turtles.map(t => ({...t, speed: Math.random() * 3 + 1, x: 0}));
        this.winner = this.turtles[Math.floor(Math.random() * this.turtles.length)];
        
        this.container.innerHTML = `
            <div style="max-width:500px;margin:20px auto;">
                <h3 style="text-align:center;margin-bottom:20px;">🏁 Turtle Race - Pick the Winner!</h3>
                <div style="background:linear-gradient(to bottom,#87CEEB,#E0F6FF);padding:20px;border-radius:8px;margin-bottom:20px;">
                    ${this.turtles.map(t => `
                        <div style="margin:15px 0;height:40px;background:white;border-radius:4px;position:relative;overflow:hidden;">
                            <div style="position:absolute;left:10px;top:5px;z-index:10;font-weight:bold;">🐢 ${t.name}</div>
                            <div class="turtle-progress" data-id="${t.id}" style="height:100%;width:0%;background:${t.color};"></div>
                        </div>
                    `).join('')}
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:20px;">
                    ${this.turtles.map(t => `<button class="turtle-btn" data-id="${t.id}" style="padding:15px;background:${t.color};border:none;border-radius:8px;cursor:pointer;font-weight:bold;color:white;">Pick ${t.name}</button>`).join('')}
                </div>
                <div id="turtleResult" style="display:none;text-align:center;padding:20px;background:#f0f0f0;border-radius:8px;">
                    <div id="turtleResultText" style="font-size:20px;font-weight:bold;margin-bottom:10px;"></div>
                    <button class="btn btn-primary" onclick="document.querySelector('#turtleResult').parentElement.game.nextRound()">Next Race</button>
                </div>
                <div style="text-align:center;margin-top:20px;font-size:18px;">Score: <strong>${this.score}</strong></div>
            </div>
        `;
        this.container.querySelectorAll('.turtle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectTurtle(parseInt(e.target.dataset.id)));
        });
        this.container.parentElement.game = this;
        setTimeout(() => this.runRace(), 500);
    }
    runRace() {
        let prog = 0;
        const animate = () => {
            this.turtles.forEach(t => {
                const w = t === this.winner ? prog : prog * 0.6;
                const bar = this.container.querySelector(`.turtle-progress[data-id="${t.id}"]`);
                if (bar) bar.style.width = w + '%';
            });
            prog += 2;
            if (prog < 100) setTimeout(animate, 30);
            else this.finishRace();
        };
        animate();
    }
    selectTurtle(id) {
        this.selected = id;
    }
    finishRace() {
        const won = this.selected === this.winner.id;
        const resultDiv = this.container.querySelector('#turtleResult');
        const resultText = this.container.querySelector('#turtleResultText');
        if (won) {
            audioSystem.playWinSound();
            resultText.innerHTML = `✅ Correct! ${this.winner.name} won! 🏆`;
            this.score += 40;
            addWin();
            addCoins(40);
        } else {
            audioSystem.playLoseSound();
            resultText.innerHTML = `❌ Wrong! ${this.winner.name} won!`;
            resetStreak();
        }
        this.container.querySelectorAll('.turtle-btn').forEach(b => b.disabled = true);
        resultDiv.style.display = 'block';
    }
    nextRound() {
        this.init();
    }
}

class SnakeGame {
    constructor(container) {
        this.container = container;
        this.gameRunning = true;
        this.score = 0;
        this.snake = [{x:5, y:5}];
        this.food = {x:7, y:7};
        this.dir = {x:1, y:0};
        this.nextDir = {x:1, y:0};
        this.init();
    }
    init() {
        this.container.innerHTML = `
            <div style="max-width:400px;margin:20px auto;">
                <h3 style="text-align:center;">🐍 Snake Arcade</h3>
                <div id="snakeGame" style="display:grid;grid-template-columns:repeat(10,30px);gap:1px;background:#333;padding:10px;border-radius:8px;margin:20px auto 20px;"></div>
                <div style="text-align:center;">
                    <p style="font-size:20px;">Score: <strong id="snakeScore">0</strong></p>
                    <p style="font-size:14px;color:#666;">Arrow keys or WASD</p>
                </div>
            </div>
        `;
        document.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            if (k === 'arrowup' || k === 'w') { if (this.dir.y === 0) this.nextDir = {x:0, y:-1}; }
            else if (k === 'arrowdown' || k === 's') { if (this.dir.y === 0) this.nextDir = {x:0, y:1}; }
            else if (k === 'arrowleft' || k === 'a') { if (this.dir.x === 0) this.nextDir = {x:-1, y:0}; }
            else if (k === 'arrowright' || k === 'd') { if (this.dir.x === 0) this.nextDir = {x:1, y:0}; }
        });
        this.render();
        this.gameLoop();
    }
    gameLoop() {
        if (!this.gameRunning) return;
        this.dir = this.nextDir;
        const head = {x: this.snake[0].x + this.dir.x, y: this.snake[0].y + this.dir.y};
        if (head.x < 0 || head.x >= 10 || head.y < 0 || head.y >= 10) { this.endGame(); return; }
        if (this.snake.some(s => s.x === head.x && s.y === head.y)) { this.endGame(); return; }
        this.snake.unshift(head);
        if (head.x === this.food.x && head.y === this.food.y) {
            audioSystem.playCollectSound();
            this.score += 10;
            this.food = {x: Math.floor(Math.random() * 10), y: Math.floor(Math.random() * 10)};
        } else {
            this.snake.pop();
        }
        this.render();
        setTimeout(() => this.gameLoop(), 100 / DIFFICULTY_CONFIG[globalState.currentDifficulty].multiplier);
    }
    render() {
        const game = document.getElementById('snakeGame');
        game.innerHTML = '';
        for (let i = 0; i < 100; i++) {
            const x = i % 10, y = Math.floor(i / 10);
            const cell = document.createElement('div');
            cell.style.cssText = 'width:30px;height:30px;background:#111;border-radius:4px;';
            if (this.snake.some(s => s.x === x && s.y === y)) {
                cell.style.background = '#00ff00';
                cell.textContent = this.snake[0].x === x && this.snake[0].y === y ? '😮' : '🟩';
                cell.style.fontSize = '16px';
                cell.style.display = 'flex';
                cell.style.alignItems = 'center';
                cell.style.justifyContent = 'center';
            } else if (this.food.x === x && this.food.y === y) {
                cell.style.background = '#ff4444';
                cell.textContent = '🍎';
                cell.style.fontSize = '16px';
                cell.style.display = 'flex';
                cell.style.alignItems = 'center';
                cell.style.justifyContent = 'center';
            }
            game.appendChild(cell);
        }
        document.getElementById('snakeScore').textContent = this.score;
    }
    endGame() {
        this.gameRunning = false;
        audioSystem.playLoseSound();
        addCoins(this.score);
        resetStreak();
        setTimeout(() => {
            alert(`Game Over! Score: ${this.score}\nCoins: +${Math.round(this.score * DIFFICULTY_CONFIG[globalState.currentDifficulty].multiplier)}`);
            backToMenu();
        }, 300);
    }
}

class HigherLowerGame {
    constructor(container) {
        this.container = container;
        this.score = 0;
        this.init();
    }
    init() {
        const n1 = Math.floor(Math.random() * 20) + 1;
        const n2 = Math.floor(Math.random() * 20) + 1;
        const hidden = Math.floor(Math.random() * 20) + 1;
        const target = n1 + n2 + hidden;
        
        this.container.innerHTML = `
            <div style="max-width:500px;margin:20px auto;">
                <h3 style="text-align:center;">🎱 Higher or Lower?</h3>
                <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:20px;margin:40px 0;align-items:center;">
                    <div style="background:linear-gradient(135deg,#FF6B6B,#EE5A6F);padding:40px;border-radius:8px;text-align:center;color:white;"><div style="font-size:14px;margin-bottom:10px;">🎱 Ball 1</div><div style="font-size:50px;font-weight:bold;">${n1}</div></div>
                    <div style="text-align:center;font-size:40px;font-weight:bold;">+</div>
                    <div style="background:linear-gradient(135deg,#4ECDC4,#44A08D);padding:40px;border-radius:8px;text-align:center;color:white;"><div style="font-size:14px;margin-bottom:10px;">🎱 Ball 2</div><div style="font-size:50px;font-weight:bold;">${n2}</div></div>
                </div>
                <div style="background:linear-gradient(135deg,#FFD93D,#FFA500);padding:30px;border-radius:8px;text-align:center;margin-bottom:30px;border:3px dashed #333;color:white;"><div style="font-size:16px;margin-bottom:10px;">Total = ${n1} + ${n2} + ?</div><div style="font-size:40px;font-weight:bold;">= ?</div></div>
                <p style="text-align:center;margin-bottom:20px;font-size:16px;">Will the total be <strong>HIGHER</strong> or <strong>LOWER</strong> than ${target}?</p>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px;">
                    <button class="btn-play" onclick="window.hlGame.guess('higher', ${n1}, ${n2}, ${hidden}, ${target})" style="padding:15px;font-size:18px;background:#4ECDC4;border:none;border-radius:8px;cursor:pointer;color:white;font-weight:bold;">📈 HIGHER</button>
                    <button class="btn-play" onclick="window.hlGame.guess('lower', ${n1}, ${n2}, ${hidden}, ${target})" style="padding:15px;font-size:18px;background:#FF6B6B;border:none;border-radius:8px;cursor:pointer;color:white;font-weight:bold;">📉 LOWER</button>
                </div>
                <div id="hlResult" style="display:none;text-align:center;padding:20px;background:#f0f0f0;border-radius:8px;">
                    <div id="hlResultText" style="font-size:20px;font-weight:bold;margin-bottom:10px;"></div>
                    <button class="btn btn-primary" onclick="window.hlGame.next()">Next Round</button>
                </div>
                <div style="text-align:center;margin-top:20px;font-size:18px;">Score: <strong>${this.score}</strong></div>
            </div>
        `;
        window.hlGame = this;
    }
    guess(g, n1, n2, hidden, target) {
        const actual = n1 + n2 + hidden;
        const won = (g === 'higher' && actual >= target) || (g === 'lower' && actual <= target);
        const resultDiv = this.container.querySelector('#hlResult');
        const resultText = this.container.querySelector('#hlResultText');
        if (won) {
            audioSystem.playWinSound();
            resultText.innerHTML = `✅ Correct! Sum was ${actual}!`;
            this.score += 25;
            addWin();
            addCoins(25);
        } else {
            audioSystem.playLoseSound();
            resultText.innerHTML = `❌ Wrong! Sum was ${actual}`;
            resetStreak();
        }
        this.container.querySelectorAll('.btn-play').forEach(b => b.disabled = true);
        resultDiv.style.display = 'block';
    }
    next() {
        this.init();
    }
}

class PenaltyKickGame {
    constructor(container) {
        this.container = container;
        this.score = 0;
        this.selected = null;
        this.gameRunning = false;
        this.init();
    }
    init() {
        this.container.innerHTML = `
            <div style="max-width:500px;margin:20px auto;">
                <h3 style="text-align:center;">⚽ Penalty Kick Prediction</h3>
                <div id="directionGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:30px 0;max-width:300px;margin-left:auto;margin-right:auto;"></div>
                <div style="text-align:center;margin:20px 0;">
                    <button class="btn btn-primary" id="kickBtn" onclick="window.pkGame.kick()" style="font-size:18px;padding:15px 40px;">🦵 KICK!</button>
                </div>
                <div id="pkResult" style="display:none;text-align:center;padding:20px;background:#f0f0f0;border-radius:8px;">
                    <div id="pkResultText" style="font-size:20px;font-weight:bold;margin-bottom:10px;"></div>
                    <button class="btn btn-primary" onclick="window.pkGame.init()">Again</button>
                </div>
                <div style="text-align:center;margin-top:20px;font-size:18px;">Score: <strong>${this.score}</strong></div>
            </div>
        `;
        
        const grid = this.container.querySelector('#directionGrid');
        Object.entries(DIRECTIONS).forEach(([key, dir]) => {
            const btn = document.createElement('button');
            btn.dataset.direction = key;
            btn.innerHTML = `${dir.emoji}`;
            btn.style.cssText = 'padding:15px;border:2px solid #ddd;border-radius:8px;background:white;cursor:pointer;font-size:24px;transition:all 0.3s;';
            btn.addEventListener('click', () => this.selectDir(key, btn));
            grid.appendChild(btn);
        });
        
        window.pkGame = this;
    }
    selectDir(dir, btn) {
        this.container.querySelectorAll('#directionGrid button').forEach(b => {
            b.style.background = 'white';
            b.style.borderColor = '#ddd';
        });
        btn.style.background = '#ff6f00';
        btn.style.borderColor = '#ff6f00';
        this.selected = dir;
        audioSystem.playClickSound();
    }
    kick() {
        if (!this.selected) return;
        this.gameRunning = true;
        this.container.querySelector('#kickBtn').disabled = true;
        
        const chosen = getRandomDirection(this.selected);
        const won = this.selected === chosen;
        
        if (won) {
            audioSystem.playWinSound();
            addWin();
            addCoins(20);
            this.score += 20;
        } else {
            audioSystem.playLoseSound();
            resetStreak();
        }
        
        const resultDiv = this.container.querySelector('#pkResult');
        const resultText = this.container.querySelector('#pkResultText');
        resultText.innerHTML = won ? '⚽✅ GOAL!' : '❌ MISS!';
        resultDiv.style.display = 'block';
        this.gameRunning = false;
    }
}

// CREATE GAME CARDS
function createGameCards() {
    const grid = document.getElementById('gamesGrid');
    if (!grid) return;
    grid.innerHTML = '';
    Object.entries(GAME_CONFIG).forEach(([gameId, config]) => {
        const card = document.createElement('div');
        card.style.cssText = `background:linear-gradient(135deg,${config.type === 'skill' ? '#FF6B6B,#E74C3C' : '#4ECDC4,#44A08D'});padding:20px;border-radius:12px;cursor:pointer;transition:all 0.3s;text-align:center;color:white;box-shadow:0 4px 15px rgba(0,0,0,0.2);`;
        card.innerHTML = `
            <div style="font-size:50px;margin-bottom:15px;">${config.icon}</div>
            <div style="font-weight:bold;margin-bottom:10px;font-size:16px;">${config.name}</div>
            <div style="font-size:12px;opacity:0.9;">${config.type === 'skill' ? '🎮 Skill' : '🎰 Prediction'}</div>
        `;
        card.addEventListener('click', () => showShowcase(gameId));
        card.addEventListener('mouseover', () => {
            card.style.transform = 'translateY(-5px)';
            card.style.boxShadow = '0 8px 25px rgba(0,0,0,0.3)';
        });
        card.addEventListener('mouseout', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
        });
        grid.appendChild(card);
    });
}

// INITIALIZE
document.addEventListener('DOMContentLoaded', () => {
    createGameCards();
    document.getElementById('closeShowcase')?.addEventListener('click', () => {
        document.getElementById('gameShowcase').classList.add('hidden');
        showMenu();
    });
    document.getElementById('playGameBtn')?.addEventListener('click', startGame);
    document.getElementById('backToMenu')?.addEventListener('click', backToMenu);
    updateGlobalStats();
    console.log('✅ Arcade initialized!');
});

window.showShowcase = showShowcase;
window.selectDifficulty = selectDifficulty;
window.startGame = startGame;
window.backToMenu = backToMenu;
// ==================== COMPREHENSIVE MULTI-GAME ARCADE SYSTEM ====================

// ==================== GLOBAL GAME STATE ====================
const GAME_CONFIG = {
    flappyBird: {
        name: '🐦 Flappy Bird Arcade',
        emoji: '🐦',
        icon: '🐦',
        type: 'skill',
        description: 'Tap to keep the bird flying! Avoid obstacles and get the highest score.',
        rewards: { easy: 10, normal: 25, hard: 50 },
        features: ['Obstacle Avoidance', 'Continuous Gameplay', 'Combo Multiplier', 'Score Tracking'],
        difficulties: ['easy', 'normal', 'hard'],
    },
    archeryPrediction: {
        name: '🏹 Archery Prediction',
        emoji: '🏹',
        icon: '🏹',
        type: 'prediction',
        description: 'Predict where the arrow will hit! Choose Left, Center, or Right zone.',
        rewards: { easy: 15, normal: 30, hard: 60 },
        features: ['Zone Prediction', '3 Difficulty Levels', 'Streak Bonuses', 'Quick Rounds'],
        difficulties: ['easy', 'normal', 'hard'],
    },
    turtleRace: {
        name: '🐢 Turtle Race Prediction',
        emoji: '🐢',
        icon: '🐢',
        type: 'prediction',
        description: 'Pick the winning turtle! Each one has hidden speed attributes.',
        rewards: { easy: 20, normal: 40, hard: 80 },
        features: ['Multiple Racers', 'Hidden Variables', 'Visual Effects', 'Quick Gameplay'],
        difficulties: ['easy', 'normal', 'hard'],
    },
    snakeGame: {
        name: '🐍 Classic Snake Arcade',
        emoji: '🐍',
        icon: '🐍',
        type: 'skill',
        description: 'Eat food to grow! Avoid walls and yourself. Classic arcade action!',
        rewards: { easy: 5, normal: 15, hard: 30 },
        features: ['Progressive Difficulty', 'Collision Detection', 'Score Multiplier', 'History Tracking'],
        difficulties: ['easy', 'normal', 'hard'],
    },
    higherLower: {
        name: '🎱 Higher or Lower',
        emoji: '🎱',
        icon: '🎱',
        type: 'prediction',
        description: 'Guess if the hidden number will make the total higher or lower!',
        rewards: { easy: 12, normal: 25, hard: 50 },
        features: ['Quick Decision Making', 'Escalating Difficulty', 'Clear Feedback', 'Streak Tracking'],
        difficulties: ['easy', 'normal', 'hard'],
    },
    penaltyKick: {
        name: '⚽ Penalty Kick Prediction',
        emoji: '⚽',
        icon: '⚽',
        type: 'prediction',
        description: 'Predict where the penalty kick will go in a 3x3 grid of directions!',
        rewards: { easy: 10, normal: 20, hard: 40 },
        features: ['9 Direction Zones', 'Advanced AI', 'Crowd Reactions', 'Perfect for Beginners'],
        difficulties: ['easy', 'normal', 'hard'],
    },
};

let globalState = {
    coins: 0,
    wins: 0,
    streak: 0,
    bestStreak: 0,
    gamesPlayed: {},
    currentGame: null,
    currentDifficulty: 'normal',
};

const DIRECTIONS = {
    TL: { name: 'Top Left', emoji: '↖️', x: 'left', y: 'top' },
    TC: { name: 'Top Center', emoji: '⬆️', x: 'center', y: 'top' },
    TR: { name: 'Top Right', emoji: '↗️', x: 'right', y: 'top' },
    ML: { name: 'Mid Left', emoji: '⬅️', x: 'left', y: 'mid' },
    MC: { name: 'Center', emoji: '⏺️', x: 'center', y: 'mid' },
    MR: { name: 'Mid Right', emoji: '➡️', x: 'right', y: 'mid' },
    BL: { name: 'Bottom Left', emoji: '↙️', x: 'left', y: 'bottom' },
    BC: { name: 'Bottom Center', emoji: '⬇️', x: 'center', y: 'bottom' },
    BR: { name: 'Bottom Right', emoji: '↘️', x: 'right', y: 'bottom' },
};

const DIFFICULTY_CONFIG = {
    easy: {
        winChance: 0.30,
        label: '🟢 Easy (30% win)',
        biasStrength: 0.3,
        speed: 1,
        multiplier: 1,
    },
    normal: {
        winChance: 0.15,
        label: '🟡 Normal (15% win)',
        biasStrength: 0.6,
        speed: 1.5,
        multiplier: 1.5,
    },
    hard: {
        winChance: 0.08,
        label: '🔴 Hard (8% win)',
        biasStrength: 0.75,
        speed: 2,
        multiplier: 2.5,
    },
};

// ==================== AUDIO SYSTEM ====================
class AudioSystem {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.volume = 0.2;
    }

    playTone(frequency, duration, type = 'sine') {
        try {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.type = type;
            osc.frequency.value = frequency;
            gain.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            osc.start(this.audioContext.currentTime);
            osc.stop(this.audioContext.currentTime + duration);
        } catch (e) {}
    }

    playWinSound() {
        this.playTone(400, 0.1);
        setTimeout(() => this.playTone(500, 0.1), 120);
        setTimeout(() => this.playTone(600, 0.2), 240);
    }

    playLoseSound() {
        this.playTone(400, 0.1);
        setTimeout(() => this.playTone(300, 0.1), 120);
        setTimeout(() => this.playTone(200, 0.2), 240);
    }

    playClickSound() {
        this.playTone(600, 0.05);
    }

    playCollectSound() {
        this.playTone(800, 0.08);
        setTimeout(() => this.playTone(1000, 0.08), 80);
    }
}

const audioSystem = new AudioSystem();

// ==================== UTILITY FUNCTIONS ====================
function getRandomDirection(userDirection) {
    const config = DIFFICULTY_CONFIG[globalState.currentDifficulty];
    const directionKeys = Object.keys(DIRECTIONS);
    const userWins = Math.random() < config.winChance;

    if (userWins) {
        return userDirection;
    }

    const otherDirections = directionKeys.filter(dir => dir !== userDirection);
    const weightedPool = [];
    const userDirObj = DIRECTIONS[userDirection];

    otherDirections.forEach(dir => {
        const dirObj = DIRECTIONS[dir];
        const xMatch = userDirObj.x === dirObj.x ? 1 : 0;
        const yMatch = userDirObj.y === dirObj.y ? 1 : 0;
        const proximity = xMatch + yMatch;

        let weight = proximity === 2 ? 0.5 : proximity === 1 ? 1.5 : 3;

        for (let i = 0; i < weight * config.biasStrength * 10; i++) {
            weightedPool.push(dir);
        }
    });

    return weightedPool.length > 0 ? weightedPool[Math.floor(Math.random() * weightedPool.length)] : otherDirections[Math.floor(Math.random() * otherDirections.length)];
}

function addCoins(amount) {
    globalState.coins += Math.round(amount * DIFFICULTY_CONFIG[globalState.currentDifficulty].multiplier);
    updateGlobalStats();
}

function addWin() {
    globalState.wins++;
    globalState.streak++;
    if (globalState.streak > globalState.bestStreak) {
        globalState.bestStreak = globalState.streak;
    }
    updateGlobalStats();
}

function resetStreak() {
    globalState.streak = 0;
    updateGlobalStats();
}

function updateGlobalStats() {
    const coinsEl = document.getElementById('totalCoins');
    const streakEl = document.getElementById('currentStreak');
    const winsEl = document.getElementById('totalWins');
    const gameCoinsEl = document.getElementById('gameCoins');

    if (coinsEl) coinsEl.textContent = globalState.coins;
    if (streakEl) streakEl.textContent = globalState.streak;
    if (winsEl) winsEl.textContent = globalState.wins;
    if (gameCoinsEl) gameCoinsEl.textContent = `💰 ${globalState.coins}`;
}

// ==================== NAVIGATION SYSTEM ====================
function showMenu() {
    document.getElementById('mainMenu').classList.add('active');
    document.getElementById('gameContainer').classList.add('hidden');
    document.getElementById('gameShowcase').classList.add('hidden');
}

function hideMenu() {
    document.getElementById('mainMenu').classList.remove('active');
}

function showShowcase(gameId) {
    globalState.currentGame = gameId;
    const config = GAME_CONFIG[gameId];
    
    document.getElementById('showcaseTitle').textContent = config.name;
    document.getElementById('showcaseDescription').textContent = config.description;
    
    const featuresList = document.getElementById('showcaseFeatures');
    featuresList.innerHTML = config.features.map(f => `<li>✓ ${f}</li>`).join('');
    
    const rewards = document.getElementById('showcaseRewards');
    rewards.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; text-align: center;">
            <div>🟢 Easy: ${config.rewards.easy} 💰</div>
            <div>🟡 Normal: ${config.rewards.normal} 💰</div>
            <div>🔴 Hard: ${config.rewards.hard} 💰</div>
        </div>
    `;
    
    const difficulty = document.getElementById('showcaseDifficulty');
    difficulty.innerHTML = config.difficulties.map(d => `<button class="difficulty-btn" onclick="selectDifficulty('${d}')">${DIFFICULTY_CONFIG[d].label}</button>`).join('');
    
    renderGamePreview(gameId);
    
    document.getElementById('gameShowcase').classList.remove('hidden');
}

function selectDifficulty(difficulty) {
    globalState.currentDifficulty = difficulty;
    document.querySelectorAll('.difficulty-btn').forEach(btn => btn.classList.remove('selected'));
    event.target.classList.add('selected');
    audioSystem.playClickSound();
}

function startGame() {
    hideMenu();
    document.getElementById('gameShowcase').classList.add('hidden');
    document.getElementById('gameContainer').classList.remove('hidden');
    document.getElementById('gameTitle').textContent = GAME_CONFIG[globalState.currentGame].name;
    
    const gameContent = document.getElementById('gameContent');
    gameContent.innerHTML = '';
    
    switch (globalState.currentGame) {
        case 'flappyBird':
            new FlappyBirdGame(gameContent);
            break;
        case 'archeryPrediction':
            new ArcheryGame(gameContent);
            break;
        case 'turtleRace':
            new TurtleRaceGame(gameContent);
            break;
        case 'snakeGame':
            new SnakeGame(gameContent);
            break;
        case 'higherLower':
            new HigherLowerGame(gameContent);
            break;
        case 'penaltyKick':
            new PenaltyKickGame(gameContent);
            break;
    }
    
    updateGlobalStats();
}

function backToMenu() {
    showMenu();
    document.getElementById('gameContainer').innerHTML = '';
}

// ==================== GAME PREVIEWS ====================
function renderGamePreview(gameId) {
    const preview = document.getElementById('showcaseVideo');
    preview.innerHTML = '';
    
    switch (gameId) {
        case 'flappyBird':
            preview.innerHTML = `<div style="text-align: center; padding: 40px; background: linear-gradient(to bottom, #87CEEB, #E0F6FF); border-radius: 8px;"><div style="font-size: 60px; animation: float 3s ease-in-out infinite;">🐦</div><div style="font-size: 40px; margin: 20px 0;">🏜️ ━━━━</div><p>Tap to fly up!</p></div>`;
            break;
        case 'archeryPrediction':
            preview.innerHTML = `<div style="text-align: center; padding: 40px; background: linear-gradient(135deg, #D4A373, #8B4513); border-radius: 8px; color: white;"><div style="font-size: 80px; margin-bottom: 20px;">🎯</div><div style="display: flex; justify-content: center; gap: 20px; font-size: 30px;"><div>⬅️</div><div>🏹➡️</div><div>➡️</div></div><p>Predict the zone!</p></div>`;
            break;
        case 'turtleRace':
            preview.innerHTML = `<div style="text-align: center; padding: 40px; background: linear-gradient(to bottom, #90EE90, #00AA00); border-radius: 8px;"><div style="font-size: 50px; margin: 20px 0;">🐢 🐢 🐢</div><div style="font-size: 30px; animation: slide 2s ease-in-out infinite;">→ → →</div><p>Pick the winner!</p></div>`;
            break;
        case 'snakeGame':
            preview.innerHTML = `<div style="text-align: center; padding: 40px; background: linear-gradient(135deg, #2a2a2a, #1a1a1a); border-radius: 8px; color: #00ff00;"><div style="font-size: 30px; font-family: monospace;">🐍🟩🟩🟩</div><div style="font-size: 50px; margin: 20px 0;">🍎</div><p>Eat & Grow!</p></div>`;
            break;
        case 'higherLower':
            preview.innerHTML = `<div style="text-align: center; padding: 40px; background: linear-gradient(135deg, #4169E1, #1C1C7C); border-radius: 8px; color: white;"><div style="font-size: 40px; margin: 20px 0;">8 + ? = ?</div><div style="font-size: 50px; margin: 20px 0;">📈 📉</div><p>Higher or Lower?</p></div>`;
            break;
        case 'penaltyKick':
            preview.innerHTML = `<div style="text-align: center; padding: 40px; background: linear-gradient(to bottom, #2d5016, #1a1a1a); border-radius: 8px; color: white;"><div style="font-size: 40px; margin-bottom: 20px;">⚽</div><div style="font-size: 12px; font-family: monospace; display: inline-block; background: #333; padding: 10px; border-radius: 4px;">⬆️ ⬆️ ⬆️<br>← ⚽ →<br>⬇️ ⬇️ ⬇️</div><p>Pick a direction!</p></div>`;
            break;
    }
}

// ==================== GAME CLASSES ====================

// 1. FLAPPY BIRD GAME
class FlappyBirdGame {
    constructor(container) {
        this.container = container;
        this.gameRunning = true;
        this.score = 0;
        this.birdY = 150;
        this.birdVelocity = 0;
        this.gravity = 0.5;
        this.flapPower = 10;
        this.obstacleGap = 120;
        this.obstacles = [];
        this.obstacleScrollSpeed = 5 * DIFFICULTY_CONFIG[globalState.currentDifficulty].speed;
        this.gameWidth = 400;
        this.gameHeight = 300;
        this.nextObstacleX = this.gameWidth;
        this.obstacleFrequency = 1500 / DIFFICULTY_CONFIG[globalState.currentDifficulty].speed;
        
        this.init();
    }

    init() {
        this.container.innerHTML = `
            <div class="flappy-bird-container">
                <div id="flappyGame" style="position: relative; width: ${this.gameWidth}px; height: ${this.gameHeight}px; background: linear-gradient(to bottom, #87CEEB, #E0F6FF); border: 3px solid #333; margin: 20px auto; overflow: hidden;">
                    <div id="bird" style="position: absolute; width: 30px; height: 30px; left: 50px; top: ${this.birdY}px; font-size: 30px; line-height: 30px;">🐦</div>
                </div>
                <div style="text-align: center; margin-top: 20px;">
                    <div style="font-size: 24px; font-weight: bold;">Score: <span id="flappyScore">${this.score}</span></div>
                    <button class="btn btn-primary" onclick="document.querySelector('.flappy-bird-container').parentElement.game.restart()" style="margin-top: 10px;">Restart Game</button>
                </div>
            </div>
        `;

        const gameContainer = this.container.parentElement;
        gameContainer.game = this;

        document.addEventListener('click', () => this.flap());
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.flap();
            }
        });

        setTimeout(() => this.gameLoop(), 20);
    }

    flap() {
        if (!this.gameRunning) return;
        this.birdVelocity = -this.flapPower;
        audioSystem.playClickSound();
    }

    gameLoop() {
        if (!this.gameRunning) return;

        this.birdVelocity += this.gravity;
        this.birdY += this.birdVelocity;

        const bird = document.getElementById('bird');
        if (bird) bird.style.top = this.birdY + 'px';

        if (this.birdY > this.gameHeight - 30 || this.birdY < 0) {
            this.endGame(false);
            return;
        }

        if (this.nextObstacleX < 0) {
            this.addObstacle();
            this.nextObstacleX = this.gameWidth;
        }

        this.nextObstacleX -= this.obstacleScrollSpeed;

        this.obstacles.forEach((obs, idx) => {
            obs.x -= this.obstacleScrollSpeed;

            if (obs.x < -40 && !obs.counted) {
                obs.counted = true;
                this.score += 10;
                audioSystem.playCollectSound();
                const scoreEl = document.getElementById('flappyScore');
                if (scoreEl) scoreEl.textContent = this.score;
            }

            if (obs.x < -40) {
                this.obstacles.splice(idx, 1);
            }
        });

        if (this.checkCollision()) {
            this.endGame(false);
            return;
        }

        setTimeout(() => this.gameLoop(), 20);
    }

    addObstacle() {
        const topHeight = Math.random() * (this.gameHeight - this.obstacleGap - 80) + 20;
        this.obstacles.push({ x: this.nextObstacleX, topHeight: topHeight, counted: false });

        const game = document.getElementById('flappyGame');
        const topObs = document.createElement('div');
        topObs.style.cssText = `position: absolute; width: 40px; height: ${topHeight}px; left: ${this.nextObstacleX}px; top: 0; background: linear-gradient(to bottom, #228B22, #006400); border: 2px solid #003300;`;
        game.appendChild(topObs);

        const bottomHeight = this.gameHeight - topHeight - this.obstacleGap;
        const bottomObs = document.createElement('div');
        bottomObs.style.cssText = `position: absolute; width: 40px; height: ${bottomHeight}px; left: ${this.nextObstacleX}px; top: ${topHeight + this.obstacleGap}px; background: linear-gradient(to bottom, #228B22, #006400); border: 2px solid #003300;`;
        game.appendChild(bottomObs);
    }

    checkCollision() {
        for (let obs of this.obstacles) {
            if (this.birdY < obs.topHeight || this.birdY + 30 > obs.topHeight + this.obstacleGap) {
                if (this.birdX + 30 > obs.x && this.birdX < obs.x + 40) {
                    return true;
                }
            }
        }
        return false;
    }

    get birdX() {
        return 50;
    }

    endGame(won) {
        this.gameRunning = false;
        audioSystem.playLoseSound();
        
        const coinsEarned = this.score;
        addCoins(coinsEarned);
        resetStreak();

        setTimeout(() => {
            alert(`Game Over! Final Score: ${this.score}\nCoins Earned: ${Math.round(coinsEarned * DIFFICULTY_CONFIG[globalState.currentDifficulty].multiplier)}`);
            backToMenu();
        }, 500);
    }

    restart() {
        this.gameRunning = true;
        this.score = 0;
        this.birdY = 150;
        this.birdVelocity = 0;
        this.obstacles = [];
        this.nextObstacleX = this.gameWidth;

        const game = document.getElementById('flappyGame');
        const obstacles = game.querySelectorAll('[style*="background"]');
        obstacles.forEach((obs, idx) => {
            if (idx > 0) obs.remove();
        });

        const scoreEl = document.getElementById('flappyScore');
        if (scoreEl) scoreEl.textContent = this.score;
        this.gameLoop();
    }
}

// 2. ARCHERY PREDICTION GAME
class ArcheryGame {
    constructor(container) {
        this.container = container;
        this.currentRound = 0;
        this.score = 0;
        this.init();
    }

    init() {
        this.container.innerHTML = `
            <div style="max-width: 600px; margin: 20px auto;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h3 style="font-size: 24px; margin-bottom: 10px;">🏹 Archery Prediction Round ${this.currentRound + 1}</h3>
                    <p style="font-size: 16px; color: #666;">Predict where the arrow will land!</p>
                </div>

                <div id="archeryBoard" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin: 30px 0;">
                    <div class="archery-zone" data-zone="left" style="background: linear-gradient(135deg, #FFB6C1, #FF69B4); padding: 40px; border-radius: 8px; cursor: pointer; text-align: center; font-size: 30px;">⬅️ LEFT</div>
                    <div class="archery-zone" data-zone="center" style="background: linear-gradient(135deg, #87CEEB, #4169E1); padding: 40px; border-radius: 8px; cursor: pointer; text-align: center; font-size: 30px;">🎯 CENTER</div>
                    <div class="archery-zone" data-zone="right" style="background: linear-gradient(135deg, #90EE90, #228B22); padding: 40px; border-radius: 8px; cursor: pointer; text-align: center; font-size: 30px;">RIGHT ➡️</div>
                </div>

                <div id="archeryResult" style="display: none; text-align: center; padding: 30px; background: #f0f0f0; border-radius: 8px; margin: 20px 0;">
                    <div id="archeryResultText" style="font-size: 24px; font-weight: bold; margin-bottom: 15px;"></div>
                    <button class="btn btn-primary" onclick="document.querySelector('#archeryResult').parentElement.game.nextRound()" style="margin-right: 10px;">Next Round</button>
                    <button class="btn btn-secondary" onclick="backToMenu()">Quit</button>
                </div>

                <div style="text-align: center; margin-top: 20px; font-size: 18px;">
                    Score: <strong id="archeryScore">${this.score}</strong>
                </div>
            </div>
        `;

        const zones = this.container.querySelectorAll('.archery-zone');
        zones.forEach(zone => {
            zone.addEventListener('click', (e) => this.selectZone(e.target.closest('.archery-zone').dataset.zone));
        });

        this.container.parentElement.game = this;
    }

    selectZone(zone) {
        const result = this.evaluateArchery(zone);
        this.showArcheryResult(zone, result);
    }

    evaluateArchery(userZone) {
        const config = DIFFICULTY_CONFIG[globalState.currentDifficulty];
        const won = Math.random() < config.winChance;
        
        if (won) {
            return { won: true, zone: userZone };
        }

        const zones = ['left', 'center', 'right'];
        const otherZones = zones.filter(z => z !== userZone);
        return { won: false, zone: otherZones[Math.floor(Math.random() * otherZones.length)] };
    }

    showArcheryResult(userZone, result) {
        const resultDiv = this.container.querySelector('#archeryResult');
        const resultText = this.container.querySelector('#archeryResultText');

        if (result.won) {
            audioSystem.playWinSound();
            resultText.innerHTML = '✅ Direct Hit! 🎯';
            this.score += 30;
            addWin();
            addCoins(30);
        } else {
            audioSystem.playLoseSound();
            resultText.innerHTML = `❌ Missed! Arrow hit the ${result.zone} zone!`;
            resetStreak();
        }

        document.getElementById('archeryScore').textContent = this.score;
        this.container.querySelectorAll('.archery-zone').forEach(z => z.style.pointerEvents = 'none');
        resultDiv.style.display = 'block';
        this.currentRound++;
    }

    nextRound() {
        this.init();
    }
}

// 3. TURTLE RACE PREDICTION GAME
class TurtleRaceGame {
    constructor(container) {
        this.container = container;
        this.score = 0;
        this.round = 0;
        this.init();
    }

    init() {
        const turtles = [
            { id: 0, name: '🐢 Speedy', color: '#FF6B6B' },
            { id: 1, name: '🐢 Slider', color: '#4ECDC4' },
            { id: 2, name: '🐢 Turbo', color: '#45B7D1' },
            { id: 3, name: '🐢 Flash', color: '#96CEB4' },
            { id: 4, name: '🐢 Rocket', color: '#FFEAA7' },
        ];

        this.turtles = turtles.map(t => ({
            ...t,
            speed: Math.random() * 3 + 1,
            x: 0,
        }));

        this.container.innerHTML = `
            <div style="max-width: 600px; margin: 20px auto;">
                <h3 style="text-align: center; margin-bottom: 20px;">🏁 Turtle Race - Pick the Winner!</h3>
                <div style="background: linear-gradient(to bottom, #87CEEB, #E0F6FF); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    ${this.turtles.map(t => `
                        <div style="margin: 15px 0; height: 40px; background: white; border-radius: 4px; position: relative; overflow: hidden;">
                            <div style="position: absolute; left: 10px; top: 5px; z-index: 10; font-weight: bold;">${t.name}</div>
                            <div class="turtle-progress" data-turtle-id="${t.id}" style="height: 100%; width: 0%; background: ${t.color}; transition: width 0.05s linear; display: flex; align-items: center; justify-content: flex-end; padding-right: 10px; font-size: 20px;">🐢</div>
                        </div>
                    `).join('')}
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 20px;">
                    ${this.turtles.map(t => `
                        <button class="turtle-btn" data-turtle-id="${t.id}" style="padding: 15px; background: ${t.color}; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; color: white; font-size: 14px;">Pick ${t.name}</button>
                    `).join('')}
                </div>

                <div id="turtleResult" style="display: none; text-align: center; padding: 20px; background: #f0f0f0; border-radius: 8px;">
                    <div id="turtleResultText" style="font-size: 20px; font-weight: bold; margin-bottom: 10px;"></div>
                    <button class="btn btn-primary" onclick="document.querySelector('#turtleResult').parentElement.game.nextRound()" style="margin-right: 10px;">Next Race</button>
                    <button class="btn btn-secondary" onclick="backToMenu()">Quit</button>
                </div>

                <div style="text-align: center; margin-top: 20px; font-size: 18px;">
                    Score: <strong id="turtleScore">${this.score}</strong>
                </div>
            </div>
        `;

        const buttons = this.container.querySelectorAll('.turtle-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => this.selectTurtle(parseInt(e.target.dataset.turtleId)));
        });

        this.container.parentElement.game = this;
        setTimeout(() => this.runRace(), 500);
    }

    runRace() {
        const winner = this.getWinner();
        this.animateRace(winner);
    }

    getWinner() {
        return this.turtles[Math.floor(Math.random() * this.turtles.length)];
    }

    animateRace(winner) {
        let progress = 0;
        const maxWidth = 100;

        const animate = () => {
            this.turtles.forEach(t => {
                const targetProgress = (t === winner ? progress : progress * 0.8 * Math.random()) * (maxWidth / 100);
                const bar = this.container.querySelector(`.turtle-progress[data-turtle-id="${t.id}"]`);
                if (bar) {
                    bar.style.width = Math.min(targetProgress, maxWidth) + '%';
                }
            });

            progress += 2;
            if (progress < maxWidth) {
                setTimeout(animate, 30);
            } else {
                this.raceFinished(winner);
            }
        };

        animate();
    }

    selectTurtle(turtleId) {
        this.selectedTurtle = this.turtles[turtleId];
    }

    raceFinished(winner) {
        const won = this.selectedTurtle && this.selectedTurtle.id === winner.id;
        const resultDiv = this.container.querySelector('#turtleResult');
        const resultText = this.container.querySelector('#turtleResultText');

        if (won) {
            audioSystem.playWinSound();
            resultText.innerHTML = `✅ Correct! ${winner.name} won! 🏆`;
            this.score += 40;
            addWin();
            addCoins(40);
        } else {
            audioSystem.playLoseSound();
            resultText.innerHTML = `❌ Wrong! ${winner.name} was the winner!`;
            resetStreak();
        }

        document.getElementById('turtleScore').textContent = this.score;
        this.container.querySelectorAll('.turtle-btn').forEach(b => b.disabled = true);
        resultDiv.style.display = 'block';
        this.round++;
    }

    nextRound() {
        this.init();
    }
}

// 4. SNAKE GAME
class SnakeGame {
    constructor(container) {
        this.container = container;
        this.gameRunning = true;
        this.score = 0;
        this.snake = [{ x: 5, y: 5 }];
        this.food = { x: Math.floor(Math.random() * 10), y: Math.floor(Math.random() * 10) };
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        this.gridSize = 20;
        this.gameSpeed = 100 / DIFFICULTY_CONFIG[globalState.currentDifficulty].speed;
        this.init();
    }

    init() {
        this.container.innerHTML = `
            <div style="max-width: 400px; margin: 20px auto;">
                <h3 style="text-align: center; margin-bottom: 20px;">🐍 Classic Snake Arcade</h3>
                <div id="snakeGame" style="display: grid; grid-template-columns: repeat(10, 30px); gap: 1px; background: #333; padding: 10px; border-radius: 8px; margin-bottom: 20px;"></div>
                <div style="text-align: center; margin-bottom: 20px;">
                    <p style="font-size: 20px;"><strong>Score:</strong> <span id="snakeScore">${this.score}</span></p>
                    <p style="font-size: 14px; color: #666;">Use arrow keys or WASD to control</p>
                </div>
                <div style="text-align: center;">
                    <button class="btn btn-secondary" onclick="backToMenu()">Quit Game</button>
                </div>
            </div>
        `;

        document.addEventListener('keydown', (e) => this.handleInput(e));
        this.gameLoop();
    }

    handleInput(e) {
        const key = e.key.toLowerCase();
        if (key === 'arrowup' || key === 'w') {
            if (this.direction.y === 0) this.nextDirection = { x: 0, y: -1 };
        } else if (key === 'arrowdown' || key === 's') {
            if (this.direction.y === 0) this.nextDirection = { x: 0, y: 1 };
        } else if (key === 'arrowleft' || key === 'a') {
            if (this.direction.x === 0) this.nextDirection = { x: -1, y: 0 };
        } else if (key === 'arrowright' || key === 'd') {
            if (this.direction.x === 0) this.nextDirection = { x: 1, y: 0 };
        }
    }

    gameLoop() {
        if (!this.gameRunning) return;

        this.direction = this.nextDirection;
        const head = {
            x: this.snake[0].x + this.direction.x,
            y: this.snake[0].y + this.direction.y,
        };

        if (head.x < 0 || head.x >= 10 || head.y < 0 || head.y >= 10) {
            this.endGame();
            return;
        }

        if (this.snake.some(s => s.x === head.x && s.y === head.y)) {
            this.endGame();
            return;
        }

        this.snake.unshift(head);

        if (head.x === this.food.x && head.y === this.food.y) {
            audioSystem.playCollectSound();
            this.score += 10;
            this.food = { x: Math.floor(Math.random() * 10), y: Math.floor(Math.random() * 10) };
        } else {
            this.snake.pop();
        }

        this.render();
        setTimeout(() => this.gameLoop(), this.gameSpeed);
    }

    render() {
        const game = document.getElementById('snakeGame');
        game.innerHTML = '';

        for (let i = 0; i < 100; i++) {
            const x = i % 10;
            const y = Math.floor(i / 10);
            const cell = document.createElement('div');
            cell.style.cssText = 'width: 30px; height: 30px; background: #111; border-radius: 4px;';

            if (this.snake.some(s => s.x === x && s.y === y)) {
                cell.style.background = '#00ff00';
                cell.textContent = this.snake[0].x === x && this.snake[0].y === y ? '😮' : '🟩';
                cell.style.fontSize = '16px';
                cell.style.display = 'flex';
                cell.style.alignItems = 'center';
                cell.style.justifyContent = 'center';
            } else if (this.food.x === x && this.food.y === y) {
                cell.style.background = '#ff4444';
                cell.textContent = '🍎';
                cell.style.fontSize = '16px';
                cell.style.display = 'flex';
                cell.style.alignItems = 'center';
                cell.style.justifyContent = 'center';
            }

            game.appendChild(cell);
        }

        document.getElementById('snakeScore').textContent = this.score;
    }

    endGame() {
        this.gameRunning = false;
        audioSystem.playLoseSound();

        const coinsEarned = Math.floor(this.score * DIFFICULTY_CONFIG[globalState.currentDifficulty].multiplier);
        addCoins(coinsEarned);
        resetStreak();

        setTimeout(() => {
            alert(`Game Over! Final Score: ${this.score}\nCoins Earned: ${coinsEarned}`);
            backToMenu();
        }, 300);
    }
}

// 5. HIGHER OR LOWER GAME
class HigherLowerGame {
    constructor(container) {
        this.container = container;
        this.score = 0;
        this.round = 0;
        this.init();
    }

    init() {
        const num1 = Math.floor(Math.random() * 20) + 1;
        const num2 = Math.floor(Math.random() * 20) + 1;
        const hidden = Math.floor(Math.random() * 20) + 1;
        const target = num1 + num2 + hidden;

        this.container.innerHTML = `
            <div style="max-width: 600px; margin: 20px auto;">
                <h3 style="text-align: center; margin-bottom: 30px;">🎱 Higher or Lower?</h3>
                
                <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 20px; margin-bottom: 40px; align-items: center;">
                    <div style="background: linear-gradient(135deg, #FF6B6B, #EE5A6F); padding: 40px; border-radius: 8px; text-align: center; color: white; box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3);">
                        <div style="font-size: 14px; margin-bottom: 10px;">🎱 Ball 1</div>
                        <div style="font-size: 50px; font-weight: bold;">${num1}</div>
                    </div>
                    <div style="text-align: center; font-size: 40px; font-weight: bold;">+</div>
                    <div style="background: linear-gradient(135deg, #4ECDC4, #44A08D); padding: 40px; border-radius: 8px; text-align: center; color: white; box-shadow: 0 4px 15px rgba(78, 205, 196, 0.3);">
                        <div style="font-size: 14px; margin-bottom: 10px;">🎱 Ball 2</div>
                        <div style="font-size: 50px; font-weight: bold;">${num2}</div>
                    </div>
                </div>

                <div style="background: linear-gradient(135deg, #FFD93D, #FFA500); padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 30px; box-shadow: 0 4px 15px rgba(255, 157, 61, 0.3); border: 3px dashed #333;">
                    <div style="font-size: 14px; margin-bottom: 10px;">📦 Total = ${num1} + ${num2} + ?</div>
                    <div style="font-size: 36px; font-weight: bold;">= ?</div>
                </div>

                <p style="text-align: center; margin-bottom: 20px; font-size: 16px;">
                    Will the total be <strong>HIGHER or LOWER</strong> than <span style="background: #FFD93D; padding: 5px 10px; border-radius: 4px; font-size: 20px;">${target}</span>?
                </p>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <button class="btn btn-play" onclick="document.querySelector('#hlResult').parentElement.game.makeGuess('higher', ${num1}, ${num2}, ${hidden}, ${target})" style="font-size: 18px;">📈 HIGHER</button>
                    <button class="btn btn-play" onclick="document.querySelector('#hlResult').parentElement.game.makeGuess('lower', ${num1}, ${num2}, ${hidden}, ${target})" style="font-size: 18px;">📉 LOWER</button>
                </div>

                <div id="hlResult" style="display: none; text-align: center; padding: 20px; background: #f0f0f0; border-radius: 8px;">
                    <div id="hlResultText" style="font-size: 20px; font-weight: bold; margin-bottom: 15px;"></div>
                    <button class="btn btn-primary" onclick="document.querySelector('#hlResult').parentElement.game.nextRound()" style="margin-right: 10px;">Next Round</button>
                    <button class="btn btn-secondary" onclick="backToMenu()">Quit</button>
                </div>

                <div style="text-align: center; margin-top: 20px; font-size: 18px;">
                    Score: <strong id="hlScore">${this.score}</strong>
                </div>
            </div>
        `;

        this.container.parentElement.game = this;
        this.currentRound = { num1, num2, hidden, target };
    }

    makeGuess(guess, num1, num2, hidden, target) {
        const actual = num1 + num2 + hidden;
        const won = (guess === 'higher' && actual >= target) || (guess === 'lower' && actual <= target);

        const resultDiv = this.container.querySelector('#hlResult');
        const resultText = this.container.querySelector('#hlResultText');

        if (won) {
            audioSystem.playWinSound();
            resultText.innerHTML = `✅ Correct! The sum was ${actual}!<br>Target: ${target}`;
            this.score += 25;
            addWin();
            addCoins(25);
        } else {
            audioSystem.playLoseSound();
            resultText.innerHTML = `❌ Wrong! The sum was ${actual}, not ${guess}!<br>Target: ${target}`;
            resetStreak();
        }

        document.getElementById('hlScore').textContent = this.score;
        this.container.querySelectorAll('.btn-play').forEach(b => b.disabled = true);
        resultDiv.style.display = 'block';
        this.round++;
    }

    nextRound() {
        this.init();
    }
}

// 6. PENALTY KICK GAME
class PenaltyKickGame {
    constructor(container) {
        this.container = container;
        this.score = 0;
        this.attempts = 0;
        this.wins = 0;
        this.selectedDirection = null;
        this.chosenDirection = null;
        this.isPlaying = false;
        this.animating = false;
        this.init();
    }

    init() {
        this.container.innerHTML = `
            <div style="max-width: 700px; margin: 20px auto;">
                <h3 style="text-align: center; margin-bottom: 20px;">⚽ Penalty Kick Prediction</h3>
                <div style="text-align: center; margin-bottom: 20px;">
                    <small style="color: #666;">Attempts: ${this.attempts} | Wins: ${this.wins} | Score: ${this.score}</small>
                </div>
                <div id="penaltyGoal" style="background: linear-gradient(to bottom, #87CEEB, #2d5016); padding: 30px; border-radius: 8px; margin-bottom: 30px; min-height: 200px; position: relative;">
                    <div style="text-align: center; font-size: 80px; margin-bottom: 20px;">⚽</div>
                    <div style="text-align: center; color: #666; font-size: 14px;">Click a direction, then Kick!</div>
                </div>
                <div id="directionGrid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 30px; max-width: 300px; margin-left: auto; margin-right: auto;"></div>
                <div style="text-align: center; margin-bottom: 20px;">
                    <button class="btn btn-primary" id="kickBtn" style="display: none; font-size: 18px; padding: 15px 40px;">🦵 KICK!</button>
                </div>
                <div id="penaltyResult" style="display: none; text-align: center; padding: 20px; background: #f0f0f0; border-radius: 8px;">
                    <div id="penaltyResultText" style="font-size: 20px; font-weight: bold; margin-bottom: 15px;"></div>
                    <button class="btn btn-primary" onclick="document.querySelector('#penaltyResult').parentElement.game.playAgain()" style="margin-right: 10px;">Again</button>
                    <button class="btn btn-secondary" onclick="backToMenu()">Quit</button>
                </div>
            </div>
        `;

        this.createDirectionButtons();
        const kickBtn = this.container.querySelector('#kickBtn');
        kickBtn.addEventListener('click', () => this.kick());

        this.container.parentElement.game = this;
    }

    createDirectionButtons() {
        const grid = this.container.querySelector('#directionGrid');
        grid.innerHTML = '';

        Object.entries(DIRECTIONS).forEach(([key, dir]) => {
            const btn = document.createElement('button');
            btn.className = 'direction-btn';
            btn.dataset.direction = key;
            btn.innerHTML = `${dir.emoji}`;
            btn.style.cssText = 'padding: 15px; border: 2px solid #ddd; border-radius: 8px; background: white; cursor: pointer; font-size: 24px; transition: all 0.3s ease;';

            btn.addEventListener('click', () => this.selectDirection(key, btn));
            grid.appendChild(btn);
        });
    }

    selectDirection(directionKey, buttonElement) {
        if (this.isPlaying) return;

        this.container.querySelectorAll('.direction-btn').forEach(btn => {
            btn.style.background = 'white';
            btn.style.borderColor = '#ddd';
        });

        buttonElement.style.background = '#ff6f00';
        buttonElement.style.borderColor = '#ff6f00';
        buttonElement.style.color = 'white';

        this.selectedDirection = directionKey;
        this.container.querySelector('#kickBtn').style.display = 'inline-block';
        audioSystem.playClickSound();
    }

    async kick() {
        if (!this.selectedDirection || this.isPlaying || this.animating) return;

        this.isPlaying = true;
        this.animating = true;
        this.attempts++;

        this.chosenDirection = getRandomDirection(this.selectedDirection);

        await new Promise(resolve => setTimeout(resolve, 400));
        audioSystem.playClickSound();

        const won = this.selectedDirection === this.chosenDirection;

        if (won) {
            audioSystem.playWinSound();
            this.wins++;
            addWin();
            addCoins(20);
            this.score += 20;
        } else {
            audioSystem.playLoseSound();
            resetStreak();
        }

        this.animating = false;

        await new Promise(resolve => setTimeout(resolve, 600));
        this.showPenaltyResult(won);
    }

    showPenaltyResult(won) {
        const resultDiv = this.container.querySelector('#penaltyResult');
        const resultText = this.container.querySelector('#penaltyResultText');

        if (won) {
            resultText.innerHTML = `⚽✅ GOAL! You predicted correctly!`;
        } else {
            const selectedName = DIRECTIONS[this.selectedDirection].name;
            const chosenName = DIRECTIONS[this.chosenDirection].name;
            resultText.innerHTML = `❌ Miss! You guessed: ${selectedName}, but ball went to: ${chosenName}`;
        }

        this.container.querySelectorAll('.direction-btn').forEach(btn => btn.disabled = true);
        resultDiv.style.display = 'block';
        this.isPlaying = false;
    }

    playAgain() {
        this.selectedDirection = null;
        this.chosenDirection = null;
        this.isPlaying = false;
        this.init();
    }
}

// ==================== UI INITIALIZATION ====================
function createGameCards() {
    const grid = document.getElementById('gamesGrid');
    if (!grid) return;

    grid.innerHTML = '';

    Object.entries(GAME_CONFIG).forEach(([gameId, config]) => {
        const card = document.createElement('div');
        card.className = 'game-card';
        card.style.cssText = `background: linear-gradient(135deg, ${config.type === 'skill' ? '#FF6B6B, #E74C3C' : '#4ECDC4, #44A08D'}); padding: 20px; border-radius: 12px; cursor: pointer; transition: all 0.3s ease; text-align: center; color: white; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);`;

        card.innerHTML = `
            <div style="font-size: 50px; margin-bottom: 15px;">${config.icon}</div>
            <div style="font-weight: bold; margin-bottom: 10px; font-size: 16px;">${config.name}</div>
            <div style="font-size: 12px; opacity: 0.9; margin-bottom: 10px;">${config.type === 'skill' ? '🎮 Skill' : '🎰 Prediction'}</div>
            <div style="font-size: 11px; opacity: 0.8;">Tap to preview</div>
        `;

        card.addEventListener('click', () => showShowcase(gameId));
        card.addEventListener('mouseover', () => {
            card.style.transform = 'translateY(-5px)';
            card.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.3)';
        });
        card.addEventListener('mouseout', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
        });

        grid.appendChild(card);
    });
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', () => {
    createGameCards();

    const closeShowcase = document.getElementById('closeShowcase');
    if (closeShowcase) {
        closeShowcase.addEventListener('click', () => {
            document.getElementById('gameShowcase').classList.add('hidden');
            showMenu();
        });
    }

    const playGameBtn = document.getElementById('playGameBtn');
    if (playGameBtn) {
        playGameBtn.addEventListener('click', startGame);
    }

    const backBtn = document.getElementById('backToMenu');
    if (backBtn) {
        backBtn.addEventListener('click', backToMenu);
    }

    updateGlobalStats();
    console.log('✅ Arcade Game Hub initialized! Ready to play.');
});

// Make functions globally available
window.showShowcase = showShowcase;
window.selectDifficulty = selectDifficulty;
window.startGame = startGame;
window.backToMenu = backToMenu;
window.addCoins = addCoins;
window.addWin = addWin;
window.resetStreak = resetStreak;
// ==================== GLOBAL GAME STATE ====================
const GAME_CONFIG = {
    flappyBird: {
        name: '🐦 Flappy Bird Arcade',
        emoji: '🐦',
        icon: '🐦',
        type: 'skill',
        description: 'Tap to keep the bird flying! Avoid obstacles and get the highest score.',
        rewards: { easy: 10, normal: 25, hard: 50 },
        features: ['Obstacle Avoidance', 'Continuous Gameplay', 'Combo Multiplier', 'Score Tracking'],
        difficulties: ['easy', 'normal', 'hard'],
    },
    archeryPrediction: {
        name: '🏹 Archery Prediction',
        emoji: '🏹',
        icon: '🏹',
        type: 'prediction',
        description: 'Predict where the arrow will hit! Choose Left, Center, or Right zone.',
        rewards: { easy: 15, normal: 30, hard: 60 },
        features: ['Zone Prediction', '3 Difficulty Levels', 'Streak Bonuses', 'Quick Rounds'],
        difficulties: ['easy', 'normal', 'hard'],
    },
    turtleRace: {
        name: '🐢 Turtle Race Prediction',
        emoji: '🐢',
        icon: '🐢',
        type: 'prediction',
        description: 'Pick the winning turtle! Each one has hidden speed attributes.',
        rewards: { easy: 20, normal: 40, hard: 80 },
        features: ['Multiple Racers', 'Hidden Variables', 'Visual Effects', 'Quick Gameplay'],
        difficulties: ['easy', 'normal', 'hard'],
    },
    snakeGame: {
        name: '🐍 Classic Snake Arcade',
        emoji: '🐍',
        icon: '🐍',
        type: 'skill',
        description: 'Eat food to grow! Avoid walls and yourself. Classic arcade action!',
        rewards: { easy: 5, normal: 15, hard: 30 },
        features: ['Progressive Difficulty', 'Collision Detection', 'Score Multiplier', 'History Tracking'],
        difficulties: ['easy', 'normal', 'hard'],
    },
    higherLower: {
        name: '🎱 Higher or Lower',
        emoji: '🎱',
        icon: '🎱',
        type: 'prediction',
        description: 'Guess if the hidden number will make the total higher or lower!',
        rewards: { easy: 12, normal: 25, hard: 50 },
        features: ['Quick Decision Making', 'Escalating Difficulty', 'Clear Feedback', 'Streak Tracking'],
        difficulties: ['easy', 'normal', 'hard'],
    },
    penaltyKick: {
        name: '⚽ Penalty Kick Prediction',
        emoji: '⚽',
        icon: '⚽',
        type: 'prediction',
        description: 'Predict where the penalty kick will go in a 3x3 grid of directions!',
        rewards: { easy: 10, normal: 20, hard: 40 },
        features: ['9 Direction Zones', 'Advanced AI', 'Crowd Reactions', 'Perfect for Beginners'],
        difficulties: ['easy', 'normal', 'hard'],
    },
};

let globalState = {
    coins: 0,
    wins: 0,
    streak: 0,
    bestStreak: 0,
    gamesPlayed: {},
    currentGame: null,
    currentDifficulty: 'normal',
};

const DIRECTIONS = {
    TL: { name: 'Top Left', emoji: '↖️', x: 'left', y: 'top' },
    TC: { name: 'Top Center', emoji: '⬆️', x: 'center', y: 'top' },
    TR: { name: 'Top Right', emoji: '↗️', x: 'right', y: 'top' },
    ML: { name: 'Mid Left', emoji: '⬅️', x: 'left', y: 'mid' },
    MC: { name: 'Center', emoji: '⏺️', x: 'center', y: 'mid' },
    MR: { name: 'Mid Right', emoji: '➡️', x: 'right', y: 'mid' },
    BL: { name: 'Bottom Left', emoji: '↙️', x: 'left', y: 'bottom' },
    BC: { name: 'Bottom Center', emoji: '⬇️', x: 'center', y: 'bottom' },
    BR: { name: 'Bottom Right', emoji: '↘️', x: 'right', y: 'bottom' },
};

const DIFFICULTY_CONFIG = {
    easy: {
        winChance: 0.30,
        label: 'Easy (30% win chance)',
        biasStrength: 0.3,
        speed: 1,
    },
    normal: {
        winChance: 0.15,
        label: 'Normal (15% win chance)',
        biasStrength: 0.6,
        speed: 1.5,
    },
    hard: {
        winChance: 0.08,
        label: 'Hard (8% win chance)',
        biasStrength: 0.75,
        speed: 2,
    },
};

// ==================== AUDIO SYSTEM ====================
class AudioSystem {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.volume = 0.3;
    }

    playTone(frequency, duration, type = 'sine') {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = type;
        osc.frequency.value = frequency;

        gain.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        osc.start(this.audioContext.currentTime);
        osc.stop(this.audioContext.currentTime + duration);
    }

    playKickSound() {
        // Low frequency kick sound
        this.playTone(150, 0.1);
        setTimeout(() => this.playTone(100, 0.15), 50);
    }

    playWinSound() {
        // Ascending tones for win
        this.playTone(400, 0.1);
        setTimeout(() => this.playTone(500, 0.1), 120);
        setTimeout(() => this.playTone(600, 0.2), 240);
    }

    playLoseSound() {
        // Descending tones for loss
        this.playTone(400, 0.1);
        setTimeout(() => this.playTone(300, 0.1), 120);
        setTimeout(() => this.playTone(200, 0.2), 240);
    }

    playCrowdCheer() {
        // Quick burst of noise for cheering
        const bufferSize = this.audioContext.sampleRate * 0.5;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const source = this.audioContext.createBufferSource();
        const gain = this.audioContext.createGain();

        source.buffer = buffer;
        gain.gain.setValueAtTime(this.volume * 0.3, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

        source.connect(gain);
        gain.connect(this.audioContext.destination);
        source.start(this.audioContext.currentTime);
    }

    playCrowdBoo() {
        // Lower frequency burst of noise with descending tone for booing
        const bufferSize = this.audioContext.sampleRate * 0.6;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const source = this.audioContext.createBufferSource();
        const gain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();

        filter.type = 'lowpass';
        filter.frequency.value = 200;

        source.buffer = buffer;
        gain.gain.setValueAtTime(this.volume * 0.25, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.6);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.audioContext.destination);
        source.start(this.audioContext.currentTime);

        // Add a low descending tone
        this.playTone(120, 0.3);
    }
}

const audioSystem = new AudioSystem();

// ==================== PROBABILITY SYSTEM ====================
/**
 * Non-uniform random selection with difficulty-based bias
 * Strongly pushes outcomes away from user selection
 */
function getRandomDirection(userDirection) {
    const config = DIFFICULTY_CONFIG[gameState.difficulty];
    const directionKeys = Object.keys(DIRECTIONS);

    // Check if user wins this round (based on win chance)
    const userWins = Math.random() < config.winChance;

    if (userWins) {
        return userDirection;
    }

    // User loses - pick a different direction with weighted bias
    const otherDirections = directionKeys.filter(dir => dir !== userDirection);
    
    // Create weighted pool that strongly biases AGAINST nearby directions
    const weightedPool = [];
    const userDirObj = DIRECTIONS[userDirection];

    otherDirections.forEach(dir => {
        const dirObj = DIRECTIONS[dir];
        
        // Calculate how close this direction is to user's selection
        const xMatch = userDirObj.x === dirObj.x ? 1 : 0;
        const yMatch = userDirObj.y === dirObj.y ? 1 : 0;
        const proximity = xMatch + yMatch; // 0-2 score
        
        // Lower weight = less likely to be chosen (bias away from user)
        let weight;
        if (proximity === 2) {
            weight = 0.5; // Direct match on axis - 50% weight
        } else if (proximity === 1) {
            weight = 1.5; // Partial match - 150% weight
        } else {
            weight = 3; // Opposite direction - 300% weight (most likely)
        }

        // Add to weighted pool
        for (let i = 0; i < weight * config.biasStrength * 10; i++) {
            weightedPool.push(dir);
        }
    });

    if (weightedPool.length === 0) {
        return otherDirections[Math.floor(Math.random() * otherDirections.length)];
    }

    return weightedPool[Math.floor(Math.random() * weightedPool.length)];
}

// ==================== UI GENERATION ====================
function createDirectionGrid() {
    const grid = document.getElementById('directionGrid');
    grid.innerHTML = '';

    Object.entries(DIRECTIONS).forEach(([key, dir]) => {
        const btn = document.createElement('button');
        btn.className = 'direction-btn';
        btn.dataset.direction = key;
        btn.disabled = false;
        btn.innerHTML = `${dir.emoji}<span class="label">${dir.name}</span>`;

        btn.addEventListener('click', () => selectDirection(key, btn));
        grid.appendChild(btn);
    });
}

function selectDirection(directionKey, buttonElement) {
    // Check if already playing
    if (gameState.isPlaying) return;

    // Remove previous selection
    document.querySelectorAll('.direction-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    // Add new selection
    buttonElement.classList.add('selected');
    gameState.selectedDirection = directionKey;

    // Show kick button
    document.getElementById('kickBtn').style.display = 'inline-block';
}

function updateStats() {
    document.getElementById('attempts').textContent = gameState.attempts;
    document.getElementById('wins').textContent = gameState.wins;

    const winRate = gameState.attempts === 0 
        ? 0 
        : Math.round((gameState.wins / gameState.attempts) * 100);
    document.getElementById('winRate').textContent = `${winRate}%`;
}

// ==================== ANIMATOR ====================
class Animator {
    static async animateBallToDirection(directionKey) {
        const ball = document.getElementById('ball');
        const goal = document.querySelector('.goal-container');
        const direction = DIRECTIONS[directionKey];

        // Calculate final position
        let endX = 0;
        let endY = 0;

        // X position (horizontal)
        if (direction.x === 'left') endX = -120;
        else if (direction.x === 'right') endX = 120;
        // center remains 0

        // Y position (vertical)
        if (direction.y === 'top') endY = -150;
        else if (direction.y === 'bottom') endY = 50;
        // mid remains 0

        // Add some arc variation to make it feel more natural
        const arcVariation = (Math.random() - 0.5) * 20;

        return new Promise(resolve => {
            ball.style.animation = 'none';
            setTimeout(() => {
                ball.style.transition = 'all 0.8s cubic-bezier(0.34, 0.82, 0.64, 1)';
                ball.style.transform = `translateX(calc(-50% + ${endX}px)) translateY(${endY - 100 + arcVariation}px) scale(0.95)`;

                setTimeout(() => {
                    ball.style.transition = 'none';
                    resolve();
                }, 800);
            }, 50);
        });
    }

    static animateGoalkeeper(direction) {
        const goalkeeper = document.getElementById('goalkeeper');
        const dirObj = DIRECTIONS[direction];

        // Determine which way goalkeeper dives
        const shouldDive = Math.random() > 0.3; // 70% chance to dive

        if (shouldDive) {
            goalkeeper.classList.add('diving');
        } else {
            goalkeeper.classList.remove('diving');
        }
    }

    static flashDirectionZone(directionKey) {
        const direction = DIRECTIONS[directionKey];
        const indicator = document.getElementById('directionIndicator');

        indicator.style.background = 'radial-gradient(circle, rgba(102, 126, 234, 0.3) 0%, transparent 70%)';
        indicator.style.opacity = '1';

        setTimeout(() => {
            indicator.style.opacity = '0';
            indicator.style.transition = 'opacity 0.3s ease';
        }, 300);
    }

    static reset() {
        const ball = document.getElementById('ball');
        const goalkeeper = document.getElementById('goalkeeper');
        const indicator = document.getElementById('directionIndicator');

        ball.style.transition = 'none';
        ball.style.transform = 'translateX(-50%) translateY(0) scale(1)';
        goalkeeper.classList.remove('diving');
        indicator.style.opacity = '0';
    }
}

// ==================== GAME FLOW ====================
async function executeKick() {
    if (!gameState.selectedDirection || gameState.isPlaying || gameState.animating) return;

    gameState.isPlaying = true;
    gameState.animating = true;
    gameState.attempts++;

    // Disable direction buttons and difficulty selector
    document.querySelectorAll('.direction-btn').forEach(btn => btn.disabled = true);
    document.getElementById('difficultySelect').disabled = true;
    document.getElementById('kickBtn').disabled = true;

    // Play kick sound
    audioSystem.playKickSound();

    // Determine the outcome
    gameState.chosenDirection = getRandomDirection(gameState.selectedDirection);
    const isCorrect = gameState.selectedDirection === gameState.chosenDirection;

    // Introduce slight delay for tension
    await new Promise(resolve => setTimeout(resolve, 400));

    // Animate goalkeeper
    Animator.animateGoalkeeper(gameState.chosenDirection);

    // Animate ball
    await Animator.animateBallToDirection(gameState.chosenDirection);

    // Flash the direction zone
    Animator.flashDirectionZone(gameState.chosenDirection);

    // Play result sound and update stats
    if (isCorrect) {
        gameState.wins++;
        audioSystem.playWinSound();
        setTimeout(() => audioSystem.playCrowdCheer(), 300);
    } else {
        audioSystem.playLoseSound();
        setTimeout(() => audioSystem.playCrowdBoo(), 300);
    }

    gameState.animating = false;

    // Show result
    await new Promise(resolve => setTimeout(resolve, 600));
    showResult(isCorrect);
}

function showResult(isCorrect) {
    const resultContainer = document.getElementById('resultContainer');
    const resultIcon = document.getElementById('resultIcon');
    const resultText = document.getElementById('resultText');
    const resultDetails = document.getElementById('resultDetails');

    const selectedDirName = DIRECTIONS[gameState.selectedDirection].name;
    const chosenDirName = DIRECTIONS[gameState.chosenDirection].name;

    if (isCorrect) {
        resultIcon.textContent = '⚽✅';
        resultText.textContent = 'GOAL! You Guessed Right! 🎉';
        resultDetails.innerHTML = `<p>Direction: ${chosenDirName}</p><p style="margin-top: 10px; font-size: 0.9em;">You predicted correctly! Excellent timing!</p>`;
    } else {
        resultIcon.textContent = '❌';
        resultText.textContent = 'Miss! Wrong Direction';
        resultDetails.innerHTML = `<p>You guessed: ${selectedDirName}</p><p>Ball went to: ${chosenDirName}</p><p style="margin-top: 10px; font-size: 0.9em;">Close! Try again!</p>`;
    }

    resultContainer.style.display = 'flex';
    updateStats();
}

function playAgain() {
    // Reset UI
    document.getElementById('resultContainer').style.display = 'none';

    // Reset game state
    gameState.selectedDirection = null;
    gameState.chosenDirection = null;
    gameState.isPlaying = false;

    // Reset animations
    Animator.reset();

    // Re-enable controls
    document.querySelectorAll('.direction-btn').forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('selected');
    });
    document.getElementById('difficultySelect').disabled = false;
}

function changeDifficulty(event) {
    gameState.difficulty = event.target.value;
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    // Create direction grid
    createDirectionGrid();

    // Event listeners
    document.getElementById('kickBtn').addEventListener('click', executeKick);
    document.getElementById('tryAgainBtn').addEventListener('click', playAgain);
    document.getElementById('cancelBtn').addEventListener('click', playAgain);
    document.getElementById('difficultySelect').addEventListener('change', changeDifficulty);

    // Initialize stats
    updateStats();

    // Add keyboard support
    document.addEventListener('keydown', (e) => {
        if (gameState.isPlaying || gameState.animating) return;

        // Map keys to directions (arrow keys + others)
        const keyMap = {
            'ArrowUp': Object.keys(DIRECTIONS).filter(k => DIRECTIONS[k].y === 'top')[1],
            'ArrowDown': Object.keys(DIRECTIONS).filter(k => DIRECTIONS[k].y === 'bottom')[1],
            'ArrowLeft': Object.keys(DIRECTIONS).filter(k => DIRECTIONS[k].x === 'left')[1],
            'ArrowRight': Object.keys(DIRECTIONS).filter(k => DIRECTIONS[k].x === 'right')[1],
            'Enter': 'kick',
        };

        if (e.key === 'Enter') {
            executeKick();
        } else if (keyMap[e.key]) {
            const buttons = document.querySelectorAll('.direction-btn');
            buttons.forEach(btn => {
                if (btn.dataset.direction === keyMap[e.key]) {
                    btn.click();
                }
            });
        }
    });

    console.log('✅ Game initialized! Ready to play.');
});
