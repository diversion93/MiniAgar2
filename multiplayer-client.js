// Multiplayer MiniAgar Client
class MultiplayerAgar {
    constructor() {
        // Game state
        this.gameState = 'menu'; // 'menu', 'connecting', 'playing', 'paused', 'gameOver'
        this.gameStartTime = 0;
        this.lastFrameTime = 0;
        this.animationId = null;
        
        // World settings
        this.worldWidth = 2000;
        this.worldHeight = 2000;
        this.maxZoom = null;
        
        // Network
        this.socket = null;
        this.playerId = null;
        this.connected = false;
        this.lastServerUpdate = 0;
        
        // Local player data (for immediate feedback)
        this.localPlayer = null;
        this.localInput = { targetX: 0, targetY: 0 };
        this.lastInputSent = 0;
        
        // Game entities (from server)
        this.players = [];
        this.bots = [];
        this.food = [];
        this.viruses = [];
        
        // Input handling
        this.keys = {};
        this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0 };
        
        // Touch handling (same as singleplayer)
        this.touch = {
            active: false,
            x: 0,
            y: 0,
            worldX: 0,
            worldY: 0,
            startX: 0,
            startY: 0
        };
        
        // Mobile controls (same as singleplayer)
        this.mobileControls = {
            joystickMode: false,
            joystickActive: false,
            joystickCenter: { x: 0, y: 0 },
            joystickRadius: 60,
            joystickDeadzone: 8,
            sensitivity: 1.2,
            smoothing: 0.15,
            lastTouchTime: 0,
            touchVelocity: { x: 0, y: 0 },
            hapticEnabled: true,
            visualFeedback: true
        };
        
        // Camera
        this.camera = { x: 0, y: 0, zoom: 1 };
        
        // Performance
        this.fps = 60;
        this.frameCount = 0;
        
