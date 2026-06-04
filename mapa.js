(function(){
  const canvas = document.getElementById('explore-map');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const TILE = 40;
  const COLS = Math.floor(canvas.width / TILE);
  const ROWS = Math.floor(canvas.height / TILE);

  const ASSETS = {
    forest: 'elementos/arbola.gif',
    rock: 'elementos/roca.gif',
    cave: 'elementos/cueva.gif',
    barracks: 'elementos/barraca.gif',
    castle: 'elementos/castillo (1).gif',
    caballero: 'elementos/caballero.gif',
    arquero: 'elementos/arquero.gif',
    constructor: 'elementos/constructor.gif',
    minero: 'elementos/minero.gif',
    talador: 'elementos/talador.gif',
    madera: 'elementos/madera item.gif',
    piedra: 'elementos/piedra item.gif'
  };

  const assetImages = {};
  let readyCount = 0;
  Object.entries(ASSETS).forEach(([key, path]) => {
    const img = new Image();
    img.src = encodeURI(path);
    img.onload = () => { readyCount++; };
    assetImages[key] = img;
  });

  const inventory = {
    madera: 0,
    piedra: 0,
    mineral: 0,
    oro: 0,
    hierro: 0,
    cobre: 0,
    mineros: 0,
    caballeros: 0,
    arqueros: 0
  };

  const tileTypes = ['forest', 'rock', 'cave'];
  const map = [];
  let selectedTile = null;
  let totalCollected = 0;
  const structureHealth = { castle: 200, barracks: 120 };

  function createTile(type) {
    return {
      type,
      discovered: false,
      collected: false,
      structure: null,
      structureHealth: null,
      units: { caballero: 0, arquero: 0 },
      x: 0,
      y: 0
    };
  }

  function buildMap() {
    map.length = 0;
    for(let y=0;y<ROWS;y++){
      const row = [];
      for(let x=0;x<COLS;x++){
        const tile = createTile('empty');
        tile.x = x; tile.y = y;
        row.push(tile);
      }
      map.push(row);
    }

    const center = { x: Math.floor(COLS/2), y: Math.floor(ROWS/2) };
    const castleTile = map[center.y][center.x];
    castleTile.type = 'castle';
    castleTile.discovered = true;
    castleTile.structure = 'castle';
    castleTile.structureHealth = structureHealth.castle;
    castleTile.collected = true;

    createEmptyRing(center.x, center.y);
    fillResources();
    selectedTile = castleTile;
  }

  function isCenter(x,y) {
    return x === Math.floor(COLS/2) && y === Math.floor(ROWS/2);
  }

  function createEmptyRing(cx, cy) {
    for(let dy=-1; dy<=1; dy++){
      for(let dx=-1; dx<=1; dx++){
        if(dx === 0 && dy === 0) continue;
        const x = cx + dx;
        const y = cy + dy;
        if(x>=0 && x<COLS && y>=0 && y<ROWS){
          const tile = map[y][x];
          tile.type = 'empty';
          tile.discovered = true;
          tile.collected = true;
        }
      }
    }
  }

  function getEmptyTiles(predicate) {
    const tiles = [];
    for(let y=0;y<ROWS;y++){
      for(let x=0;x<COLS;x++){
        const tile = map[y][x];
        if(tile.type === 'empty' && !tile.structure && (!predicate || predicate(tile))) {
          tiles.push(tile);
        }
      }
    }
    return tiles;
  }

  function getNeighbors(tile) {
    const positions = [
      [tile.x-1, tile.y], [tile.x+1, tile.y],
      [tile.x, tile.y-1], [tile.x, tile.y+1]
    ];
    return positions
      .filter(([nx,ny]) => nx>=0 && nx<COLS && ny>=0 && ny<ROWS)
      .map(([nx,ny]) => map[ny][nx]);
  }

  function placeCluster(type, minSize, maxSize) {
    const emptyTiles = getEmptyTiles();
    if(emptyTiles.length === 0) return;
    const start = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
    start.type = type;
    start.collected = false;
    let cluster = [start];
    const targetSize = minSize + Math.floor(Math.random() * (maxSize - minSize + 1));
    while(cluster.length < targetSize) {
      const borders = [];
      cluster.forEach(tile => {
        getNeighbors(tile).forEach(neighbor => {
          if(neighbor.type === 'empty' && !neighbor.structure && !borders.includes(neighbor)) {
            borders.push(neighbor);
          }
        });
      });
      if(borders.length === 0) break;
      const next = borders[Math.floor(Math.random() * borders.length)];
      next.type = type;
      next.collected = false;
      cluster.push(next);
    }
  }

  function placeCaves(limit) {
    for(let i=0;i<limit;i++){
      const empties = getEmptyTiles(tile => !isAdjacentToCastle(tile.x, tile.y));
      if(empties.length === 0) break;
      const chosen = empties[Math.floor(Math.random() * empties.length)];
      chosen.type = 'cave';
      chosen.collected = false;
    }
  }

  function fillResources() {
    placeCaves(2);
    for(let i=0;i<5;i++) placeCluster('rock', 2, 4);
    for(let i=0;i<5;i++) placeCluster('forest', 2, 4);
  }

  function isAdjacentDiscovered(x,y) {
    const neighbors = [
      [x-1,y],[x+1,y],[x,y-1],[x,y+1],
      [x-1,y-1],[x-1,y+1],[x+1,y-1],[x+1,y+1]
    ];
    return neighbors.some(([nx,ny]) => nx>=0 && nx<COLS && ny>=0 && ny<ROWS && map[ny][nx].discovered);
  }

  function revealAround(x,y) {
    for(let dy=-1;dy<=1;dy++){
      for(let dx=-1;dx<=1;dx++){
        const nx = x + dx;
        const ny = y + dy;
        if(nx>=0 && nx<COLS && ny>=0 && ny<ROWS){
          map[ny][nx].discovered = true;
        }
      }
    }
  }

  function drawGrid() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    for(let y=0;y<ROWS;y++){
      for(let x=0;x<COLS;x++){
        const px = x * TILE;
        const py = y * TILE;
        ctx.fillStyle = '#09111e';
        ctx.fillRect(px, py, TILE-1, TILE-1);

        const tile = map[y][x];
        if(tile.discovered){
          if(tile.type && assetImages[tile.type]?.complete){
            ctx.drawImage(assetImages[tile.type], px+4, py+4, TILE-8, TILE-8);
          }
          if(tile.structure === 'castle' && inventory.mineros > 0 && assetImages.minero.complete) {
            ctx.drawImage(assetImages.minero, px+6, py+6, TILE/2.2, TILE/2.2);
          }
          if(tile.units.caballero > 0) {
            ctx.drawImage(assetImages.caballero, px+6, py+6, TILE/2.2, TILE/2.2);
          }
          if(tile.units.arquero > 0) {
            ctx.drawImage(assetImages.arquero, px+TILE/2, py+6, TILE/2.2, TILE/2.2);
          }
        }

        if(!tile.discovered){
          ctx.fillStyle = 'rgba(0,0,0,0.90)';
          ctx.fillRect(px, py, TILE-1, TILE-1);
        }

        if(selectedTile && selectedTile.x === x && selectedTile.y === y){
          ctx.strokeStyle = '#7c3aed';
          ctx.lineWidth = 3;
          ctx.strokeRect(px+1.5, py+1.5, TILE-4, TILE-4);
        }
      }
    }
  }

  function formatNumber(value) {
    return value.toString();
  }

  function updateInventoryPanel() {
    const container = document.getElementById('inventory-panel');
    if(!container) return;
    container.innerHTML = '';
    const rows = [
      { icon: 'madera', label: 'Madera', value: inventory.madera },
      { icon: 'piedra', label: 'Piedra', value: inventory.piedra },
      { icon: 'constructor', label: 'Mineral', value: inventory.mineral },
      { icon: 'constructor', label: 'Oro', value: inventory.oro },
      { icon: 'constructor', label: 'Hierro', value: inventory.hierro },
      { icon: 'constructor', label: 'Cobre', value: inventory.cobre },
      { icon: 'minero', label: 'Mineros', value: inventory.mineros },
      { icon: 'caballero', label: 'Caballeros', value: inventory.caballeros },
      { icon: 'arquero', label: 'Arqueros', value: inventory.arqueros }
    ];
    rows.forEach(row => {
      const item = document.createElement('div');
      item.className = 'inventory-row';
      const left = document.createElement('span');
      left.innerHTML = `<img src="${encodeURI(ASSETS[row.icon])}" alt="${row.label}" /> ${row.label}`;
      const right = document.createElement('span');
      right.textContent = formatNumber(row.value);
      item.appendChild(left);
      item.appendChild(right);
      container.appendChild(item);
    });
  }

  function addLog(message) {
    const log = document.getElementById('battle-log');
    if(!log) return;
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    log.textContent = `${time} — ${message}\n${log.textContent}`;
  }

  function selectTile(x,y) {
    selectedTile = map[y][x];
    renderSelectedInfo();
    drawGrid();
  }

  function canDiscover(x,y) {
    return map[y][x].discovered || isAdjacentDiscovered(x,y);
  }

  function gatherTile(tile) {
    if(!tile.discovered) return;
    if(tile.type === 'forest' && !tile.collected) {
      tile.collected = true;
      tile.type = 'empty';
      inventory.madera += 8;
      totalCollected += 8;
      addLog('Recolección: obtuviste madera de los árboles.');
    } else if(tile.type === 'rock' && !tile.collected) {
      tile.collected = true;
      tile.type = 'empty';
      inventory.piedra += 10;
      totalCollected += 10;
      addLog('Recolección: obtuviste piedra de las rocas.');
    } else if(tile.type === 'cave') {
      inventory.piedra += 4;
      inventory.mineral += 3;
      totalCollected += 7;
      if(Math.random() < 0.25) inventory.oro += 1;
      if(Math.random() < 0.25) inventory.hierro += 1;
      if(Math.random() < 0.20) inventory.cobre += 1;
      addLog('Cueva: extraíste piedra, mineral y minerales especiales. La cueva es infinita.');
    } else {
      addLog('No hay nada que recolectar aquí.');
    }
    updateCounters();
    updateInventoryPanel();
    drawGrid();
  }

  function buildUnit(unitType) {
    if(!selectedTile || selectedTile.structure !== 'barracks') return;
    const cost = unitType === 'caballero'
      ? { piedra: 6, mineral: 8, hierro: 5 }
      : { madera: 8, mineral: 6, cobre: 4 };
    const canPay = Object.entries(cost).every(([key, amount]) => inventory[key] >= amount);
    if(!canPay) {
      addLog('No tienes suficientes recursos para crear la unidad.');
      return;
    }
    Object.entries(cost).forEach(([key, amount]) => inventory[key] -= amount);
    selectedTile.units[unitType] += 1;
    inventory[unitType + 's'] += 1;
    addLog(`Se creó un ${unitType} en la barraca.`);
    updateCounters();
    updateInventoryPanel();
    renderSelectedInfo();
    drawGrid();
  }

  function repairStructure(tile) {
    if(!tile || !tile.structure) return;
    const maxHealth = structureHealth[tile.structure];
    if(tile.structureHealth >= maxHealth) {
      addLog('La estructura ya está en buen estado.');
      return;
    }
    const cost = { mineral: 6, oro: 2, hierro: 4, cobre: 3 };
    const canPay = Object.entries(cost).every(([key, amount]) => inventory[key] >= amount);
    if(!canPay) {
      addLog('No tienes suficientes minerales, oro, hierro o cobre para reparar.');
      return;
    }
    Object.entries(cost).forEach(([key, amount]) => inventory[key] -= amount);
    tile.structureHealth = Math.min(maxHealth, tile.structureHealth + 40);
    addLog(`Reparaste la estructura ${tile.structure}. Salud: ${tile.structureHealth}/${maxHealth}.`);
    updateCounters();
    updateInventoryPanel();
    renderSelectedInfo();
  }

  function updateCounters() {
    document.getElementById('collected-count').textContent = totalCollected;
  }

  function renderSelectedInfo() {
    const info = document.getElementById('selected-info');
    if(!info) return;
    if(!selectedTile) {
      info.innerHTML = '<p>Haz clic en un tile descubierto para ver detalles.</p>';
      return;
    }
    const typeLabel = selectedTile.structure ? selectedTile.structure : selectedTile.type || 'vacío';
    const x = selectedTile.x;
    const y = selectedTile.y;
    let description = '';
    let buttons = '';
    if(selectedTile.type === 'forest') {
      description = 'Bosque: da madera y se consume cuando recolectas.';
      buttons = `<button class="button" onclick="window.mapActions.gather()">Recolectar madera</button>`;
    } else if(selectedTile.type === 'rock') {
      description = 'Roca: da piedra y se consume al recolectarla.';
      buttons = `<button class="button" onclick="window.mapActions.gather()">Minar piedra</button>`;
    } else if(selectedTile.type === 'cave') {
      description = 'Cueva: da piedra infinita, mineral y a veces oro, hierro o cobre.';
      buttons = `<button class="button" onclick="window.mapActions.gather()">Extraer de la cueva</button>`;
    } else if(selectedTile.structure === 'barracks') {
      description = 'Barracas: crea caballero y arquero. Usa recursos para construir unidades.';
      buttons = `
        <button class="button" onclick="window.mapActions.build('caballero')">Crear caballero</button>
        <button class="button" onclick="window.mapActions.build('arquero')">Crear arquero</button>
        <button class="button secondary" onclick="window.mapActions.repair()">Reparar estructura</button>
      `;
    } else if(selectedTile.structure === 'castle') {
      description = 'Castillo: tu base central. Repara usando minerales, oro, hierro y cobre. Aquí puedes crear mineros.';
      buttons = `
        <button class="button" onclick="window.mapActions.buildMiner()">Crear minero</button>
        <button class="button secondary" onclick="window.mapActions.repair()">Reparar castillo</button>
      `;
    } else if(selectedTile.type === 'empty' && canBuildBarracks(selectedTile)) {
      description = 'Terreno vacío junto al castillo. Construye barracas para entrenar unidades.';
      buttons = `<button class="button" onclick="window.mapActions.buildBarracks()">Construir barracas</button>`;
    } else {
      description = 'Terreno despejado. Explora más para encontrar recursos.';
    }
    let statusText = `<div class="info-row"><span><strong>Tile:</strong> ${typeLabel}</span><span>${x}, ${y}</span></div>`;
    if(selectedTile.structure) {
      statusText += `<div class="info-row"><span><strong>Salud:</strong></span><span>${selectedTile.structureHealth}/${structureHealth[selectedTile.structure]}</span></div>`;
    }
    if(selectedTile.type === 'forest' || selectedTile.type === 'rock') {
      const remaining = selectedTile.collected ? 'No quedan recursos' : 'Recurso disponible';
      statusText += `<div class="info-row"><span>${remaining}</span></div>`;
    }
    if(selectedTile.structure === 'barracks') {
      statusText += `<div class="info-row"><span>Caballeros:</span><span>${selectedTile.units.caballero}</span></div>`;
      statusText += `<div class="info-row"><span>Arqueros:</span><span>${selectedTile.units.arquero}</span></div>`;
    }
    if(selectedTile.structure === 'castle') {
      statusText += `<div class="info-row"><span>Mineros:</span><span>${inventory.mineros}</span></div>`;
    }
    info.innerHTML = `
      ${statusText}
      <p class="status-note">${description}</p>
      <div class="action-buttons">${buttons}</div>
    `;
  }

  function trySelectTile(x,y) {
    const tile = map[y][x];
    if(!tile.discovered) {
      if(!canDiscover(x,y)) {
        addLog('Debes explorar desde un borde descubierto para llegar ahí.');
        return;
      }
      tile.discovered = true;
      revealAround(x,y);
      addLog(`Descubriste una nueva zona en (${x},${y}).`);
    }
    selectTile(x,y);
  }

  function canBuildBarracks(tile) {
    return tile.discovered && tile.type === 'empty' && !tile.structure && isAdjacentToCastle(tile.x, tile.y);
  }

  function isAdjacentToCastle(x,y) {
    const neighbors = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
    return neighbors.some(([nx,ny]) => nx>=0 && nx<COLS && ny>=0 && ny<ROWS && map[ny][nx].structure === 'castle');
  }

  function buildBarracks(tile) {
    const cost = { madera: 100, piedra: 50 };
    const canPay = Object.entries(cost).every(([key, amount]) => inventory[key] >= amount);
    if(!canPay) {
      addLog('No tienes suficientes recursos para construir barracas.');
      return;
    }
    Object.entries(cost).forEach(([key, amount]) => inventory[key] -= amount);
    tile.type = 'barracks';
    tile.structure = 'barracks';
    tile.structureHealth = structureHealth.barracks;
    tile.collected = true;
    addLog('Construiste unas barracas en el mapa.');
    updateInventoryPanel();
    renderSelectedInfo();
    drawGrid();
  }

  function buildMiner() {
    if(!selectedTile || selectedTile.structure !== 'castle') return;
    const cost = { madera: 100, piedra: 50 };
    const canPay = Object.entries(cost).every(([key, amount]) => inventory[key] >= amount);
    if(!canPay) {
      addLog('No tienes suficientes recursos para crear un minero.');
      return;
    }
    Object.entries(cost).forEach(([key, amount]) => inventory[key] -= amount);
    inventory.mineros += 1;
    addLog('Creaste un minero en el castillo.');
    updateInventoryPanel();
    renderSelectedInfo();
  }

  function getRandomUndiscoveredNeighbor() {
    const candidates = [];
    for(let y=0;y<ROWS;y++){
      for(let x=0;x<COLS;x++){
        const tile = map[y][x];
        if(!tile.discovered && isAdjacentDiscovered(x,y)) candidates.push({x,y});
      }
    }
    return candidates.length ? candidates[Math.floor(Math.random()*candidates.length)] : null;
  }

  function autoExplore() {
    const target = getRandomUndiscoveredNeighbor();
    if(target) {
      trySelectTile(target.x, target.y);
    } else {
      addLog('No hay más zonas adyacentes para revelar. Explora manualmente otras áreas.');
    }
  }

  canvas.addEventListener('click', (event)=>{
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((event.clientX - rect.left) * scaleX / TILE);
    const y = Math.floor((event.clientY - rect.top) * scaleY / TILE);
    if(x>=0 && x<COLS && y>=0 && y<ROWS){
      trySelectTile(x,y);
    }
  });

  document.getElementById('reveal-random').addEventListener('click', autoExplore);
  document.getElementById('reset-map').addEventListener('click', ()=>{
    Object.keys(inventory).forEach(key => inventory[key] = 0);
    totalCollected = 0;
    updateCounters();
    buildMap();
    updateInventoryPanel();
    renderSelectedInfo();
    drawGrid();
    addLog('El mapa se reinició. Tu castillo está de nuevo en el centro.');
  });

  window.mapActions = {
    gather() {
      if(!selectedTile) return;
      gatherTile(selectedTile);
    },
    build(type) {
      buildUnit(type);
    },
    buildBarracks() {
      if(!selectedTile) return;
      buildBarracks(selectedTile);
    },
    buildMiner() {
      buildMiner();
    },
    repair() {
      if(!selectedTile) return;
      repairStructure(selectedTile);
    }
  };

  function drawLoop() {
    if(readyCount >= Object.keys(ASSETS).length) {
      drawGrid();
    } else {
      requestAnimationFrame(drawLoop);
    }
  }

  buildMap();
  updateInventoryPanel();
  renderSelectedInfo();
  updateCounters();
  drawLoop();
})();
