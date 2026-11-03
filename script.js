const DIFFICULTIES = {
  easy: { goal: 12, duration: 45, spawnRate: 1400 },
  normal: { goal: 20, duration: 30, spawnRate: 1000 },
  hard: { goal: 25, duration: 25, spawnRate: 700 }
};

const winningMessages = [
  'Goal reached! You collected {score} water cans.',
  'Nice round! You collected {score} water cans.',
  'You did it! {score} water cans collected.'
];
const losingMessages = [
  'Good try! You collected {score} of {goal} water cans.',
  'Time’s up! You collected {score} of {goal} water cans.',
  'Give it another go—you collected {score} of {goal} water cans.'
];
const milestoneMessages = [
  { progress: 0.25, message: 'Nice start!' },
  { progress: 0.5, message: 'Halfway there!' },
  { progress: 0.75, message: 'Almost at the goal!' }
];

const grid = document.querySelector('.game-grid');
const scoreDisplay = document.getElementById('current-cans');
const goalDisplay = document.getElementById('goal');
const timerDisplay = document.getElementById('timer');
const difficultySelect = document.getElementById('difficulty');
const instructions = document.getElementById('game-instructions');
const statusMessage = document.getElementById('achievements');
const startButton = document.getElementById('start-game');
const stopButton = document.getElementById('stop-game');

let currentCans = 0;
let timeLeft = DIFFICULTIES.normal.duration;
let gameActive = false;
let spawnTimeout;
let timerInterval;
let audioContext;
let roundMilestones = [];
const reachedMilestones = new Set();

function playSound(type) {
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return;

  audioContext ??= new AudioContextClass();
  if (audioContext.state === 'suspended') audioContext.resume();

  const sounds = {
    collect: [{ frequency: 660, delay: 0 }, { frequency: 880, delay: 0.07 }],
    miss: [{ frequency: 220, delay: 0 }],
    button: [{ frequency: 440, delay: 0 }],
    milestone: [{ frequency: 587, delay: 0 }, { frequency: 784, delay: 0.08 }],
    win: [{ frequency: 523, delay: 0 }, { frequency: 659, delay: 0.1 }, { frequency: 784, delay: 0.2 }]
  };
  const notes = sounds[type];
  if (!notes) return;

  const now = audioContext.currentTime;
  notes.forEach(({ frequency, delay }) => {
    const oscillator = audioContext.createOscillator();
    const volume = audioContext.createGain();
    const start = now + delay;
    const duration = type === 'miss' ? 0.22 : 0.12;
    oscillator.type = type === 'miss' ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency, start);
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(0.12, start + 0.015);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(volume);
    volume.connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  });
}

function createGrid() {
  grid.replaceChildren();
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('button');
    cell.className = 'grid-cell';
    cell.type = 'button';
    cell.setAttribute('aria-label', 'Empty spot');
    grid.appendChild(cell);
  }
}

function clearCan(missed = false) {
  const activeCell = grid.querySelector('.has-can');
  if (!activeCell) return;

  if (missed) {
    playSound('miss');
    statusMessage.textContent = 'A can got away! Keep going.';
  }
  activeCell.classList.remove('has-can');
  activeCell.setAttribute('aria-label', 'Empty spot');
  activeCell.querySelector('.water-can-wrapper').remove();
}

function spawnWaterCan() {
  if (!gameActive) return;

  clearCan(true);
  const cells = grid.querySelectorAll('.grid-cell');
  const cell = cells[Math.floor(Math.random() * cells.length)];
  const wrapper = document.createElement('span');
  wrapper.className = 'water-can-wrapper';
  wrapper.setAttribute('aria-hidden', 'true');
  const can = document.createElement('span');
  can.className = 'water-can';
  wrapper.appendChild(can);
  cell.appendChild(wrapper);
  cell.classList.add('has-can');
  cell.setAttribute('aria-label', 'Collect the water can');

  spawnTimeout = setTimeout(spawnWaterCan, DIFFICULTIES[difficultySelect.value].spawnRate);
}

function updateDifficulty() {
  const settings = DIFFICULTIES[difficultySelect.value];
  goalDisplay.textContent = settings.goal;
  timerDisplay.textContent = settings.duration;
  instructions.textContent = `Collect ${settings.goal} water cans in ${settings.duration} seconds. Each can is worth one point.`;
}

function endGame(stopped = false) {
  gameActive = false;
  clearTimeout(spawnTimeout);
  clearInterval(timerInterval);
  clearCan();
  difficultySelect.disabled = false;
  startButton.disabled = false;
  startButton.textContent = 'Play again';
  stopButton.hidden = true;

  const settings = DIFFICULTIES[difficultySelect.value];
  const won = currentCans >= settings.goal;
  if (won && !stopped) playSound('win');
  if (stopped) {
    const canLabel = currentCans === 1 ? 'can' : 'cans';
    statusMessage.textContent = `Game stopped. You collected ${currentCans} water ${canLabel}.`;
  } else {
    const messages = won ? winningMessages : losingMessages;
    const message = messages[Math.floor(Math.random() * messages.length)];
    statusMessage.textContent = message
      .replace('{score}', currentCans)
      .replace('{goal}', settings.goal);
  }
  statusMessage.classList.toggle('is-win', won);
  statusMessage.classList.toggle('is-loss', !won && !stopped);
}

function startGame() {
  if (gameActive) return;

  playSound('button');
  const settings = DIFFICULTIES[difficultySelect.value];
  currentCans = 0;
  reachedMilestones.clear();
  roundMilestones = milestoneMessages.map(milestone => ({
    ...milestone,
    score: Math.ceil(settings.goal * milestone.progress)
  }));
  timeLeft = settings.duration;
  scoreDisplay.textContent = currentCans;
  timerDisplay.textContent = timeLeft;
  goalDisplay.textContent = settings.goal;
  statusMessage.textContent = 'Go! Tap the water cans to collect points.';
  statusMessage.classList.remove('is-win', 'is-loss');
  createGrid();

  gameActive = true;
  difficultySelect.disabled = true;
  startButton.disabled = true;
  startButton.textContent = 'Game in progress';
  stopButton.hidden = false;
  spawnWaterCan();

  timerInterval = setInterval(() => {
    timeLeft -= 1;
    timerDisplay.textContent = timeLeft;
    if (timeLeft <= 0) endGame();
  }, 1000);
}

grid.addEventListener('click', event => {
  const cell = event.target.closest('.grid-cell');
  if (!gameActive || !cell || !cell.classList.contains('has-can')) return;

  clearCan();
  currentCans += 1;
  scoreDisplay.textContent = currentCans;
  playSound('collect');
  const milestone = roundMilestones.find(item =>
    currentCans >= item.score && !reachedMilestones.has(item.score)
  );
  if (milestone) {
    reachedMilestones.add(milestone.score);
    statusMessage.textContent = milestone.message;
    playSound('milestone');
  }
  if (currentCans >= DIFFICULTIES[difficultySelect.value].goal) endGame();
});

difficultySelect.addEventListener('change', updateDifficulty);
startButton.addEventListener('click', startGame);
stopButton.addEventListener('click', () => {
  if (gameActive) {
    playSound('button');
    endGame(true);
  }
});
createGrid();
updateDifficulty();
