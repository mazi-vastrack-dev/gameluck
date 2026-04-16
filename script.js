// ==================== GAME STATE ====================
const DIRECTIONS = {
    L: { name: 'Left', emoji: '⬅️', x: 'left', y: 'mid' },
    C: { name: 'Center', emoji: '⏺️', x: 'center', y: 'mid' },
    R: { name: 'Right', emoji: '➡️', x: 'right', y: 'mid' },
};

const DIFFICULTY_CONFIG = {
    hard: {
        winChance: 0.30,
        label: 'Hard (30% win chance)',
        biasStrength: 0.75,
    },
};

let gameState = {
    selectedDirection: null,
    chosenDirection: null,
    isPlaying: false,
    difficulty: 'hard',
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

    // Animate ball in the chosen direction
    const ball = document.getElementById('ball');
    ball.style.animation = 'none';
    
    // Determine animation based on chosen direction
    const directionMap = {
        L: 'kickBallLeft',
        C: 'kickBallCenter',
        R: 'kickBallRight'
    };
    
    const animationName = directionMap[gameState.chosenDirection] || 'kickBall';
    
    // Trigger animation
    setTimeout(() => {
        ball.style.animation = `${animationName} 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`;
    }, 10);

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
        resultDetails.textContent = `You chose ${DIRECTIONS[gameState.selectedDirection].name} and hit! Amazing! 🌟`;
    } else {
        resultIcon.textContent = '❌⚽💨';
        const userChose = DIRECTIONS[gameState.selectedDirection].name;
        const ballWent = DIRECTIONS[gameState.chosenDirection].name;
        resultText.textContent = `Wrong Direction!`;
        resultDetails.textContent = `You predicted ${userChose}, but the ball went to ${ballWent}! Better luck next time! 💪`;
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
    ball.style.animation = 'none';
    ball.style.transform = 'translateX(-50%)';

    createDirectionButtons();
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', () => {
    createDirectionButtons();

    // Kick button
    document.getElementById('kickBtn').addEventListener('click', kick);

    // Try again button
    document.getElementById('tryAgainBtn').addEventListener('click', resetGame);

    // Cancel button
    document.getElementById('cancelBtn').addEventListener('click', () => {
        document.getElementById('resultContainer').style.display = 'none';
        resetGame();
    });

    // Back button
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'menu.html';
        });
    }

    updateStats();
    console.log('✅ Penalty Kick Game loaded!');
});
