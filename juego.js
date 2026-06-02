const player = {
  name: 'Guerrero',
  maxHp: 100,
  hp: 100,
  attack: 16,
  healPower: 20,
  defending: false,
};

const enemy = {
  name: 'Señor Sombrío',
  maxHp: 110,
  hp: 110,
  attack: 14,
};

const elements = {
  playerHpText: document.getElementById('player-hp-text'),
  playerHpBar: document.getElementById('player-hp-bar'),
  enemyHpText: document.getElementById('enemy-hp-text'),
  enemyHpBar: document.getElementById('enemy-hp-bar'),
  turnStatus: document.getElementById('turn-status'),
  battleLog: document.getElementById('battle-log'),
  attackButton: document.getElementById('attack-button'),
  defendButton: document.getElementById('defend-button'),
  healButton: document.getElementById('heal-button'),
  restartButton: document.getElementById('restart-button'),
};

let gameOver = false;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function updateHpDisplay() {
  elements.playerHpText.textContent = `${player.hp} / ${player.maxHp}`;
  elements.playerHpBar.style.width = `${(player.hp / player.maxHp) * 100}%`;
  elements.enemyHpText.textContent = `${enemy.hp} / ${enemy.maxHp}`;
  elements.enemyHpBar.style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
}

function setTurnText(text) {
  elements.turnStatus.textContent = text;
}

function addLog(message) {
  const now = new Date();
  const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  elements.battleLog.textContent = `${timestamp} — ${message}\n${elements.battleLog.textContent}`;
}

function disableActions(value) {
  elements.attackButton.disabled = value;
  elements.defendButton.disabled = value;
  elements.healButton.disabled = value;
  elements.attackButton.style.opacity = value ? '0.45' : '1';
  elements.defendButton.style.opacity = value ? '0.45' : '1';
  elements.healButton.style.opacity = value ? '0.45' : '1';
}

function getRandomValue(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function enemyAttack() {
  if (gameOver) return;

  const baseDamage = getRandomValue(enemy.attack - 3, enemy.attack + 3);
  const damage = player.defending ? Math.max(1, Math.floor(baseDamage / 2)) : baseDamage;
  player.hp = clamp(player.hp - damage, 0, player.maxHp);
  player.defending = false;
  addLog(`${enemy.name} ataca y causa ${damage} de daño.`);
  updateHpDisplay();

  if (player.hp <= 0) {
    addLog('Has sido derrotado. El Señor Sombrío gana esta batalla.');
    setTurnText('Derrota');
    gameOver = true;
    disableActions(true);
    return;
  }

  setTurnText('Jugador');
}

function playerAttack() {
  if (gameOver) return;

  const damage = getRandomValue(player.attack - 4, player.attack + 4);
  enemy.hp = clamp(enemy.hp - damage, 0, enemy.maxHp);
  addLog(`Atacas al ${enemy.name} y le infliges ${damage} de daño.`);
  updateHpDisplay();

  if (enemy.hp <= 0) {
    addLog('¡Victoria! Has derrotado al Señor Sombrío.');
    setTurnText('Victoria');
    gameOver = true;
    disableActions(true);
    return;
  }

  setTurnText('Enemigo');
  setTimeout(enemyAttack, 650);
}

function playerDefend() {
  if (gameOver) return;

  player.defending = true;
  addLog('Te preparas para defender. El próximo ataque enemigo hará menos daño.');
  setTurnText('Enemigo');
  setTimeout(enemyAttack, 650);
}

function playerHeal() {
  if (gameOver) return;

  const healAmount = getRandomValue(player.healPower - 5, player.healPower + 5);
  player.hp = clamp(player.hp + healAmount, 0, player.maxHp);
  addLog(`Recuperas ${healAmount} puntos de vida.`);
  updateHpDisplay();
  setTurnText('Enemigo');
  setTimeout(enemyAttack, 650);
}

function resetBattle() {
  player.hp = player.maxHp;
  player.defending = false;
  enemy.hp = enemy.maxHp;
  gameOver = false;
  setTurnText('Jugador');
  addLog('La batalla se reinicia. El Guerrero y el Señor Sombrío vuelven a enfrentarse.');
  updateHpDisplay();
  disableActions(false);
}

function initGame() {
  updateHpDisplay();
  setTurnText('Jugador');
  disableActions(false);
  elements.attackButton.addEventListener('click', playerAttack);
  elements.defendButton.addEventListener('click', playerDefend);
  elements.healButton.addEventListener('click', playerHeal);
  elements.restartButton.addEventListener('click', resetBattle);
}

initGame();
