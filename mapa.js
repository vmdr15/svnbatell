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
    barracks: 'elementos/barraca (1).gif',
    castle: 'elementos/castillo (1).gif',
    caballero: 'elementos/caballero.gif',
    arquero: 'elementos/arquero.gif',
    constructor: 'elementos/constructor.gif',
    minero: 'elementos/minero.gif',
    talador: 'elementos/talador.gif',
    slime: 'elementos/slime.gif',
    lagart: 'elementos/lagart (1).gif',
    oro: 'elementos/oro.gif',
    hierro: 'elementos/hierro.gif',
    cobre: 'elementos/cobre item.gif',
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
  
  // Movement speed: milliseconds per block for all units/workers (1 block per second)
  const MS_PER_BLOCK = 1000; // 1 block per second
  const COSTS = {
    minero: { madera: 8 },
    caballero: { hierro: 4, piedra: 8 },
    arquero: { madera: 8, mineral: 6, cobre: 4 },
    barracks: { mineral: 5, madera: 10, cobre: 4, hierro: 4, oro: 4 }
  };

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
  const activeWorkers = [];
  const movingUnits = [];
  const enemyUnits = [];
  const WAVE_INTERVAL_MS = 240000;
  let enemyWaveInterval = null;
  let nextWaveTimestamp = Date.now() + WAVE_INTERVAL_MS;
  let currentStructureChoice = null;
  let castleCoords = { x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) };
  let lastFrameTime = Date.now();

  function createTile(type) {
    return {
      type,
      discovered: false,
      collected: false,
      structure: null,
      structureHealth: null,
      units: { caballero: 0, arquero: 0 },
      building: false,
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
    castleCoords = { x: center.x, y: center.y };
    activeWorkers.length = 0;
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
    drawWorkers();
  }

  function getWorkerIconType(tileType) {
    if(tileType === 'forest') return 'talador';
    return 'minero';
  }

  function createWorkerTask(tile, resources = {}) {
    const workerType = getWorkerIconType(tile.type);
    activeWorkers.push({
      type: workerType,
      from: { ...castleCoords },
      to: { x: tile.x, y: tile.y },
      // timing using ms-based progress so speed is consistent
      stepProgress: 0,
      stepMs: MS_PER_BLOCK,
      phase: 'going',
      resources
    });
  }

  function scheduleTreeRegrow(tile) {
    setTimeout(() => {
      if(tile.type === 'empty' && tile.collected && !tile.structure) {
        tile.type = 'forest';
        tile.collected = false;
        addLog('Un árbol ha vuelto a crecer en el bosque.');
        if(selectedTile === tile) renderSelectedInfo();
        drawGrid();
      }
    }, 300000);
  }

  function updateWorkers(dt) {
    for(let i = activeWorkers.length - 1; i >= 0; i--) {
      const worker = activeWorkers[i];
      worker.stepProgress += dt;
      const t = Math.min(1, worker.stepProgress / worker.stepMs);
      if(worker.stepProgress >= worker.stepMs) {
        // arrival at current leg
        worker.stepProgress -= worker.stepMs;
        if(worker.phase === 'going') {
          if(worker.type === 'constructor' && worker.targetTile) {
            worker.phase = 'building';
            addLog('El constructor llegó al sitio y comienza la construcción.');
          } else {
            // mark resource as collected when worker actually reaches it
            const tile = map[worker.to.y] && map[worker.to.y][worker.to.x];
            if(tile) {
              const origType = tile.type;
              tile.collected = true;
              // only convert known resource types to empty
              if(origType === 'forest' || origType === 'rock' || origType === 'cave') {
                tile.type = 'empty';
                if(origType === 'forest') scheduleTreeRegrow(tile);
              }
            }
            worker.phase = 'returning';
            addLog(`El ${worker.type} llegó al recurso y comienza a regresar al castillo.`);
          }
        } else if(worker.phase === 'building') {
          const tile = worker.targetTile;
          if(tile && tile.type === 'empty' && !tile.structure) {
            tile.type = 'barracks';
            tile.structure = 'barracks';
            tile.structureHealth = structureHealth.barracks;
            tile.collected = true;
            tile.building = false;
            addLog('La barraca fue construida en el lugar seleccionado.');
          }
          worker.phase = 'returning';
        } else {
          if(worker.resources) {
            const gained = [];
            Object.entries(worker.resources).forEach(([key, value]) => {
              if(value > 0) {
                inventory[key] = (inventory[key] || 0) + value;
                totalCollected += value;
                gained.push(`${value} ${key}`);
              }
            });
            if(gained.length > 0) {
              addLog(`El ${worker.type} regresó con ${gained.join(', ')} al castillo.`);
              updateCounters();
              updateInventoryPanel();
              if(selectedTile && selectedTile.structure === 'castle') renderSelectedInfo();
            }
          }
          activeWorkers.splice(i, 1);
        }
      }
    }
  }

  function drawWorkers() {
    activeWorkers.forEach(worker => {
      // block-by-block: show worker at origin while going, at target while building/returning
      const posTile = (worker.phase === 'going') ? worker.from : worker.to;
      const px = posTile.x * TILE + TILE / 2;
      const py = posTile.y * TILE + TILE / 2;
      if(assetImages[worker.type]?.complete) {
        ctx.drawImage(assetImages[worker.type], px - TILE/6, py - TILE/6, TILE/3, TILE/3);
      }
    });
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
      { icon: 'oro', label: 'Oro', value: inventory.oro },
      { icon: 'hierro', label: 'Hierro', value: inventory.hierro },
      { icon: 'cobre', label: 'Cobre', value: inventory.cobre },
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
      createWorkerTask(tile, { madera: 8 });
      tile.collected = true; // reservar recurso mientras el trabajador va hacia él
      addLog('Un leñador parte hacia el árbol. El árbol permanecerá hasta que llegue el leñador.');
    } else if(tile.type === 'rock' && !tile.collected) {
      if(inventory.mineros <= 0) {
        addLog('Necesitas mineros para minar piedra. Crea mineros en el castillo.');
        return;
      }
      createWorkerTask(tile, { piedra: 10 });
      tile.collected = true; // reservar recurso mientras el trabajador va hacia él
      addLog('Un minero parte hacia la roca. La roca permanecerá hasta que llegue el minero.');
    } else if(tile.type === 'cave') {
      if(inventory.mineros <= 0) {
        addLog('Necesitas mineros para extraer de la cueva. Crea mineros en el castillo.');
        return;
      }
      const resources = {
        piedra: 4,
        mineral: 3,
        oro: Math.random() < 0.25 ? 1 : 0,
        hierro: Math.random() < 0.25 ? 1 : 0,
        cobre: Math.random() < 0.20 ? 1 : 0
      };
      createWorkerTask(tile, resources);
      addLog('Un minero parte hacia la cueva. Los recursos se sumarán cuando regrese al castillo.');
    } else {
      addLog('No hay nada que recolectar aquí.');
    }
    updateCounters();
    updateInventoryPanel();
    drawGrid();
  }

  function buildUnit(unitType) {
    if(!selectedTile || selectedTile.structure !== 'barracks') return;
    const cost = unitType === 'caballero' ? COSTS.caballero : COSTS.arquero;
    const canPay = Object.entries(cost).every(([key, amount]) => (inventory[key] || 0) >= amount);
    if(!canPay) {
      addLog('No tienes suficientes recursos para crear la unidad. Revisa los costos.');
      addLog(`Costos para ${unitType}: ${Object.entries(cost).map(([k,v])=>v+" "+k).join(', ')}`);
      return;
    }
    Object.entries(cost).forEach(([key, amount]) => inventory[key] = (inventory[key] || 0) - amount);
    selectedTile.units[unitType] += 1;
    inventory[unitType + 's'] += 1;
    spawnUnit(unitType, selectedTile);
    addLog(`Se creó un ${unitType} en la barraca. Costos: ${Object.entries(cost).map(([k,v])=>v+" "+k).join(', ')}.`);
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
      addLog('No tienes suficientes mineral, oro, hierro o cobre para reparar.');
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
    const gatherNeedsMiners = (selectedTile.type === 'rock' || selectedTile.type === 'cave') && inventory.mineros <= 0;
    if(selectedTile.type === 'forest') {
      description = 'Bosque: da madera y se consume cuando recolectas.';
      buttons = `<button class="button" onclick="window.mapActions.gather()">Recolectar madera</button>`;
    } else if(selectedTile.type === 'rock') {
      const rockNote = inventory.mineros > 0 ? 'Roca: da piedra y se consume al recolectarla.' : 'Necesitas mineros para poder extraer piedra.';
      const rockCost = 'Requiere 1 minero';
      description = rockNote;
      buttons = `<button class="button" onclick="window.mapActions.gather()" ${gatherNeedsMiners ? 'disabled' : ''}>Minar piedra (${rockCost})</button>`;
    } else if(selectedTile.type === 'cave') {
      const caveNote = inventory.mineros > 0 ? 'Cueva: da piedra infinita, mineral y a veces oro, hierro o cobre.' : 'Necesitas mineros para poder extraer de la cueva.';
      const caveCost = 'Requiere 1 minero';
      description = caveNote;
      buttons = `<button class="button" onclick="window.mapActions.gather()" ${gatherNeedsMiners ? 'disabled' : ''}>Extraer de la cueva (${caveCost})</button>`;
    } else if(selectedTile.structure === 'barracks') {
      description = 'Barracas: crea caballero y arquero. Usa recursos para construir unidades.';
      const cabCost = Object.entries(COSTS.caballero).map(([k,v])=>v+" "+k).join(', ');
      const arcCost = Object.entries(COSTS.arquero).map(([k,v])=>v+" "+k).join(', ');
      buttons = `
        <button class="button" onclick="window.mapActions.build('caballero')">Crear caballero (${cabCost})</button>
        <button class="button" onclick="window.mapActions.build('arquero')">Crear arquero (${arcCost})</button>
        <button class="button secondary" onclick="window.mapActions.repair()">Reparar estructura</button>
      `;
    } else if(selectedTile.structure === 'castle') {
      description = 'Castillo: tu base central. Repara usando mineral, oro, hierro y cobre. Aquí puedes crear mineros.';
      const minerCost = Object.entries(COSTS.minero).map(([k,v])=>v+" "+k).join(', ');
      buttons = `
        <button class="button" onclick="window.mapActions.buildMiner()">Crear minero (${minerCost})</button>
        <button class="button secondary" onclick="window.mapActions.repair()">Reparar castillo</button>
      `;
    } else if(selectedTile.type === 'empty' && canBuildBarracks(selectedTile)) {
      const building = selectedTile.building;
      description = building
        ? 'El constructor ya está en camino para construir aquí.'
        : 'Terreno vacío junto al castillo. Construye barracas para entrenar unidades.';
      const barrCost = Object.entries(COSTS.barracks).map(([k,v])=>v+" "+k).join(', ');
      buttons = `<button class="button" onclick="window.mapActions.buildBarracks()" ${building ? 'disabled' : ''}>${building ? 'Construyendo...' : 'Construir barracas ('+barrCost+')'}</button>`;
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
    const cost = COSTS.barracks;
    const canPay = Object.entries(cost).every(([key, amount]) => (inventory[key] || 0) >= amount);
    if(!canPay) {
      addLog('No tienes suficientes recursos para construir barracas. Revisa los costos.');
      addLog(`Costos para barracas: ${Object.entries(cost).map(([k,v])=>v+" "+k).join(', ')}`);
      return;
    }
    if(tile.building) {
      addLog('Ya hay un constructor en camino a ese lugar. Espera a que termine.');
      return;
    }
    Object.entries(cost).forEach(([key, amount]) => inventory[key] = (inventory[key] || 0) - amount);
    tile.building = true;
    activeWorkers.push({
      type: 'constructor',
      from: { ...castleCoords },
      to: { x: tile.x, y: tile.y },
      stepProgress: 0,
      stepMs: MS_PER_BLOCK,
      phase: 'going',
      targetTile: tile
    });
    addLog('Un constructor parte del castillo hacia el lugar de construcción.');
    updateInventoryPanel();
    renderSelectedInfo();
    drawGrid();
  }

  function buildMiner() {
    if(!selectedTile || selectedTile.structure !== 'castle') return;
    const cost = COSTS.minero;
    const canPay = Object.entries(cost).every(([key, amount]) => (inventory[key] || 0) >= amount);
    if(!canPay) {
      addLog('No tienes suficientes recursos para crear un minero. Revisa los costos.');
      addLog(`Costos para minero: ${Object.entries(cost).map(([k,v])=>v+" "+k).join(', ')}`);
      return;
    }
    Object.entries(cost).forEach(([key, amount]) => inventory[key] = (inventory[key] || 0) - amount);
    inventory.mineros += 1;
    addLog(`Creaste un minero en el castillo. Costos: ${Object.entries(cost).map(([k,v])=>v+" "+k).join(', ')}.`);
    updateInventoryPanel();
    renderSelectedInfo();
  }

  function getUnitTarget(startTile) {
    const candidates = [];
    for(let y = 0; y < ROWS; y++) {
      for(let x = 0; x < COLS; x++) {
        const tile = map[y][x];
        if(tile.discovered && (tile.x !== startTile.x || tile.y !== startTile.y)) {
          candidates.push(tile);
        }
      }
    }
    return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : startTile;
  }

  function computePath(start, target) {
    const path = [];
    let cx = start.x;
    let cy = start.y;
    while(cx !== target.x) {
      cx += cx < target.x ? 1 : -1;
      path.push({ x: cx, y: cy });
    }
    while(cy !== target.y) {
      cy += cy < target.y ? 1 : -1;
      path.push({ x: cx, y: cy });
    }
    return path;
  }

  function spawnUnit(unitType, startTile) {
    const targetTile = getUnitTarget(startTile);
    const path = computePath({ x: startTile.x, y: startTile.y }, { x: targetTile.x, y: targetTile.y });
    const msPerBlock = MS_PER_BLOCK; // unified speed: 1.5 blocks per second
    movingUnits.push({
      type: unitType,
      pos: { x: startTile.x, y: startTile.y },
      path,
      index: 0,
      stepProgress: 0,
      stepMs: msPerBlock,
      arrived: path.length === 0
    });
  }

  function getEnemySpawnTile() {
    const candidates = [];
    for(let x = 0; x < COLS; x++) {
      candidates.push({ x, y: 0 });
      candidates.push({ x, y: ROWS - 1 });
    }
    for(let y = 1; y < ROWS - 1; y++) {
      candidates.push({ x: 0, y });
      candidates.push({ x: COLS - 1, y });
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function spawnEnemyWave() {
    const waveCount = 3 + Math.floor(Math.random() * 2);
    for(let i = 0; i < waveCount; i++) {
      const spawn = getEnemySpawnTile();
      const type = i % 2 === 0 ? 'slime' : 'lagart';
      const path = computePath({ x: spawn.x, y: spawn.y }, { x: castleCoords.x, y: castleCoords.y });
      const msPerBlock = MS_PER_BLOCK; // unified speed: 1.5 blocks per second
      enemyUnits.push({
        type,
        pos: { x: spawn.x, y: spawn.y },
        path,
        index: 0,
        stepProgress: 0,
        stepMs: msPerBlock,
        arrived: path.length === 0
      });
    }
    nextWaveTimestamp = Date.now() + WAVE_INTERVAL_MS;
    addLog(`Oleada enemiga: ${waveCount} unidades (${waveCount % 2 === 0 ? 'slimes y lagarts' : 'slimes y lagart'}).`);
  }

  function updateEnemyUnits(dt) {
    for(let i = enemyUnits.length - 1; i >= 0; i--) {
      const enemy = enemyUnits[i];
      if(enemy.arrived) continue;
      if(enemy.index >= enemy.path.length) {
        enemy.arrived = true;
        // reduce castle HP by 1
        const castleTile = map[castleCoords.y] && map[castleCoords.y][castleCoords.x];
        if(castleTile && castleTile.structure === 'castle') {
          castleTile.structureHealth = Math.max(0, (castleTile.structureHealth || 0) - 1);
          addLog(`El ${enemy.type} alcanzó el castillo y le quitó 1 de vida. Salud del castillo: ${castleTile.structureHealth}/${structureHealth.castle}`);
          if(castleTile.structureHealth <= 0) addLog('El castillo ha sido destruido. Fin del juego.');
        }
        enemyUnits.splice(i, 1);
        continue;
      }
      enemy.stepProgress += dt;
      const next = enemy.path[enemy.index];
      // discrete block-by-block movement: update position only when step completes
      if(enemy.stepProgress >= enemy.stepMs) {
        enemy.pos.x = next.x;
        enemy.pos.y = next.y;
        enemy.index += 1;
        enemy.stepProgress -= enemy.stepMs;
      }
    }
  }

  function drawEnemyUnits() {
    enemyUnits.forEach(enemy => {
      const px = enemy.pos.x * TILE + TILE / 2;
      const py = enemy.pos.y * TILE + TILE / 2;
      if(assetImages[enemy.type]?.complete) {
        ctx.drawImage(assetImages[enemy.type], px - TILE/6, py - TILE/6, TILE/3, TILE/3);
      }
    });
  }

  function formatWaveTimer(ms) {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    const min = Math.floor(seconds / 60).toString().padStart(2, '0');
    const sec = (seconds % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  }

  function updateWaveTimerDisplay() {
    const timer = document.getElementById('enemy-wave-timer');
    if(!timer) return;
    const remaining = nextWaveTimestamp - Date.now();
    timer.textContent = formatWaveTimer(remaining);
  }

  function startEnemyWaves(spawnImmediate = true) {
    if(enemyWaveInterval) {
      clearInterval(enemyWaveInterval);
      enemyWaveInterval = null;
    }
    nextWaveTimestamp = Date.now() + WAVE_INTERVAL_MS;
    if(spawnImmediate) {
      spawnEnemyWave();
    }
    enemyWaveInterval = setInterval(spawnEnemyWave, WAVE_INTERVAL_MS);
  }

  function updateMovingUnits(dt) {
    movingUnits.forEach(unit => {
      if(unit.arrived) return;
      if(unit.index >= unit.path.length) {
        unit.arrived = true;
        addLog(`El ${unit.type} llegó a su destino explorado.`);
        return;
      }
      unit.stepProgress += dt;
      const next = unit.path[unit.index];
      // discrete block-by-block movement: update position only when step completes
      if(unit.stepProgress >= unit.stepMs) {
        unit.pos.x = next.x;
        unit.pos.y = next.y;
        unit.index += 1;
        unit.stepProgress -= unit.stepMs;
      }
    });
  }

  function drawMovingUnits() {
    movingUnits.forEach(unit => {
      const px = unit.pos.x * TILE + TILE / 2;
      const py = unit.pos.y * TILE + TILE / 2;
      if(assetImages[unit.type]?.complete) {
        ctx.drawImage(assetImages[unit.type], px - TILE/6, py - TILE/6, TILE/3, TILE/3);
      }
    });
  }

  function chooseStructure(type) {
    currentStructureChoice = type;
    const button = document.getElementById('choose-structure');
    if(button) {
      button.textContent = type === 'barracks' ? 'Barraca seleccionada' : 'Estructura seleccionada';
    }
    addLog('Seleccionaste la barraca como estructura para construir.');
  }

  function findBuildableBarracksTile() {
    for(let y = 0; y < ROWS; y++) {
      for(let x = 0; x < COLS; x++) {
        const tile = map[y][x];
        if(canBuildBarracks(tile)) return tile;
      }
    }
    return null;
  }

  function buildSelectedStructure() {
    if(!currentStructureChoice) {
      addLog('Primero elige una estructura para construir.');
      return;
    }
    let tile = selectedTile;
    if(currentStructureChoice === 'barracks') {
      if(!tile || !canBuildBarracks(tile)) {
        tile = findBuildableBarracksTile();
      }
      if(!tile) {
        addLog('No hay un terreno vacío junto al castillo para construir barracas. Selecciona uno o explora más.');
        return;
      }
      if(selectedTile !== tile) {
        selectTile(tile.x, tile.y);
      }
      buildBarracks(tile);
      return;
    }
    addLog('Esa estructura no está disponible.');
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
    currentStructureChoice = null;
    enemyUnits.length = 0;
    movingUnits.length = 0;
    if(enemyWaveInterval) {
      clearInterval(enemyWaveInterval);
      enemyWaveInterval = null;
    }
    nextWaveTimestamp = Date.now() + WAVE_INTERVAL_MS;
    const chooseButton = document.getElementById('choose-structure');
    if(chooseButton) chooseButton.textContent = 'Elegir barraca';
    updateCounters();
    buildMap();
    updateInventoryPanel();
    renderSelectedInfo();
    drawGrid();
    startEnemyWaves(false);
    addLog('El mapa se reinició. Tu castillo está de nuevo en el centro.');
  });
  document.getElementById('choose-structure').addEventListener('click', ()=>chooseStructure('barracks'));
  document.getElementById('build-structure').addEventListener('click', buildSelectedStructure);

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
      const now = Date.now();
      const dt = now - lastFrameTime;
      lastFrameTime = now;
      updateWorkers(dt);
      updateMovingUnits(dt);
      updateEnemyUnits(dt);
      drawGrid();
      drawMovingUnits();
      drawEnemyUnits();
      updateWaveTimerDisplay();
    }
    requestAnimationFrame(drawLoop);
  }

  buildMap();
  // Start enemy wave timer but do not spawn immediately at game start
  startEnemyWaves(false);
  updateInventoryPanel();
  renderSelectedInfo();
  updateCounters();
  drawLoop();
})();
