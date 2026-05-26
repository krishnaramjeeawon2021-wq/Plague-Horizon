(function () {
  var MAX_LIVES = 3;
  var START_AMMO = 30;
  var MAX_AMMO = 99;
  var AMMO_DROP_CHANCE = 0.78;
  var AMMO_PICKUP = 10;
  var FIRE_COOLDOWN_MS = 180;
  var INVINCIBLE_MS = 1600;
  var HIT_COOLDOWN_MS = 900;
  var SPAWN_INTERVAL_MS = 2600;
  var ZOMBIE_BASE_HP = 2;

  var canvas, ctx, hud, overlay, overlayTitle, overlayText, overlayBtn;
  var zombieImg;
  var playerImg;
  var backgroundImg;
  var backgroundReady = false;
  var running = false;
  var paused = false;
  var lastTime = 0;
  var spawnTimer = 0;
  var fireTimer = 0;
  var hitCooldown = 0;
  var invincibleUntil = 0;
  var elapsedSeconds = 0;
  var wave = 1;
  var score = 0;
  var keys = {};
  var mouse = { x: 0, y: 0, down: false, active: false };
  var HIGHSCORE_STORAGE_KEY = "phHighscores";

  var player, bullets, zombies, pickups, floatTexts, obstacles;

  function init() {
    canvas = document.getElementById("game-canvas");
    if (!canvas) return false;
    ctx = canvas.getContext("2d");
    hud = document.getElementById("game-hud");
    overlay = document.getElementById("game-overlay");
    overlayTitle = document.getElementById("overlay-title");
    overlayText = document.getElementById("overlay-text");
    overlayBtn = document.getElementById("overlay-btn");

    zombieImg = new Image();
    zombieImg.src = "zombie sprite.png";

    playerImg = new Image();
    playerImg.src = "person with gun.png";


    backgroundImg = new Image();
    backgroundImg.onload = function () {
      backgroundReady = true;
    };
    backgroundImg.onerror = function () {
      backgroundImg.onerror = function () {
        backgroundReady = false;
      };
      backgroundImg.src = "background.png";
    };
    backgroundImg.src = "background.jpg";

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    bindInput();
    if (overlayBtn) {
      overlayBtn.addEventListener("click", function () {
        if (running && !paused) return;
        startGame();
      });
    }
    showOverlay("Plague Horizon", "Survive the horde. Zombies drop ammo when they fall.", "Start game");
    return true;
  }

  function resizeCanvas() {
    var wrap = canvas.parentElement;
    var w = Math.min(900, wrap.clientWidth - 2);
    var h = Math.max(420, Math.min(520, window.innerHeight * 0.55));
    canvas.width = w;
    canvas.height = h;
    if (player) {
      player.x = Math.min(player.x, w - player.r);
      player.y = Math.min(player.y, h - player.r);
    }
  }

  function bindInput() {
    window.addEventListener("keydown", function (e) {
      keys[e.code] = true;
      if (e.code === "Space") e.preventDefault();
      if (e.code === "KeyP" && running) paused = !paused;
    });
    window.addEventListener("keyup", function (e) {
      keys[e.code] = false;
    });
    canvas.addEventListener("mousemove", function (e) {
      var rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      mouse.y = ((e.clientY - rect.top) / rect.height) * canvas.height;
      mouse.active = true;
    });
    canvas.addEventListener("mousedown", function () {
      mouse.down = true;
    });
    window.addEventListener("mouseup", function () {
      mouse.down = false;
    });
    canvas.addEventListener("mouseleave", function () {
      mouse.down = false;
    });
  }

  function resetState() {
    var cx = canvas.width / 2;
    var cy = canvas.height / 2;
    player = {
      x: cx,
      y: cy,
      r: 16,
      speed: 3.8,
      lives: MAX_LIVES,
      ammo: START_AMMO,
      angle: 0,
    };
    bullets = [];
    zombies = [];
    pickups = [];
    floatTexts = [];
    obstacles = createObstacles(canvas.width, canvas.height);
    score = 0;
    wave = 1;
    spawnTimer = 0;
    fireTimer = 0;
    hitCooldown = 0;
    invincibleUntil = 0;
    elapsedSeconds = 0;
    lastTime = performance.now();
  }

  function startGame() {
    resetState();
    running = true;
    paused = false;
    hideOverlay();
    if (hud) hud.hidden = false;
    requestAnimationFrame(loop);
  }

  function endGame() {
    running = false;
    saveHighscore();
    showOverlay(
      "Game over",
      "Score: " + score + " · Wave " + wave + " · Time " + formatTime(elapsedSeconds),
      "Play again"
    );
  }

  function showOverlay(title, text, btnLabel) {
    if (overlay) overlay.hidden = false;
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayText) overlayText.textContent = text;
    if (overlayBtn) overlayBtn.textContent = btnLabel;
  }

  function formatTime(seconds) {
    var mins = Math.floor(seconds / 60);
    var secs = Math.round(seconds % 60);
    return mins + ":" + (secs < 10 ? "0" : "") + secs;
  }

  function loadHighscores() {
    try {
      var raw = localStorage.getItem(HIGHSCORE_STORAGE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveHighscore() {
    var userName = "Guest";
    if (window.PHAuth && typeof window.PHAuth.getUser === "function") {
      var user = window.PHAuth.getUser();
      if (user && user.username) {
        userName = user.username;
      }
    }
    var entry = {
      player: userName,
      score: score,
      wave: wave,
      time: Math.round(elapsedSeconds),
      createdAt: Date.now(),
    };
    var records = loadHighscores();
    records.push(entry);
    records.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (b.wave !== a.wave) return b.wave - a.wave;
      return b.time - a.time;
    });
    localStorage.setItem(HIGHSCORE_STORAGE_KEY, JSON.stringify(records.slice(0, 20)));
  }

  function hideOverlay() {
    if (overlay) overlay.hidden = true;
  }

  function updateHud() {
    if (!hud) return;
    var livesEl = document.getElementById("hud-lives");
    var ammoEl = document.getElementById("hud-ammo");
    var scoreEl = document.getElementById("hud-score");
    var waveEl = document.getElementById("hud-wave");
    if (livesEl) {
      livesEl.textContent = "";
      for (var i = 0; i < MAX_LIVES; i++) {
        var heart = document.createElement("span");
        heart.className = "life-heart" + (i < player.lives ? " life-heart--full" : "");
        heart.setAttribute("aria-hidden", "true");
        livesEl.appendChild(heart);
      }
    }
    if (ammoEl) ammoEl.textContent = String(player.ammo);
    if (scoreEl) scoreEl.textContent = String(score);
    if (waveEl) waveEl.textContent = String(wave);
    var timeEl = document.getElementById("hud-time");
    if (timeEl) timeEl.textContent = formatTime(elapsedSeconds);
  }

  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    var dt = Math.min(32, now - lastTime);
    lastTime = now;
    if (!paused) {
      update(dt);
    }
    draw();
    updateHud();
  }

  function update(dt) {
    var sec = dt / 1000;
    elapsedSeconds += sec;
    if (hitCooldown > 0) hitCooldown -= dt;
    if (fireTimer > 0) fireTimer -= dt;

    movePlayer(sec);
    tryFire();
    updateBullets(sec);
    updateZombies(sec);
    updatePickups(sec);
    updateFloatTexts(sec);
    checkCollisions();
    spawnZombies(dt);

    if (score > wave * 120) wave++;

    if (player.lives <= 0) endGame();
  }

  function movePlayer(sec) {
    var dx = 0;
    var dy = 0;
    if (keys.ArrowLeft || keys.KeyA) dx -= 1;
    if (keys.ArrowRight || keys.KeyD) dx += 1;
    if (keys.ArrowUp || keys.KeyW) dy -= 1;
    if (keys.ArrowDown || keys.KeyS) dy += 1;
    if (dx !== 0 || dy !== 0) {
      var len = Math.hypot(dx, dy) || 1;
      player.x += (dx / len) * player.speed * sec * 60;
      player.y += (dy / len) * player.speed * sec * 60;
    }
    if (mouse.active) {
      player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    }
    player.x = clamp(player.x, player.r, canvas.width - player.r);
    player.y = clamp(player.y, player.r, canvas.height - player.r);
    resolvePlayerObstacleCollision();
  }

  function tryFire() {
    var wantsFire = mouse.down || keys.Space;
    if (!wantsFire || fireTimer > 0) return;
    if (player.ammo <= 0) {
      addFloatText(player.x, player.y - 24, "No ammo!", "#ff4d6d");
      return;
    }
    player.ammo--;
    fireTimer = FIRE_COOLDOWN_MS;
    var speed = 11;
    bullets.push({
      x: player.x + Math.cos(player.angle) * (player.r + 4),
      y: player.y + Math.sin(player.angle) * (player.r + 4),
      vx: Math.cos(player.angle) * speed,
      vy: Math.sin(player.angle) * speed,
      r: 4,
      life: 1200,
    });
  }

  function updateBullets(sec) {
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.x += b.vx * sec * 60;
      b.y += b.vy * sec * 60;
      b.life -= sec * 1000;
      if (isBulletBlockedByObstacle(b) ||
        b.life <= 0 ||
        b.x < -20 ||
        b.x > canvas.width + 20 ||
        b.y < -20 ||
        b.y > canvas.height + 20
      ) {
        bullets.splice(i, 1);
      }
    }
  }

  function spawnZombies(dt) {
    spawnTimer += dt;
    var interval = Math.max(700, SPAWN_INTERVAL_MS - wave * 80);
    if (spawnTimer < interval) return;
    spawnTimer = 0;
    if (zombies.length >= Math.floor(6 + wave * 1.5)) return;

    var edge = Math.floor(Math.random() * 4);
    var x, y;
    var pad = 30;
    if (edge === 0) {
      x = Math.random() * canvas.width;
      y = -pad;
    } else if (edge === 1) {
      x = canvas.width + pad;
      y = Math.random() * canvas.height;
    } else if (edge === 2) {
      x = Math.random() * canvas.width;
      y = canvas.height + pad;
    } else {
      x = -pad;
      y = Math.random() * canvas.height;
    }

    zombies.push({
      x: x,
      y: y,
      r: 18,
      hp: ZOMBIE_BASE_HP + Math.floor(wave / 3),
      speed: 0.95 + wave * 0.07 + Math.random() * 0.3,
      touchDamage: true,
    });
  }

  function updateZombies(sec) {
    for (var i = 0; i < zombies.length; i++) {
      var z = zombies[i];
      var dx = player.x - z.x;
      var dy = player.y - z.y;
      var dist = Math.hypot(dx, dy) || 1;
      z.x += (dx / dist) * z.speed * sec * 60;
      z.y += (dy / dist) * z.speed * sec * 60;
      resolveCircleObstacleCollision(z, 18);
    }
  }

  function updatePickups(sec) {
    for (var i = pickups.length - 1; i >= 0; i--) {
      var p = pickups[i];
      p.t += sec * 1000;
      p.pulse = Math.sin(p.t * 0.008) * 2;
      if (Math.hypot(player.x - p.x, player.y - p.y) < player.r + p.r + 4) {
        player.ammo = Math.min(MAX_AMMO, player.ammo + p.amount);
        addFloatText(p.x, p.y, "+" + p.amount + " ammo", "#3dff9a");
        pickups.splice(i, 1);
      }
    }
  }

  function updateFloatTexts(sec) {
    for (var i = floatTexts.length - 1; i >= 0; i--) {
      var t = floatTexts[i];
      t.y -= sec * 40;
      t.life -= sec * 1000;
      if (t.life <= 0) floatTexts.splice(i, 1);
    }
  }

  function checkCollisions() {
    for (var bi = bullets.length - 1; bi >= 0; bi--) {
      var b = bullets[bi];
      for (var zi = zombies.length - 1; zi >= 0; zi--) {
        var z = zombies[zi];
        if (circleHit(b.x, b.y, b.r, z.x, z.y, z.r)) {
          bullets.splice(bi, 1);
          z.hp--;
          if (z.hp <= 0) killZombie(z, zi);
          break;
        }
      }
    }

    if (hitCooldown > 0 || performance.now() < invincibleUntil) return;

    for (var j = zombies.length - 1; j >= 0; j--) {
      var zomb = zombies[j];
      if (circleHit(player.x, player.y, player.r, zomb.x, zomb.y, zomb.r)) {
        player.lives--;
        hitCooldown = HIT_COOLDOWN_MS;
        invincibleUntil = performance.now() + INVINCIBLE_MS;
        addFloatText(player.x, player.y - 20, "Hit!", "#ff4d6d");
        zombies.splice(j, 1);
        if (player.lives <= 0) return;
        break;
      }
    }
  }

  function killZombie(z, index) {
    zombies.splice(index, 1);
    score += 10;
    if (Math.random() < AMMO_DROP_CHANCE) {
      pickups.push({
        x: z.x,
        y: z.y,
        r: 12,
        amount: AMMO_PICKUP,
        t: 0,
        pulse: 0,
      });
    }
  }

  function addFloatText(x, y, text, color) {
    floatTexts.push({ x: x, y: y, text: text, color: color, life: 900 });
  }

  function circleHit(x1, y1, r1, x2, y2, r2) {
    return Math.hypot(x1 - x2, y1 - y2) < r1 + r2;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function draw() {
    var w = canvas.width;
    var h = canvas.height;
    drawRoadBackground(w, h);

    drawGrid(w, h);
    drawObstacles();

    for (var i = 0; i < pickups.length; i++) {
      drawPickup(pickups[i]);
    }
    for (var j = 0; j < zombies.length; j++) {
      drawZombie(zombies[j]);
    }
    for (var k = 0; k < bullets.length; k++) {
      drawBullet(bullets[k]);
    }
    drawPlayer();

    for (var t = 0; t < floatTexts.length; t++) {
      var ft = floatTexts[t];
      ctx.fillStyle = ft.color;
      ctx.font = "bold 14px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(ft.text, ft.x, ft.y);
    }

    if (paused) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#e8ecf4";
      ctx.font = "bold 22px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Paused (P to resume)", w / 2, h / 2);
    }

    if (player.ammo <= 5) {
      ctx.fillStyle = "rgba(255, 77, 109, 0.85)";
      ctx.font = "600 13px Segoe UI, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Low ammo — kill zombies for drops!", 12, h - 14);
    }
  }

  function drawRoadBackground(w, h) {
    if (backgroundImg && backgroundReady) {
      // cover the canvas while preserving aspect ratio (cover)
      var iw = backgroundImg.naturalWidth;
      var ih = backgroundImg.naturalHeight;
      var scale = Math.max(w / iw, h / ih);
      var sw = Math.round(w / scale);
      var sh = Math.round(h / scale);
      var sx = Math.max(0, Math.floor((iw - sw) / 2));
      var sy = Math.max(0, Math.floor((ih - sh) / 2));
      try {
        ctx.drawImage(backgroundImg, sx, sy, sw, sh, 0, 0, w, h);
      } catch (e) {
        // fallback to procedural if drawImage fails for any reason
        backgroundReady = false;
      }
      return;
    }

    // procedural fallback (asphalt + lane markings)
    ctx.fillStyle = "#111215";
    ctx.fillRect(0, 0, w, h);

    var roadH = Math.max(120, Math.floor(h * 0.28));
    var roadY = Math.round((h - roadH) / 2);
    ctx.fillStyle = "#2f3438"; // asphalt
    ctx.fillRect(0, roadY, w, roadH);

    var roadW = Math.max(140, Math.floor(w * 0.28));
    var roadX = Math.round((w - roadW) / 2);
    ctx.fillRect(roadX, 0, roadW, h);

    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 14]);
    ctx.beginPath();
    ctx.moveTo(0, roadY + roadH / 2);
    ctx.lineTo(w, roadY + roadH / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(roadX + roadW / 2, 0);
    ctx.lineTo(roadX + roadW / 2, h);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    var cx = Math.round(w / 2);
    var cw = 10;
    for (var i = -6; i <= 6; i++) {
      ctx.fillRect(cx + i * (cw * 2), roadY + roadH / 2 - 18, cw, 12);
    }

    ctx.fillStyle = "rgba(220,220,220,0.04)";
    ctx.fillRect(0, roadY - 14, w, 8);
    ctx.fillRect(0, roadY + roadH + 6, w, 8);
    ctx.fillRect(roadX - 14, 0, 8, h);
    ctx.fillRect(roadX + roadW + 6, 0, 8, h);
  }

  function drawGrid(w, h) {
    ctx.strokeStyle = "rgba(0, 229, 255, 0.06)";
    ctx.lineWidth = 1;
    for (var x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (var y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  function createObstacles(w, h) {
    // Obstacles disabled
    return [];
  }

  function drawObstacles() {
    // Drawing of obstacles disabled
    return;
  }

  function resolveCircleObstacleCollision(circle, radius) {
    // Obstacle collisions disabled
    return;
  }

  function resolvePlayerObstacleCollision() {
    // Disabled: player can move freely without obstacle collisions
    return;
  }

  function isBulletBlockedByObstacle(bullet) {
    // Bullets are not blocked by obstacles
    return false;
  }

  function drawPlayer() {
    var blink = performance.now() < invincibleUntil && Math.floor(performance.now() / 120) % 2 === 0;
    if (blink) ctx.globalAlpha = 0.45;

    ctx.save();
    ctx.translate(player.x, player.y);
    var size = player.r * 3.5;
    if (playerImg && playerImg.complete && playerImg.naturalWidth) {
      var facingLeft = Math.cos(player.angle) < 0;
      if (facingLeft) {
        ctx.scale(-1, 1);
      }
      ctx.drawImage(playerImg, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = "#00e5ff";
      ctx.beginPath();
      ctx.arc(0, 0, player.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0b0d12";
      ctx.fillRect(4, -4, 14, 8);
    }
    ctx.restore();

    ctx.globalAlpha = 1;
  }

  function drawBullet(b) {
    ctx.fillStyle = "#ffe566";
    ctx.shadowColor = "#ffe566";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawZombie(z) {
    var size = z.r * 2;
    if (zombieImg.complete && zombieImg.naturalWidth) {
      ctx.drawImage(zombieImg, z.x - z.r, z.y - z.r, size, size);
    } else {
      ctx.fillStyle = "#3dff9a";
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (z.hp > 1) {
      ctx.fillStyle = "#ff4d6d";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(z.hp), z.x, z.y - z.r - 6);
    }
  }

  function drawPickup(p) {
    var r = p.r + p.pulse;
    ctx.fillStyle = "rgba(255, 230, 102, 0.25)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe566";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("AMMO", p.x, p.y);
    ctx.textBaseline = "alphabetic";
  }

  window.PHGame = {
    init: init,
    start: startGame,
  };
})();