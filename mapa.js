// Mapa de exploración con niebla de guerra y recursos colocados aleatoriamente
(function(){
  const canvas = document.getElementById('explore-map');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');

  const TILE = 40; // tamaño en px
  const COLS = Math.floor(canvas.width / TILE);
  const ROWS = Math.floor(canvas.height / TILE);

  const assets = [
    'elementos/arbola.gif',
    'elementos/arquero.gif',
    'elementos/barraca.gif',
    'elementos/caballero.gif',
    'elementos/castillo%20(1).gif',
    'elementos/constructor.gif',
    'elementos/cueva.gif',
    'elementos/minero.gif',
    'elementos/roca.gif',
    'elementos/talador.gif'
  ];

  const images = {};
  let loaded = 0;

  assets.forEach(src => {
    const img = new Image();
    img.src = src;
    img.onload = () => { loaded++; }
    images[src] = img;
  });

  // mapa de tiles
  const map = [];
  for(let y=0;y<ROWS;y++){
    const row = [];
    for(let x=0;x<COLS;x++){
      row.push({
        discovered: false,
        resource: Math.random() < 0.12 ? assets[Math.floor(Math.random()*assets.length)] : null
      });
    }
    map.push(row);
  }

  // posicion inicial del explorador (centro)
  let explorer = { x: Math.floor(COLS/2), y: Math.floor(ROWS/2), vision: 2 };
  map[explorer.y][explorer.x].discovered = true;

  let collected = 0;

  function drawGrid(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // tiles
    for(let y=0;y<ROWS;y++){
      for(let x=0;x<COLS;x++){
        const px = x * TILE;
        const py = y * TILE;
        ctx.fillStyle = '#08202a';
        ctx.fillRect(px, py, TILE-1, TILE-1);

        const tile = map[y][x];
        if(tile.resource && tile.discovered){
          const img = images[tile.resource];
          if(img && img.complete){
            ctx.drawImage(img, px+4, py+4, TILE-8, TILE-8);
          }
        }
      }
    }

    // marcador explorador
    ctx.fillStyle = 'rgba(60,180,75,0.95)';
    ctx.beginPath();
    ctx.arc(explorer.x*TILE + TILE/2, explorer.y*TILE + TILE/2, TILE/3, 0, Math.PI*2);
    ctx.fill();

    // niebla
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    // revelar círculo por cada tile descubierto
    for(let y=0;y<ROWS;y++){
      for(let x=0;x<COLS;x++){
        if(map[y][x].discovered){
          const cx = x*TILE + TILE/2;
          const cy = y*TILE + TILE/2;
          ctx.globalCompositeOperation = 'destination-out';
          ctx.beginPath();
          ctx.arc(cx, cy, TILE*1.2, 0, Math.PI*2);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }
    ctx.restore();
  }

  function revealAround(x,y,radius=1){
    for(let dy=-radius;dy<=radius;dy++){
      for(let dx=-radius;dx<=radius;dx++){
        const nx = x+dx, ny = y+dy;
        if(nx>=0 && nx<COLS && ny>=0 && ny<ROWS){
          map[ny][nx].discovered = true;
        }
      }
    }
  }

  function moveExplorerTo(tileX,tileY){
    explorer.x = tileX; explorer.y = tileY;
    revealAround(tileX, tileY, explorer.vision);
    // recoger recurso en la casilla
    const tile = map[tileY][tileX];
    if(tile.resource){
      collected++;
      document.getElementById('collected-count').textContent = collected;
      tile.resource = null;
      addLog(`Explorador recogió un recurso en (${tileX},${tileY}).`);
    }
    drawGrid();
  }

  function addLog(msg){
    const log = document.getElementById('battle-log');
    if(!log) return;
    const now = new Date();
    const time = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    log.textContent = `${time} — ${msg}\n${log.textContent}`;
  }

  canvas.addEventListener('click', (e)=>{
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (canvas.width/rect.width);
    const cy = (e.clientY - rect.top) * (canvas.height/rect.height);
    const tx = Math.floor(cx / TILE);
    const ty = Math.floor(cy / TILE);
    if(tx>=0 && tx<COLS && ty>=0 && ty<ROWS){
      moveExplorerTo(tx, ty);
    }
  });

  document.getElementById('reveal-random').addEventListener('click', ()=>{
    const rx = Math.floor(Math.random()*COLS);
    const ry = Math.floor(Math.random()*ROWS);
    moveExplorerTo(rx, ry);
  });

  document.getElementById('reset-map').addEventListener('click', ()=>{
    for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++){
      map[y][x].discovered = false;
      map[y][x].resource = Math.random() < 0.12 ? assets[Math.floor(Math.random()*assets.length)] : null;
    }
    explorer = { x: Math.floor(COLS/2), y: Math.floor(ROWS/2), vision: 2 };
    collected = 0; document.getElementById('collected-count').textContent = collected;
    map[explorer.y][explorer.x].discovered = true;
    drawGrid();
  });

  // wait for images to load a bit before drawing
  const waitInterval = setInterval(()=>{
    if(loaded >= Math.max(4, assets.length/3)){
      clearInterval(waitInterval);
      revealAround(explorer.x, explorer.y, explorer.vision);
      drawGrid();
    }
  }, 120);

})();