        // Initialize canvas and context
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.minimap = document.getElementById('minimap');
        this.minimapCtx = this.minimap.getContext('2d');
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize socket connection
        this.initializeSocket();
    }
    
    initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Server Connect:', { timestamp: Date.now(), status: 'connected' });
            this.connected = true;
            this.hideConnectionStatus();
        });
        
        this.socket.on('disconnect', () => {
            console.log('Server Disconnect:', { timestamp: Date.now(), status: 'disconnected' });
            this.connected = false;
            this.showConnectionStatus('Verbindung verloren...');
        });
        
        this.socket.on('gameJoined', (data) => {
            console.log('Server GameJoined:', { 
                playerId: data.playerId, 
                worldSize: `${data.worldWidth}x${data.worldHeight}`,
                timestamp: Date.now() 
            });
            this.playerId = data.playerId;
            this.worldWidth = data.worldWidth;
            this.worldHeight = data.worldHeight;
        });
        
        this.socket.on('gameState', (data) => {
            console.log('Server Update:', { 
                players: data.players.length, 
                food: data.food.length, 
                timestamp: data.timestamp 
            });
            this.handleServerUpdate(data);
        });
        
        this.socket.on('connect_error', (error) => {
            console.log('Server Error:', { error: error.message, timestamp: Date.now() });
            this.showConnectionStatus('Verbindungsfehler');
        });
    }
    
    handleServerUpdate(data) {
        this.lastServerUpdate = Date.now();
        
        // Update game entities
        this.players = data.players || [];
        this.bots = data.bots || [];
        this.food = data.food || [];
        this.viruses = data.viruses || [];
        
        // Find and update local player
        this.localPlayer = this.players.find(p => p.id === this.playerId);
        
        // Update UI
        this.updateUI();
    }
    
    resizeCanvas() {
        const displayWidth = window.innerWidth;
        const displayHeight = window.innerHeight;
        
        this.canvas.width = displayWidth;
        this.canvas.height = displayHeight;
        
        this.canvas.style.width = displayWidth + 'px';
        this.canvas.style.height = displayHeight + 'px';
        
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
    }
    
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
            this.updateMouseWorldPosition();
        });
        
        // Keyboard events
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            this.handleKeyPress(e);
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        
        // UI events
        document.getElementById('startButton').addEventListener('click', () => {
            const playerName = document.getElementById('playerName').value.trim() || 'Spieler';
            this.joinGame(playerName);
        });
        
        document.getElementById('playerName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const playerName = e.target.value.trim() || 'Spieler';
                this.joinGame(playerName);
            }
        });
        
        // Pause menu events
        document.getElementById('resumeButton').addEventListener('click', () => this.resumeGame());
        document.getElementById('restartButton').addEventListener('click', () => this.restartGame());
        document.getElementById('mainMenuButton').addEventListener('click', () => this.showStartScreen());
        
        // Game over events
        document.getElementById('playAgainButton').addEventListener('click', () => this.restartGame());
        document.getElementById('backToMenuButton').addEventListener('click', () => this.showStartScreen());
        
        // Setup mobile controls
        this.setupMobileControls();
    }
    
    handleKeyPress(e) {
        switch (e.code) {
            case 'Escape':
                if (this.gameState === 'playing') {
                    this.pauseGame();
                } else if (this.gameState === 'paused') {
                    this.resumeGame();
                }
                break;
            case 'KeyR':
                if (this.gameState === 'gameOver') {
                    this.restartGame();
                }
                break;
            case 'KeyW':
                if (this.gameState === 'playing' && this.localPlayer && this.localPlayer.alive) {
                    this.ejectMass();
                }
                break;
            case 'Space':
                e.preventDefault();
                if (this.gameState === 'playing' && this.localPlayer && this.localPlayer.alive) {
                    this.splitPlayer();
                }
                break;
            case 'KeyC':
                if (this.gameState === 'playing' && this.localPlayer && this.localPlayer.alive) {
                    this.applyMassCheat();
                }
                break;
        }
    }
    
    splitPlayer() {
        if (this.socket && this.connected) {
            this.socket.emit('playerSplit');
        }
    }
    
    ejectMass() {
        if (this.socket && this.connected) {
            this.socket.emit('playerEject');
        }
    }
    
    applyMassCheat() {
        if (this.socket && this.connected) {
            this.socket.emit('playerMassCheat');
            
            // Create visual feedback with green particles
            this.createSplitParticles(this.localPlayer.x, this.localPlayer.y, '#00ff00');
            
            console.log('Mass cheat applied: +50 mass');
        }
    }
    
    createSplitParticles(x, y, color) {
        // Create particle effect for visual feedback
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const particle = {
                x: x + Math.cos(angle) * 15,
                y: y + Math.sin(angle) * 15,
                vx: Math.cos(angle) * 150,
                vy: Math.sin(angle) * 150,
                color: color,
                life: 0.8,
                maxLife: 0.8,
                size: 3,
                update: function(deltaTime) {
                    this.x += this.vx * deltaTime;
                    this.y += this.vy * deltaTime;
                    this.vx *= 0.98;
                    this.vy *= 0.98;
                    this.life -= deltaTime;
                },
                render: function(ctx) {
                    if (this.life <= 0) return;
                    const alpha = this.life / this.maxLife;
                    const currentSize = this.size * alpha;
                    ctx.fillStyle = this.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, currentSize, 0, Math.PI * 2);
                    ctx.fill();
                }
            };
            
            // Add to particles array if it exists, otherwise create it
            if (!this.particles) this.particles = [];
            this.particles.push(particle);
        }
    }
    
    updateMouseWorldPosition() {
        if (!this.localPlayer) return;
        
        const displayWidth = window.innerWidth;
        const displayHeight = window.innerHeight;
        
        const newWorldX = (this.mouse.x - displayWidth / 2) / this.camera.zoom + this.camera.x;
        const newWorldY = (this.mouse.y - displayHeight / 2) / this.camera.zoom + this.camera.y;
        
        if (this.mouse.worldX === undefined) {
            this.mouse.worldX = newWorldX;
            this.mouse.worldY = newWorldY;
            return;
        }
        
        const deltaX = newWorldX - this.mouse.worldX;
        const deltaY = newWorldY - this.mouse.worldY;
        const deltaDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        const deadzone = 2.0;
        
        if (deltaDistance > deadzone) {
            const smoothingFactor = 0.3;
            this.mouse.worldX += deltaX * smoothingFactor;
            this.mouse.worldY += deltaY * smoothingFactor;
        }
        
        // Update local input for immediate feedback
        this.localInput.targetX = this.mouse.worldX;
        this.localInput.targetY = this.mouse.worldY;
        
        // Send input to server (throttled)
        this.sendInputToServer();
    }
    
    sendInputToServer() {
        const currentTime = Date.now();
        if (currentTime - this.lastInputSent > 16 && this.socket && this.connected) { // ~60fps
            this.socket.emit('playerInput', {
                targetX: this.localInput.targetX,
                targetY: this.localInput.targetY
            });
            this.lastInputSent = currentTime;
        }
    }
    
    joinGame(playerName) {
        if (!this.socket || !this.connected) {
            this.showConnectionStatus('Verbindung wird hergestellt...');
            return;
        }
        
        this.gameState = 'connecting';
        this.showConnectionStatus('Spiel wird beigetreten...');
        
        this.socket.emit('joinGame', { name: playerName });
        
        // Wait for game joined confirmation
        setTimeout(() => {
            if (this.playerId) {
                this.gameState = 'playing';
                this.gameStartTime = Date.now();
                document.getElementById('playerNameDisplay').textContent = playerName;
                this.showGameScreen();
                this.hideConnectionStatus();
                this.gameLoop();
            }
        }, 1000);
    }
    
    gameLoop() {
        if (this.gameState !== 'playing') {
            this.animationId = null;
            return;
        }
        
        const currentTime = performance.now();
        const deltaTime = Math.min((currentTime - this.lastFrameTime) / 1000, 1/30);
        this.lastFrameTime = currentTime;
        
        this.frameCount++;
        if (this.frameCount % 60 === 0) {
            this.fps = Math.round(1 / deltaTime);
            document.getElementById('fpsDisplay').textContent = `FPS: ${this.fps}`;
        }
        
        this.update(deltaTime);
        this.render();
        
        this.animationId = requestAnimationFrame(() => this.gameLoop());
    }
    
    update(deltaTime) {
        // Apply local prediction for immediate feedback
        this.applyLocalPrediction(deltaTime);
        
        // Update particles
        if (this.particles) {
            this.particles = this.particles.filter(particle => {
                particle.update(deltaTime);
                return particle.life > 0;
            });
        }
        
        // Update camera
        this.updateCamera();
        
        // Update mobile controls
        this.updateVirtualButtonStates();
        
        // Check game over
        this.checkGameOver();
    }
    
    applyLocalPrediction(deltaTime) {
        if (!this.localPlayer || !this.localPlayer.alive) return;
        
        // Apply immediate local movement for responsive feel
        const dx = this.localInput.targetX - this.localPlayer.x;
        const dy = this.localInput.targetY - this.localPlayer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 8) {
            const speed = 2 / Math.sqrt(this.localPlayer.mass / 100);
            const targetVx = (dx / distance) * speed;
            const targetVy = (dy / distance) * speed;
            
            // Apply smooth local movement
            const smoothing = 0.25;
            if (!this.localPlayer.vx) this.localPlayer.vx = 0;
            if (!this.localPlayer.vy) this.localPlayer.vy = 0;
            
            this.localPlayer.vx += (targetVx - this.localPlayer.vx) * smoothing;
            this.localPlayer.vy += (targetVy - this.localPlayer.vy) * smoothing;
            
            // Apply local position update for immediate feedback
            this.localPlayer.x += this.localPlayer.vx * deltaTime * 60;
            this.localPlayer.y += this.localPlayer.vy * deltaTime * 60;
            
            // Keep in bounds
            this.localPlayer.x = Math.max(this.localPlayer.radius, Math.min(this.worldWidth - this.localPlayer.radius, this.localPlayer.x));
            this.localPlayer.y = Math.max(this.localPlayer.radius, Math.min(this.worldHeight - this.localPlayer.radius, this.localPlayer.y));
        }
    }
    
    updateCamera() {
        if (!this.localPlayer || !this.localPlayer.alive) return;
        
        if (this.maxZoom === null) {
            const worldAspectRatio = this.worldWidth / this.worldHeight;
            const screenAspectRatio = this.canvas.width / this.canvas.height;
            
            if (worldAspectRatio > screenAspectRatio) {
                this.maxZoom = this.canvas.width / this.worldWidth;
            } else {
                this.maxZoom = this.canvas.height / this.worldHeight;
            }
        }
        
        const cameraSmoothing = 0.15;
        const targetX = this.localPlayer.x;
        const targetY = this.localPlayer.y;
        
        if (this.camera.x === undefined || this.camera.y === undefined) {
            this.camera.x = targetX;
            this.camera.y = targetY;
        }
        
        this.camera.x += (targetX - this.camera.x) * cameraSmoothing;
        this.camera.y += (targetY - this.camera.y) * cameraSmoothing;
        
        const baseZoom = 1;
        let targetZoom = baseZoom * Math.max(0.5, Math.min(2, 50 / this.localPlayer.radius));
        
        if (targetZoom < this.maxZoom) {
            targetZoom = this.maxZoom;
        }
        
        if (this.camera.zoom === undefined) {
            this.camera.zoom = targetZoom;
        }
        
        const zoomSmoothing = 0.1;
        this.camera.zoom += (targetZoom - this.camera.zoom) * zoomSmoothing;
    }
    
    updateUI() {
        if (!this.localPlayer) return;
        
        document.getElementById('scoreDisplay').textContent = Math.round(this.localPlayer.score || 0);
        document.getElementById('massDisplay').textContent = Math.round(this.localPlayer.mass || 0);
        document.getElementById('playerCountDisplay').textContent = this.players.length;
        
        const gameTime = Math.floor((Date.now() - this.gameStartTime) / 1000);
        const minutes = Math.floor(gameTime / 60);
        const seconds = gameTime % 60;
        document.getElementById('timeDisplay').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        this.updateLeaderboard();
    }
    
    updateLeaderboard() {
        const allCells = [...this.players, ...this.bots].sort((a, b) => (b.mass || 0) - (a.mass || 0));
        const leaderboardList = document.getElementById('leaderboardList');
        leaderboardList.innerHTML = '';
        
        const topCells = allCells.slice(0, 5);
        
        topCells.forEach((cell, index) => {
            const item = document.createElement('div');
            item.className = `leaderboard-item ${cell.id === this.playerId ? 'player' : 'bot'}`;
            
            const rank = document.createElement('span');
            rank.className = 'leaderboard-rank';
            rank.textContent = `${index + 1}.`;
            
            const name = document.createElement('span');
            name.textContent = cell.name || 'Player';
            
            const mass = document.createElement('span');
            mass.textContent = Math.round(cell.mass || 0);
            
            item.appendChild(rank);
            item.appendChild(name);
            item.appendChild(mass);
            leaderboardList.appendChild(item);
        });
    }
    
    checkGameOver() {
        if (!this.localPlayer || this.localPlayer.alive) return;
        
        this.gameState = 'gameOver';
        
        const gameTime = Math.floor((Date.now() - this.gameStartTime) / 1000);
        const minutes = Math.floor(gameTime / 60);
        const seconds = gameTime % 60;
        
        document.getElementById('finalScore').textContent = Math.round(this.localPlayer.score || 0);
        document.getElementById('finalTime').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('finalMass').textContent = Math.round(this.localPlayer.mass || 0);
        document.getElementById('playersKilled').textContent = Math.floor((this.localPlayer.score || 0) / 50);
        
        setTimeout(() => this.showGameOverScreen(), 1000);
    }
    
    render() {
        // Clear canvas
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (!this.localPlayer) return;
        
        this.ctx.save();
        
        const displayWidth = window.innerWidth;
        const displayHeight = window.innerHeight;
        
        this.ctx.translate(displayWidth / 2, displayHeight / 2);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        this.ctx.translate(-this.camera.x, -this.camera.y);
        
        // Draw grid
        this.drawGrid();
        
        // Draw food
        this.food.forEach(food => this.renderFood(food));
        
        // Draw viruses
        this.viruses.forEach(virus => this.renderVirus(virus));
        
        // Draw particles
        if (this.particles) {
            this.particles.forEach(particle => particle.render(this.ctx));
        }
        
        // Draw players and bots
        const allCells = [...this.players, ...this.bots].sort((a, b) => (a.radius || 0) - (b.radius || 0));
        allCells.forEach(cell => this.renderPlayer(cell));
        
        this.ctx.restore();
        
        // Draw minimap
        this.renderMinimap();
    }
    
    drawGrid() {
        const gridSize = 50;
        const startX = Math.floor((this.camera.x - this.canvas.width / 2 / this.camera.zoom) / gridSize) * gridSize;
        const endX = Math.ceil((this.camera.x + this.canvas.width / 2 / this.camera.zoom) / gridSize) * gridSize;
        const startY = Math.floor((this.camera.y - this.canvas.height / 2 / this.camera.zoom) / gridSize) * gridSize;
        const endY = Math.ceil((this.camera.y + this.canvas.height / 2 / this.camera.zoom) / gridSize) * gridSize;
        
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1 / this.camera.zoom;
        
        this.ctx.beginPath();
        for (let x = startX; x <= endX; x += gridSize) {
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, endY);
        }
        for (let y = startY; y <= endY; y += gridSize) {
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
        }
        this.ctx.stroke();
    }
    
    renderFood(food) {
        this.ctx.fillStyle = food.color;
        this.ctx.beginPath();
        this.ctx.arc(food.x, food.y, food.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(food.x, food.y, food.radius, 0, Math.PI * 2);
        this.ctx.stroke();
    }
    
    renderVirus(virus) {
        // Add pulsing effect (simulate the pulse phase from single-player)
        const pulsePhase = (Date.now() * 0.05) % (Math.PI * 2);
        const pulseScale = 1 + Math.sin(pulsePhase) * 0.1;
        const currentRadius = virus.radius * pulseScale;

        // Draw glow effect
        const gradient = this.ctx.createRadialGradient(virus.x, virus.y, 0, virus.x, virus.y, currentRadius * 2);
        gradient.addColorStop(0, virus.color + '60');
        gradient.addColorStop(1, virus.color + '00');
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(virus.x, virus.y, currentRadius * 2, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw main virus body (green circle)
        this.ctx.fillStyle = virus.color;
        this.ctx.beginPath();
        this.ctx.arc(virus.x, virus.y, currentRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw 16 spikes with alternating lengths
        this.ctx.fillStyle = virus.color;
        this.ctx.strokeStyle = '#007700';
        this.ctx.lineWidth = 1;

        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            
            // Alternating spike lengths: even indices = long (R/2), odd indices = short (R/3)
            const spikeLength = (i % 2 === 0) ? currentRadius / 2 : currentRadius / 3;
            
            // Calculate spike end position
            const spikeEndX = virus.x + Math.cos(angle) * (currentRadius + spikeLength);
            const spikeEndY = virus.y + Math.sin(angle) * (currentRadius + spikeLength);
            
            // Draw spike line
            this.ctx.beginPath();
            this.ctx.moveTo(virus.x + Math.cos(angle) * currentRadius, virus.y + Math.sin(angle) * currentRadius);
            this.ctx.lineTo(spikeEndX, spikeEndY);
            this.ctx.stroke();
            
            // Draw small ellipse at spike end
            const ellipseSize = currentRadius / 8;
            this.ctx.fillStyle = virus.color;
            this.ctx.beginPath();
            this.ctx.save();
            this.ctx.translate(spikeEndX, spikeEndY);
            this.ctx.rotate(angle + Math.PI / 2);
            this.ctx.scale(1, 0.6);
            this.ctx.arc(0, 0, ellipseSize, 0, Math.PI * 2);
            this.ctx.restore();
            this.ctx.fill();
        }

        // Add subtle inner detail
        this.ctx.fillStyle = '#00CC00';
        this.ctx.beginPath();
        this.ctx.arc(virus.x, virus.y, currentRadius * 0.7, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    renderPlayer(player) {
        if (!player.alive) return;
        
        // Draw glow effect
        const gradient = this.ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, player.radius * 1.5);
        gradient.addColorStop(0, player.color + '40');
        gradient.addColorStop(1, player.color + '00');
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(player.x, player.y, player.radius * 1.5, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw cell body
        this.ctx.fillStyle = player.color;
        this.ctx.beginPath();
        this.ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw border
        this.ctx.strokeStyle = player.id === this.playerId ? '#ffffff' : '#cccccc';
        this.ctx.lineWidth = player.id === this.playerId ? 3 : 2;
        this.ctx.beginPath();
        this.ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Draw name
        if (player.radius > 15) {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = `${Math.min(player.radius / 3, 16)}px Orbitron`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(player.name || 'Player', player.x, player.y);
        }
    }
    
    renderMinimap() {
        const scale = 150 / Math.max(this.worldWidth, this.worldHeight);
        
        this.minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.minimapCtx.fillRect(0, 0, 150, 150);
        
        this.minimapCtx.strokeStyle = '#00ffff';
        this.minimapCtx.lineWidth = 1;
        this.minimapCtx.strokeRect(0, 0, this.worldWidth * scale, this.worldHeight * scale);
        
        // Draw all cells (players and bots)
        const allCells = [...this.players, ...this.bots];
        allCells.forEach(cell => {
            if (!cell.alive) return;
            
            const x = cell.x * scale;
            const y = cell.y * scale;
            const radius = Math.max(1, cell.radius * scale * 0.5);
            
            this.minimapCtx.fillStyle = cell.color;
            this.minimapCtx.beginPath();
            this.minimapCtx.arc(x, y, radius, 0, Math.PI * 2);
            this.minimapCtx.fill();
            
            if (cell.id === this.playerId) {
                this.minimapCtx.strokeStyle = '#ffffff';
                this.minimapCtx.lineWidth = 2;
                this.minimapCtx.stroke();
            }
        });
    }
    
    // Mobile controls (simplified versions of singleplayer methods)
    setupMobileControls() {
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        if (isTouchDevice) {
            document.getElementById('mobileControls').classList.remove('hidden');
        }
        
        this.setupCanvasTouchEvents();
        this.setupVirtualButtons();
    }
    
    setupCanvasTouchEvents() {
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
    }
    
    handleTouchStart(e) {
        if (this.gameState !== 'playing') return;
        e.preventDefault();
        
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        
        this.touch.active = true;
        this.touch.x = touch.clientX - rect.left;
        this.touch.y = touch.clientY - rect.top;
        
        this.updateTouchWorldPosition();
    }
    
    handleTouchMove(e) {
        if (this.gameState !== 'playing' || !this.touch.active) return;
        e.preventDefault();
        
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        
        this.touch.x = touch.clientX - rect.left;
        this.touch.y = touch.clientY - rect.top;
        
        this.updateTouchWorldPosition();
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        this.touch.active = false;
    }
    
    updateTouchWorldPosition() {
        if (!this.localPlayer || !this.touch.active) return;
        
        const displayWidth = window.innerWidth;
        const displayHeight = window.innerHeight;
        
        const worldX = (this.touch.x - displayWidth / 2) / this.camera.zoom + this.camera.x;
        const worldY = (this.touch.y - displayHeight / 2) / this.camera.zoom + this.camera.y;
        
        this.mouse.worldX = worldX;
        this.mouse.worldY = worldY;
        
        this.localInput.targetX = worldX;
        this.localInput.targetY = worldY;
        
        this.sendInputToServer();
    }
    
    setupVirtualButtons() {
        const splitButton = document.getElementById('splitButton');
        const ejectButton = document.getElementById('ejectButton');
        
        splitButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.gameState === 'playing' && this.localPlayer && this.localPlayer.alive) {
                this.splitPlayer();
            }
        }, { passive: false });
        
        ejectButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.gameState === 'playing' && this.localPlayer && this.localPlayer.alive) {
                this.ejectMass();
            }
        }, { passive: false });
    }
    
    updateVirtualButtonStates() {
        if (this.gameState !== 'playing') return;
        
        const splitButton = document.getElementById('splitButton');
        const ejectButton = document.getElementById('ejectButton');
        
        const canSplit = this.localPlayer && this.localPlayer.alive && this.localPlayer.mass >= 25;
        const canEject = this.localPlayer && this.localPlayer.alive && this.localPlayer.mass >= 30;
        
        if (canSplit) {
            splitButton.classList.remove('disabled');
        } else {
            splitButton.classList.add('disabled');
        }
        
        if (canEject) {
            ejectButton.classList.remove('disabled');
        } else {
            ejectButton.classList.add('disabled');
        }
    }
    
    // UI Management
    pauseGame() {
        this.gameState = 'paused';
        document.getElementById('pauseMenu').classList.remove('hidden');
    }
    
    resumeGame() {
        this.gameState = 'playing';
        document.getElementById('pauseMenu').classList.add('hidden');
        this.lastFrameTime = performance.now();
        this.gameLoop();
    }
    
    restartGame() {
        const playerName = document.getElementById('playerNameDisplay').textContent || 'Spieler';
        this.hideAllScreens();
        this.joinGame(playerName);
    }
    
    showStartScreen() {
        this.gameState = 'menu';
        if (this.socket) {
            this.socket.disconnect();
        }
        this.hideAllScreens();
        document.getElementById('startScreen').classList.remove('hidden');
        document.getElementById('playerName').focus();
    }
    
    showGameScreen() {
        this.hideAllScreens();
        document.getElementById('gameScreen').classList.remove('hidden');
    }
    
    showGameOverScreen() {
        document.getElementById('gameOverScreen').classList.remove('hidden');
    }
    
    hideAllScreens() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        document.getElementById('pauseMenu').classList.add('hidden');
    }
    
    showConnectionStatus(message) {
        const connectionStatus = document.getElementById('connectionStatus');
        const connectionText = document.getElementById('connectionText');
        
        if (connectionStatus && connectionText) {
            connectionText.textContent = message;
            connectionStatus.classList.remove('hidden');
        }
    }
    
    hideConnectionStatus() {
        const connectionStatus = document.getElementById('connectionStatus');
        if (connectionStatus) {
            connectionStatus.classList.add('hidden');
        }
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    const game = new MultiplayerAgar();
});
