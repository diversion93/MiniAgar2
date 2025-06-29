// MiniAgar Game - Enhanced Agar.io Clone
class MiniAgar {
    constructor() {
        // Game state
        this.gameState = 'menu'; // 'menu', 'playing', 'paused', 'gameOver'
        this.gameStartTime = 0;
        this.lastFrameTime = 0;
        this.animationId = null;
        
        // World settings
        this.worldWidth = 2000;
        this.worldHeight = 2000;
        this.maxZoom = null; // Will be calculated based on screen size
        
        // Performance optimization settings
        this.performance = {
            devicePixelRatio: window.devicePixelRatio || 1,
            adaptiveRatio: Math.min(window.devicePixelRatio || 1, 2), // Cap at 2x for performance
            targetFPS: 60,
            currentFPS: 60,
            frameTimeHistory: [],
            maxFrameHistory: 30,
            qualityLevel: 1.0, // 0.5 = low, 1.0 = high
            autoQualityAdjust: true,
            memoryUsage: 0,
            lastGCTime: 0,
            renderDistance: 1.0, // LOD multiplier
            particleLimit: 100,
            lowPowerMode: false
        };
        
        // Detect device capabilities
        this.detectDeviceCapabilities();
        
        // Game settings
        this.baseSpeed = 2;
        this.botCount = 15;
        this.maxFood = 200;
        this.foodSpawnRate = 2; // food per second
        this.virusCount = 8;
        this.maxViruses = 12;
        
        // Player and entities
        this.player = null;
        this.playerCells = []; // For split cells
        this.bots = [];
        this.food = [];
        this.viruses = [];
        this.particles = [];
        
        // Input handling
        this.keys = {};
        this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0 };
        
        // Touch handling
        this.touch = {
            active: false,
            x: 0,
            y: 0,
            worldX: 0,
            worldY: 0,
            startX: 0,
            startY: 0
        };
        
        // Enhanced Mobile controls
        this.mobileControls = {
            joystickMode: false,
            joystickActive: false,
            joystickCenter: { x: 0, y: 0 },
            joystickRadius: 60, // Increased for better touch area
            joystickDeadzone: 8, // Reduced for more responsive control
            sensitivity: 1.2, // Configurable sensitivity
            smoothing: 0.15, // Movement smoothing factor
            lastTouchTime: 0,
            touchVelocity: { x: 0, y: 0 },
            hapticEnabled: true,
            visualFeedback: true
        };
        
        // Camera
        this.camera = { x: 0, y: 0, zoom: 1 };
        
        // Timing
        this.lastSplit = 0;
        this.lastMassEjection = 0;
        
        // Audio
        this.audioContext = null;
        this.sounds = {};
        
        // Performance tracking
        this.fps = 60;
        this.frameCount = 0;
        
        // Virus feeding tracking
        this.virusHitCounts = new Map();
        
        // Initialize canvas and context
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.minimap = document.getElementById('minimap');
        this.minimapCtx = this.minimap.getContext('2d');
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup audio
        this.setupAudio();
    }
    
    detectDeviceCapabilities() {
        // Detect device type and capabilities
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent);
        const isLowEnd = navigator.hardwareConcurrency <= 2 || navigator.deviceMemory <= 2;
        
        // Adjust performance settings based on device
        if (isMobile && !isTablet) {
            this.performance.qualityLevel = isLowEnd ? 0.6 : 0.8;
            this.performance.particleLimit = isLowEnd ? 50 : 75;
            this.performance.lowPowerMode = isLowEnd;
        } else if (isTablet) {
            this.performance.qualityLevel = 0.9;
            this.performance.particleLimit = 100;
        }
        
        // Adjust adaptive ratio for performance
        if (isLowEnd) {
            this.performance.adaptiveRatio = Math.min(this.performance.devicePixelRatio, 1.5);
        }
        
        console.log(`Device detected: Mobile=${isMobile}, Tablet=${isTablet}, LowEnd=${isLowEnd}`);
        console.log(`Performance settings: Quality=${this.performance.qualityLevel}, Particles=${this.performance.particleLimit}`);
    }
    
    resizeCanvas() {
        // Calculate display size
        const displayWidth = window.innerWidth;
        const displayHeight = window.innerHeight;
        
        // Apply DPI optimization with adaptive ratio
        const canvasWidth = Math.floor(displayWidth * this.performance.adaptiveRatio);
        const canvasHeight = Math.floor(displayHeight * this.performance.adaptiveRatio);
        
        // Set canvas internal resolution
        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;
        
        // Set canvas display size to fill viewport completely
        this.canvas.style.width = displayWidth + 'px';
        this.canvas.style.height = displayHeight + 'px';
        
        // Reset any previous transforms
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        // Scale context to match device pixel ratio
        this.ctx.scale(this.performance.adaptiveRatio, this.performance.adaptiveRatio);
        
        // Enable smooth rendering with quality adjustment
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = this.performance.qualityLevel >= 0.8 ? 'high' : 'medium';
        
        console.log(`Canvas resized: Display=${displayWidth}x${displayHeight}, Canvas=${canvasWidth}x${canvasHeight}, Ratio=${this.performance.adaptiveRatio}`);
    }
    
    updatePerformanceMetrics(deltaTime) {
        // Track frame time history
        const frameTime = deltaTime * 1000; // Convert to milliseconds
        this.performance.frameTimeHistory.push(frameTime);
        
        if (this.performance.frameTimeHistory.length > this.performance.maxFrameHistory) {
            this.performance.frameTimeHistory.shift();
        }
        
        // Calculate average FPS
        if (this.performance.frameTimeHistory.length > 0) {
            const avgFrameTime = this.performance.frameTimeHistory.reduce((a, b) => a + b, 0) / this.performance.frameTimeHistory.length;
            this.performance.currentFPS = Math.round(1000 / avgFrameTime);
        }
        
        // Monitor memory usage (if available)
        if (performance.memory) {
            this.performance.memoryUsage = performance.memory.usedJSHeapSize / 1024 / 1024; // MB
        }
        
        // Trigger garbage collection monitoring
        const currentTime = Date.now();
        if (currentTime - this.performance.lastGCTime > 5000) { // Check every 5 seconds
            this.performance.lastGCTime = currentTime;
            this.monitorMemoryPressure();
        }
    }
    
    adjustQualityBasedOnPerformance() {
        const targetFPS = this.performance.targetFPS;
        const currentFPS = this.performance.currentFPS;
        const fpsRatio = currentFPS / targetFPS;
        
        // Adjust quality based on performance
        if (fpsRatio < 0.8) { // Below 80% of target FPS
            this.decreaseQuality();
        } else if (fpsRatio > 0.95 && this.performance.qualityLevel < 1.0) { // Above 95% and not at max quality
            this.increaseQuality();
        }
        
        // Adjust particle limit based on performance
        if (fpsRatio < 0.7) {
            this.performance.particleLimit = Math.max(25, this.performance.particleLimit - 10);
        } else if (fpsRatio > 0.9) {
            this.performance.particleLimit = Math.min(150, this.performance.particleLimit + 5);
        }
        
        // Clean up particles if over limit
        if (this.particles.length > this.performance.particleLimit) {
            this.particles = this.particles.slice(0, this.performance.particleLimit);
        }
        
        console.log(`Performance: FPS=${currentFPS}/${targetFPS}, Quality=${this.performance.qualityLevel.toFixed(2)}, Particles=${this.performance.particleLimit}`);
    }
    
    decreaseQuality() {
        this.performance.qualityLevel = Math.max(0.5, this.performance.qualityLevel - 0.1);
        
        // Apply quality changes
        this.ctx.imageSmoothingQuality = this.performance.qualityLevel >= 0.8 ? 'high' : 'medium';
        
        // Reduce render distance for LOD
        this.performance.renderDistance = Math.max(0.7, this.performance.renderDistance - 0.1);
        
        // Enable low power mode if quality gets very low
        if (this.performance.qualityLevel <= 0.6) {
            this.performance.lowPowerMode = true;
        }
    }
    
    increaseQuality() {
        this.performance.qualityLevel = Math.min(1.0, this.performance.qualityLevel + 0.05);
        
        // Apply quality changes
        this.ctx.imageSmoothingQuality = this.performance.qualityLevel >= 0.8 ? 'high' : 'medium';
        
        // Increase render distance
        this.performance.renderDistance = Math.min(1.0, this.performance.renderDistance + 0.05);
        
        // Disable low power mode if quality is good
        if (this.performance.qualityLevel > 0.7) {
            this.performance.lowPowerMode = false;
        }
    }
    
    monitorMemoryPressure() {
        if (!performance.memory) return;
        
        const memoryUsage = performance.memory.usedJSHeapSize / 1024 / 1024; // MB
        const memoryLimit = performance.memory.jsHeapSizeLimit / 1024 / 1024; // MB
        const memoryPressure = memoryUsage / memoryLimit;
        
        // If memory usage is high, trigger cleanup
        if (memoryPressure > 0.8) {
            this.performMemoryCleanup();
        }
        
        // Log memory stats occasionally
        if (this.frameCount % 600 === 0) { // Every 10 seconds at 60fps
            console.log(`Memory: ${memoryUsage.toFixed(1)}MB / ${memoryLimit.toFixed(1)}MB (${(memoryPressure * 100).toFixed(1)}%)`);
        }
    }
    
    performMemoryCleanup() {
        // Clean up old particles
        this.particles = this.particles.filter(particle => particle.life > 0);
        
        // Limit particle count more aggressively
        if (this.particles.length > this.performance.particleLimit * 0.7) {
            this.particles = this.particles.slice(0, Math.floor(this.performance.particleLimit * 0.7));
        }
        
        // Clean up dead entities
        this.bots = this.bots.filter(bot => bot.alive);
        this.food = this.food.filter(food => food); // Remove any null/undefined food
        
        // Force garbage collection if available (Chrome DevTools)
        if (window.gc) {
            window.gc();
        }
        
        console.log('Memory cleanup performed');
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
            this.startGame(playerName);
        });
        
        document.getElementById('playerName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const playerName = e.target.value.trim() || 'Spieler';
                this.startGame(playerName);
            }
        });
        
        // Pause menu events
        document.getElementById('resumeButton').addEventListener('click', () => this.resumeGame());
        document.getElementById('restartButton').addEventListener('click', () => this.restartGame());
        document.getElementById('mainMenuButton').addEventListener('click', () => this.showStartScreen());
        
        // Game over events
        document.getElementById('playAgainButton').addEventListener('click', () => this.restartGame());
        document.getElementById('backToMenuButton').addEventListener('click', () => this.showStartScreen());
        
        // Setup mobile touch controls
        this.setupMobileControls();
    }
    
    setupAudio() {
        // Create audio context for sound effects
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Generate eat sound
        this.sounds.eat = this.createEatSound();
        this.sounds.death = this.createDeathSound();
        this.sounds.background = this.createBackgroundAmbient();
    }
    
    createEatSound() {
        const duration = 0.1;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            data[i] = Math.sin(2 * Math.PI * (800 + 200 * Math.sin(t * 20)) * t) * Math.exp(-t * 10) * 0.3;
        }
        
        return buffer;
    }
    
    createDeathSound() {
        const duration = 0.5;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            data[i] = Math.sin(2 * Math.PI * (200 - 150 * t) * t) * Math.exp(-t * 2) * 0.5;
        }
        
        return buffer;
    }
    
    createBackgroundAmbient() {
        const duration = 2;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            data[i] = (Math.sin(2 * Math.PI * 60 * t) + Math.sin(2 * Math.PI * 80 * t)) * 0.05;
        }
        
        return buffer;
    }
    
    playSound(soundBuffer, volume = 1) {
        if (!soundBuffer) return;
        
        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        
        source.buffer = soundBuffer;
        gainNode.gain.value = volume;
        
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        source.start();
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
                if (this.gameState === 'playing' && this.player && this.player.alive) {
                    this.ejectMass();
                }
                break;
            case 'Space':
                e.preventDefault(); // Prevent page scrolling
                if (this.gameState === 'playing' && this.player && this.player.alive) {
                    this.splitPlayer();
                }
                break;
            case 'KeyC':
                if (this.gameState === 'playing' && this.player && this.player.alive) {
                    this.applyMassCheat();
                }
                break;
        }
    }
    
    splitPlayer() {
        const currentTime = Date.now();
        const totalPlayerCells = 1 + this.playerCells.length; // Main player + split cells
        
        // Check if we can split (16 cell limit)
        if (totalPlayerCells >= 16) return;
        
        // Find all player cells that can split (including main player and split cells)
        const allPlayerCells = [this.player, ...this.playerCells];
        const splittableCells = allPlayerCells.filter(cell => 
            cell && cell.alive && cell.mass >= 25 && cell.canSplit(totalPlayerCells)
        );
        
        if (splittableCells.length === 0) return;
        
        // Split all eligible cells
        const newCells = [];
        let totalSplits = 0;
        
        splittableCells.forEach(cellToSplit => {
            // Check if we still have room for more cells
            if (totalPlayerCells + totalSplits >= 16) return;
            
            // Calculate split direction (towards mouse)
            const dx = this.mouse.worldX - cellToSplit.x;
            const dy = this.mouse.worldY - cellToSplit.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Default direction if mouse is too close
            let splitDx = 1;
            let splitDy = 0;
            
            if (distance > 5) {
                splitDx = dx / distance;
                splitDy = dy / distance;
            }
            
            // Store original mass and position
            const originalMass = cellToSplit.mass;
            const halfMass = originalMass / 2;
            const originalX = cellToSplit.x;
            const originalY = cellToSplit.y;
            
            // Update original cell with exactly half the mass
            cellToSplit.mass = halfMass;
            cellToSplit.radius = Math.sqrt(cellToSplit.mass / Math.PI) * 3;
            
            // Calculate split distance
            const splitDistance = cellToSplit.radius + 10;
            
            // Move original cell slightly backward
            cellToSplit.x = originalX - splitDx * (splitDistance / 2);
            cellToSplit.y = originalY - splitDy * (splitDistance / 2);
            
            // Create new split cell with exactly half the original mass
            const splitCell = new Cell(
                originalX + splitDx * (splitDistance / 2),
                originalY + splitDy * (splitDistance / 2),
                halfMass,
                cellToSplit.color,
                cellToSplit.name + "'",
                'player'
            );
            
            // Set up split cell properties
            splitCell.isPlayerSplit = true;
            splitCell.splitTime = currentTime;
            splitCell.splitHistory.lastSplitTime = currentTime;
            
            // Update original cell's split history too
            cellToSplit.splitHistory.lastSplitTime = currentTime;
            
            // Add initial split velocity
            const splitSpeed = 50;
            splitCell.vx = splitDx * splitSpeed;
            splitCell.vy = splitDy * splitSpeed;
            cellToSplit.vx = -splitDx * splitSpeed * 0.5; // Opposite direction, less force
            cellToSplit.vy = -splitDy * splitSpeed * 0.5;
            
            // Add to new cells array (will be added to playerCells after loop)
            newCells.push(splitCell);
            
            // Create split particles for visual feedback
            this.createSplitParticles(originalX, originalY, cellToSplit.color);
            
            totalSplits++;
            
            // Debug log
            console.log(`Split: ${cellToSplit.name} mass ${originalMass} -> ${halfMass} each, Total cells will be: ${totalPlayerCells + totalSplits}`);
        });
        
        // Add all new cells to playerCells array
        newCells.forEach(cell => this.playerCells.push(cell));
        
        // Update cooldown and play sound if any splits occurred
        if (totalSplits > 0) {
            this.lastSplit = currentTime;
            this.playSound(this.sounds.eat, 0.4);
            console.log(`Total splits: ${totalSplits}, New total cells: ${1 + this.playerCells.length}`);
        }
    }
    
    ejectMass() {
        const currentTime = Date.now();
        
        // Check cooldown (0.5 seconds between mass ejections)
        if (currentTime - this.lastMassEjection < 500) return;
        
        if (!this.player || !this.player.alive || this.player.mass < 30) return; // Minimum 30 mass to eject
        
        // Calculate ejection direction (towards mouse)
        const dx = this.mouse.worldX - this.player.x;
        const dy = this.mouse.worldY - this.player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Default direction if mouse is too close
        let ejectDx = 1;
        let ejectDy = 0;
        
        if (distance > 5) {
            ejectDx = dx / distance;
            ejectDy = dy / distance;
        }
        
        // Reduce player mass
        const massToEject = Math.min(8, this.player.mass * 0.1); // Eject 10% of mass or max 8
        this.player.mass -= massToEject;
        this.player.radius = Math.sqrt(this.player.mass / Math.PI) * 3;
        
        // Create ejected mass food
        const ejectionDistance = this.player.radius + 15;
        const ejectionSpeed = 400; // Doubled speed for much longer distance travel
        
        // Add some randomness to the ejection angle for more natural behavior
        const angleVariation = (Math.random() - 0.5) * 0.3;
        const finalAngle = Math.atan2(ejectDy, ejectDx) + angleVariation;
        
        const ejectedFood = new Food(
            this.player.x + Math.cos(finalAngle) * ejectionDistance,
            this.player.y + Math.sin(finalAngle) * ejectionDistance
        );
        
        // Make ejected mass larger and with player's color
        ejectedFood.radius = Math.max(4, Math.sqrt(massToEject));
        ejectedFood.color = this.player.color;
        ejectedFood.mass = massToEject; // Store mass for proper feeding value
        
        // Add velocity to the ejected food for projectile motion
        ejectedFood.vx = Math.cos(finalAngle) * ejectionSpeed;
        ejectedFood.vy = Math.sin(finalAngle) * ejectionSpeed;
        ejectedFood.isEjected = true; // Mark as ejected mass
        ejectedFood.ejectionTime = currentTime;
        
        this.food.push(ejectedFood);
        
        // Create ejection particles for visual feedback
        this.createEjectionParticles(this.player.x, this.player.y, this.player.color, finalAngle);
        
        // Update cooldown
        this.lastMassEjection = currentTime;
        
        // Play ejection sound (slightly different from eat sound)
        this.playSound(this.sounds.eat, 0.2);
    }
    
    createSplitParticles(x, y, color) {
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const particle = new Particle(
                x + Math.cos(angle) * 15,
                y + Math.sin(angle) * 15,
                Math.cos(angle) * 150,
                Math.sin(angle) * 150,
                color,
                0.8,
                3
            );
            this.particles.push(particle);
        }
    }
    
    createEjectionParticles(x, y, color, angle) {
        for (let i = 0; i < 5; i++) {
            const particleAngle = angle + (Math.random() - 0.5) * 0.5;
            const speed = 100 + Math.random() * 50;
            const particle = new Particle(
                x + Math.cos(particleAngle) * 10,
                y + Math.sin(particleAngle) * 10,
                Math.cos(particleAngle) * speed,
                Math.sin(particleAngle) * speed,
                color,
                0.6,
                2
            );
            this.particles.push(particle);
        }
    }
    
    applyMassCheat() {
        const massGain = 50;
        this.player.mass += massGain;
        this.player.radius = Math.sqrt(this.player.mass / Math.PI) * 3;
        
        // Add visual feedback with green particles
        this.createSplitParticles(this.player.x, this.player.y, '#00ff00');
        
        // Play a distinct sound
        this.playSound(this.sounds.eat, 0.6);
        
        console.log(`Mass cheat applied: +${massGain} mass (Total: ${this.player.mass})`);
    }
    
    updateMouseWorldPosition() {
        if (!this.player) return;
        
        // Use display dimensions for consistent coordinate calculation
        const displayWidth = window.innerWidth;
        const displayHeight = window.innerHeight;
        
        // Calculate new world position using display dimensions
        const newWorldX = (this.mouse.x - displayWidth / 2) / this.camera.zoom + this.camera.x;
        const newWorldY = (this.mouse.y - displayHeight / 2) / this.camera.zoom + this.camera.y;
        
        // Initialize mouse world position if not set
        if (this.mouse.worldX === undefined) {
            this.mouse.worldX = newWorldX;
            this.mouse.worldY = newWorldY;
            return;
        }
        
        // Calculate movement delta
        const deltaX = newWorldX - this.mouse.worldX;
        const deltaY = newWorldY - this.mouse.worldY;
        const deltaDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Implement deadzone - ignore very small movements to prevent jittering
        const deadzone = 2.0; // Increased deadzone threshold
        
        if (deltaDistance > deadzone) {
            // Use exponential smoothing for larger movements
            const smoothingFactor = 0.3; // Increased for more responsive movement
            this.mouse.worldX += deltaX * smoothingFactor;
            this.mouse.worldY += deltaY * smoothingFactor;
        }
        // For movements within deadzone, don't update position at all
    }
    
    startGame(playerName) {
        this.gameState = 'playing';
        this.gameStartTime = Date.now();
        
        // Initialize player
        this.player = new Cell(
            this.worldWidth / 2 + (Math.random() - 0.5) * 200,
            this.worldHeight / 2 + (Math.random() - 0.5) * 200,
            20,
            '#00ffff',
            playerName,
            'player'
        );
        
        // Initialize player cells array
        this.playerCells = [];
        
        // Initialize bots
        this.bots = [];
        this.createBots();
        
        // Initialize food
        this.food = [];
        this.spawnInitialFood();
        
        // Initialize viruses
        this.viruses = [];
        this.spawnInitialViruses();
        
        // Initialize particles
        this.particles = [];
        
        // Update UI
        document.getElementById('playerNameDisplay').textContent = playerName;
        this.showGameScreen();
        
        // Start game loop
        this.gameLoop();
        
        // Start background ambient
        this.playSound(this.sounds.background, 0.1);
    }
    
    createBots() {
        const botTypes = ['aggressive', 'passive', 'balanced', 'opportunistic'];
        const botColors = {
            aggressive: '#ff4444',
            passive: '#4444ff',
            balanced: '#44ff44',
            opportunistic: '#ffff44'
        };
        
        for (let i = 0; i < this.botCount; i++) {
            const type = botTypes[i % botTypes.length];
            const bot = new Bot(
                Math.random() * this.worldWidth,
                Math.random() * this.worldHeight,
                20 + Math.random() * 4,
                botColors[type],
                `Bot${i + 1}`,
                type
            );
            this.bots.push(bot);
        }
    }
    
    spawnInitialFood() {
        for (let i = 0; i < this.maxFood; i++) {
            this.spawnFood();
        }
    }
    
    spawnFood() {
        const food = new Food(
            Math.random() * this.worldWidth,
            Math.random() * this.worldHeight
        );
        this.food.push(food);
    }
    
    spawnInitialViruses() {
        for (let i = 0; i < this.virusCount; i++) {
            this.spawnVirus();
        }
    }
    
    spawnVirus() {
        const virus = new Virus(
            Math.random() * this.worldWidth,
            Math.random() * this.worldHeight
        );
        this.viruses.push(virus);
    }
    
    gameLoop() {
        if (this.gameState !== 'playing') {
            this.animationId = null;
            return;
        }
        
        const currentTime = performance.now();
        const deltaTime = Math.min((currentTime - this.lastFrameTime) / 1000, 1/30); // Cap deltaTime to prevent large jumps
        this.lastFrameTime = currentTime;
        
        // Update FPS and performance monitoring
        this.frameCount++;
        this.updatePerformanceMetrics(deltaTime);
        
        if (this.frameCount % 60 === 0) {
            this.fps = Math.round(1 / deltaTime);
            document.getElementById('fpsDisplay').textContent = `FPS: ${this.fps}`;
            
            // Auto-adjust quality if enabled
            if (this.performance.autoQualityAdjust) {
                this.adjustQualityBasedOnPerformance();
            }
        }
        
        this.update(deltaTime);
        this.render();
        
        this.animationId = requestAnimationFrame(() => this.gameLoop());
    }
    
    update(deltaTime) {
        // Update player
        this.updatePlayer(deltaTime);
        
        // Update player split cells
        this.updatePlayerCells(deltaTime);
        
        // Update bots and split cells
        this.bots.forEach(bot => {
            if (bot.type === 'split') {
                this.updateSplitCell(bot, deltaTime);
            } else {
                bot.update(deltaTime, this);
            }
        });
        
        // Apply passive mass loss to all cells (0.2% per second)
        this.applyPassiveMassLoss(deltaTime);
        
        // Update particles
        this.particles = this.particles.filter(particle => {
            particle.update(deltaTime);
            return particle.life > 0;
        });
        
        // Update ejected food projectiles
        this.updateEjectedFood(deltaTime);
        
        // Update viruses
        this.viruses.forEach(virus => virus.update(deltaTime));
        
        // Dynamic food spawning - more food in early game (when player mass < 200)
        let dynamicFoodSpawnRate = this.foodSpawnRate;
        if (this.player && this.player.alive) {
            const playerMass = this.player.mass;
            if (playerMass < 200) {
                // Increase spawn rate significantly for early game
                const earlyGameMultiplier = 1 + (2 * (200 - playerMass) / 200); // Up to 3x spawn rate
                dynamicFoodSpawnRate = this.foodSpawnRate * earlyGameMultiplier;
            }
        }
        
        // Spawn food with dynamic rate
        if (Math.random() < dynamicFoodSpawnRate * deltaTime && this.food.length < this.maxFood) {
            this.spawnFood();
        }
        
        // Check collisions
        this.checkCollisions();
        
        // Update camera
        this.updateCamera();
        
        // Update UI
        this.updateUI();
        
        // Update mobile controls
        this.updateVirtualButtonStates();
        
        // Check game over
        this.checkGameOver();
    }
    
    updatePlayer(deltaTime) {
        if (!this.player || !this.player.alive) return;
        
        // Initialize target velocity
        let targetVx = 0;
        let targetVy = 0;
        let hasInput = false;
        
        // Keyboard movement (prioritize over mouse)
        let keyboardVx = 0;
        let keyboardVy = 0;
        
        if (this.keys['ArrowUp']) keyboardVy -= 1;
        if (this.keys['ArrowDown'] || this.keys['KeyS']) keyboardVy += 1;
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) keyboardVx -= 1;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) keyboardVx += 1;
        
        if (keyboardVx !== 0 || keyboardVy !== 0) {
            const keyboardLength = Math.sqrt(keyboardVx * keyboardVx + keyboardVy * keyboardVy);
            const speed = this.baseSpeed / Math.sqrt(this.player.mass / 100);
            targetVx = (keyboardVx / keyboardLength) * speed;
            targetVy = (keyboardVy / keyboardLength) * speed;
            hasInput = true;
        } else {
            // Mouse movement only if no keyboard input
            const dx = this.mouse.worldX - this.player.x;
            const dy = this.mouse.worldY - this.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Increased minimum distance threshold to prevent micro-movements
            if (distance > 8) {
                const speed = this.baseSpeed / Math.sqrt(this.player.mass / 100);
                targetVx = (dx / distance) * speed;
                targetVy = (dy / distance) * speed;
                hasInput = true;
            }
        }
        
        // Smooth velocity interpolation to prevent jittering
        const velocitySmoothing = hasInput ? 0.25 : 0.85; // Faster response when moving, slower when stopping
        
        if (hasInput) {
            // Interpolate towards target velocity
            this.player.vx += (targetVx - this.player.vx) * velocitySmoothing;
            this.player.vy += (targetVy - this.player.vy) * velocitySmoothing;
        } else {
            // Apply stronger friction when no input
            this.player.vx *= 0.85;
            this.player.vy *= 0.85;
        }
        
        // Prevent very small velocities that cause micro-jittering
        if (Math.abs(this.player.vx) < 0.01) this.player.vx = 0;
        if (Math.abs(this.player.vy) < 0.01) this.player.vy = 0;
        
        // Update position
        this.player.x += this.player.vx * deltaTime * 60; // Normalize for frame rate
        this.player.y += this.player.vy * deltaTime * 60;
        
        // Keep in bounds
        this.player.x = Math.max(this.player.radius, Math.min(this.worldWidth - this.player.radius, this.player.x));
        this.player.y = Math.max(this.player.radius, Math.min(this.worldHeight - this.player.radius, this.player.y));
    }
    
    updatePlayerCells(deltaTime) {
        const currentTime = Date.now();
        
        // Update each player split cell
        for (let i = this.playerCells.length - 1; i >= 0; i--) {
            const cell = this.playerCells[i];
            
            if (!cell.alive) {
                this.playerCells.splice(i, 1);
                continue;
            }
            
            // Calculate movement toward mouse (same as main player)
            let hasInput = false;
            let targetVx = 0;
            let targetVy = 0;
            
            // Keyboard movement (prioritize over mouse)
            let keyboardVx = 0;
            let keyboardVy = 0;
            
            if (this.keys['ArrowUp']) keyboardVy -= 1;
            if (this.keys['ArrowDown'] || this.keys['KeyS']) keyboardVy += 1;
            if (this.keys['ArrowLeft'] || this.keys['KeyA']) keyboardVx -= 1;
            if (this.keys['ArrowRight'] || this.keys['KeyD']) keyboardVx += 1;
            
            if (keyboardVx !== 0 || keyboardVy !== 0) {
                const keyboardLength = Math.sqrt(keyboardVx * keyboardVx + keyboardVy * keyboardVy);
                const speed = this.baseSpeed * cell.getSpeedMultiplier();
                targetVx = (keyboardVx / keyboardLength) * speed;
                targetVy = (keyboardVy / keyboardLength) * speed;
                hasInput = true;
            } else {
                // Mouse movement only if no keyboard input
                const dx = this.mouse.worldX - cell.x;
                const dy = this.mouse.worldY - cell.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 8) { // Increased threshold for better stillness detection
                    const speed = this.baseSpeed * cell.getSpeedMultiplier();
                    targetVx = (dx / distance) * speed;
                    targetVy = (dy / distance) * speed;
                    hasInput = true;
                }
            }
            
            // Smooth velocity interpolation
            const velocitySmoothing = hasInput ? 0.25 : 0.85;
            
            if (hasInput) {
                cell.vx += (targetVx - cell.vx) * velocitySmoothing;
                cell.vy += (targetVy - cell.vy) * velocitySmoothing;
            } else {
                cell.vx *= 0.85;
                cell.vy *= 0.85;
            }
            
            // Prevent micro-movements
            if (Math.abs(cell.vx) < 0.01) cell.vx = 0;
            if (Math.abs(cell.vy) < 0.01) cell.vy = 0;
            
            // Update movement state for merge detection
            cell.updateMovementState(deltaTime);
            
            // Update position
            cell.x += cell.vx * deltaTime * 60;
            cell.y += cell.vy * deltaTime * 60;
            
            // Keep in bounds
            cell.x = Math.max(cell.radius, Math.min(this.worldWidth - cell.radius, cell.x));
            cell.y = Math.max(cell.radius, Math.min(this.worldHeight - cell.radius, cell.y));
        }
        
        // Apply advanced cell physics
        this.applyAdvancedCellPhysics(deltaTime);
        
        // Update main player movement state
        this.player.updateMovementState(deltaTime);
        
        // Check for merging opportunities
        this.checkPlayerCellMerging();
    }
    
    applyAdvancedCellPhysics(deltaTime) {
        const allPlayerCells = [this.player, ...this.playerCells];
        
        // Apply bubble-like separation forces
        this.applySoftBodySeparation(allPlayerCells, deltaTime);
        
        // Apply distance constraints (tethering)
        this.applyDistanceConstraints(allPlayerCells, deltaTime);
        
        // Apply cohesion forces to keep cells together
        this.applyCohesionForces(allPlayerCells, deltaTime);
    }
    
    applySoftBodySeparation(cells, deltaTime) {
        const SEPARATION_FORCE = 0.8;
        const MIN_SEPARATION_DISTANCE = 8; // Increased for better bubble effect
        const DAMPING = 0.95; // Damping to prevent oscillation
        
        for (let i = 0; i < cells.length; i++) {
            for (let j = i + 1; j < cells.length; j++) {
                const cell1 = cells[i];
                const cell2 = cells[j];
                
                // Skip if cells are actively merging
                if (cell1.mergeState.mergeTarget === cell2 || cell2.mergeState.mergeTarget === cell1) {
                    continue;
                }
                
                const dx = cell1.x - cell2.x;
                const dy = cell1.y - cell2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDistance = cell1.radius + cell2.radius + MIN_SEPARATION_DISTANCE;
                
                if (distance < minDistance && distance > 0.1) {
                    // Calculate overlap and separation force
                    const overlap = minDistance - distance;
                    const separationStrength = overlap * SEPARATION_FORCE;
                    
                    // Normalize direction vector
                    const dirX = dx / distance;
                    const dirY = dy / distance;
                    
                    // Calculate mass-based force distribution
                    const totalMass = cell1.mass + cell2.mass;
                    const force1Ratio = cell2.mass / totalMass; // Lighter cell moves more
                    const force2Ratio = cell1.mass / totalMass;
                    
                    // Apply soft separation forces with smooth interpolation
                    const force1 = separationStrength * force1Ratio * deltaTime * 60;
                    const force2 = separationStrength * force2Ratio * deltaTime * 60;
                    
                    // Apply forces gradually to prevent jittering
                    cell1.x += dirX * force1 * 0.5;
                    cell1.y += dirY * force1 * 0.5;
                    cell2.x -= dirX * force2 * 0.5;
                    cell2.y -= dirY * force2 * 0.5;
                    
                    // Apply velocity damping to create smooth bubble-like movement
                    cell1.vx *= DAMPING;
                    cell1.vy *= DAMPING;
                    cell2.vx *= DAMPING;
                    cell2.vy *= DAMPING;
                    
                    // Keep cells in bounds
                    cell1.x = Math.max(cell1.radius, Math.min(this.worldWidth - cell1.radius, cell1.x));
                    cell1.y = Math.max(cell1.radius, Math.min(this.worldHeight - cell1.radius, cell1.y));
                    cell2.x = Math.max(cell2.radius, Math.min(this.worldWidth - cell2.radius, cell2.x));
                    cell2.y = Math.max(cell2.radius, Math.min(this.worldHeight - cell2.radius, cell2.y));
                }
            }
        }
    }
    
    applyDistanceConstraints(cells, deltaTime) {
        if (cells.length < 2) return;
        
        // Calculate center of mass
        let centerX = 0;
        let centerY = 0;
        let totalMass = 0;
        
        cells.forEach(cell => {
            centerX += cell.x * cell.mass;
            centerY += cell.y * cell.mass;
            totalMass += cell.mass;
        });
        
        centerX /= totalMass;
        centerY /= totalMass;
        
        // Calculate average radius for constraint distance
        const avgRadius = cells.reduce((sum, cell) => sum + cell.radius, 0) / cells.length;
        const maxAllowedDistance = avgRadius * 8; // Distance constraint based on cell size
        
        // Apply distance constraints
        cells.forEach(cell => {
            const dx = cell.x - centerX;
            const dy = cell.y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > maxAllowedDistance) {
                // Gently pull cell back toward center
                const pullStrength = (distance - maxAllowedDistance) * 0.02; // Gentle pull
                const dirX = dx / distance;
                const dirY = dy / distance;
                
                cell.x -= dirX * pullStrength * deltaTime * 60;
                cell.y -= dirY * pullStrength * deltaTime * 60;
                
                // Apply slight velocity damping when constraining
                cell.vx *= 0.98;
                cell.vy *= 0.98;
            }
        });
    }
    
    applyCohesionForces(cells, deltaTime) {
        if (cells.length < 2) return;
        
        const COHESION_STRENGTH = 0.01; // Very gentle cohesion
        
        // Calculate center of mass
        let centerX = 0;
        let centerY = 0;
        let totalMass = 0;
        
        cells.forEach(cell => {
            centerX += cell.x * cell.mass;
            centerY += cell.y * cell.mass;
            totalMass += cell.mass;
        });
        
        centerX /= totalMass;
        centerY /= totalMass;
        
        // Apply gentle cohesion forces
        cells.forEach(cell => {
            const dx = centerX - cell.x;
            const dy = centerY - cell.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0.1) {
                const cohesionForce = COHESION_STRENGTH * Math.min(distance / 100, 1); // Scale with distance
                const dirX = dx / distance;
                const dirY = dy / distance;
                
                // Apply very gentle pull toward center
                cell.vx += dirX * cohesionForce * deltaTime * 60;
                cell.vy += dirY * cohesionForce * deltaTime * 60;
            }
        });
    }
    
    checkPlayerCellMerging() {
        const currentTime = Date.now();
        const allPlayerCells = [this.player, ...this.playerCells];
        
        // Find mergeable pairs without complex movement restrictions
        const mergeablePairs = this.findMergeableCellPairs();
        
        if (mergeablePairs.length > 0) {
            // When multiple cells can merge, prioritize merging with the main player first
            // This prevents the main player from being accidentally removed
            let priorityPair = null;
            
            // Look for pairs involving the main player
            for (const pair of mergeablePairs) {
                if (pair.cell1 === this.player || pair.cell2 === this.player) {
                    priorityPair = pair;
                    break;
                }
            }
            
            // If no pair involves the main player, use the closest pair
            const pairToProcess = priorityPair || mergeablePairs[0];
            this.processCellMerge(pairToProcess.cell1, pairToProcess.cell2);
        }
    }
    
    findMergeableCellPairs() {
        const allPlayerCells = [this.player, ...this.playerCells];
        const mergeablePairs = [];
        
        for (let i = 0; i < allPlayerCells.length; i++) {
            for (let j = i + 1; j < allPlayerCells.length; j++) {
                const cell1 = allPlayerCells[i];
                const cell2 = allPlayerCells[j];
                
                // Check if both cells can merge
                if (cell1.canMergeWith(cell2)) {
                    const distance = this.calculateDistance(cell1, cell2);
                    const mergeThreshold = (cell1.radius + cell2.radius) * 1.3; // Increased threshold for easier merging
                    
                    if (distance < mergeThreshold) {
                        mergeablePairs.push({
                            cell1,
                            cell2,
                            distance
                        });
                    }
                }
            }
        }
        
        // Sort by distance (closest first)
        return mergeablePairs.sort((a, b) => a.distance - b.distance);
    }
    
    processCellMerge(cell1, cell2) {
        const MERGE_DURATION = 3000; // Further reduced to 0.8 seconds for faster merging
        
        // Initialize merge if not already started
        if (!cell1.mergeState.mergeTarget) {
            cell1.mergeState.mergeTarget = cell2;
            cell1.mergeState.mergeDuration = MERGE_DURATION;
            cell1.mergeState.maxMergeDistance = this.calculateDistance(cell1, cell2);
            
            cell2.mergeState.mergeTarget = cell1;
            cell2.mergeState.mergeDuration = MERGE_DURATION;
            cell2.mergeState.maxMergeDistance = cell1.mergeState.maxMergeDistance;
        }
        
        // Update merge progress
        const deltaTime = 16; // Approximate frame time
        cell1.mergeState.mergeDuration -= deltaTime;
        cell2.mergeState.mergeDuration -= deltaTime;
        
        const timeLeft = Math.max(0, cell1.mergeState.mergeDuration);
        const totalTime = MERGE_DURATION;
        const progress = 1 - (timeLeft / totalTime);
        
        // Calculate maximum allowed overlap (one-third of combined radii)
        const maxOverlap = (cell1.radius + cell2.radius) / 3;
        const minDistance = (cell1.radius + cell2.radius) - maxOverlap;
        
        // Calculate target distance with controlled overlap
        const maxDistance = cell1.mergeState.maxMergeDistance;
        const targetDistance = Math.max(minDistance, maxDistance * Math.sqrt(timeLeft / totalTime));
        
        // Move cells closer together with controlled overlap
        const currentDistance = this.calculateDistance(cell1, cell2);
        if (currentDistance > targetDistance && currentDistance > 0) {
            const dx = cell2.x - cell1.x;
            const dy = cell2.y - cell1.y;
            const moveRatio = targetDistance / currentDistance;
            
            // Calculate new positions
            const midX = (cell1.x + cell2.x) / 2;
            const midY = (cell1.y + cell2.y) / 2;
            
            cell1.x = midX - (dx * moveRatio) / 2;
            cell1.y = midY - (dy * moveRatio) / 2;
            cell2.x = midX + (dx * moveRatio) / 2;
            cell2.y = midY + (dy * moveRatio) / 2;
        }
        
        // Complete merge when time expires
        if (timeLeft <= 0) {
            this.completeCellMerge(cell1, cell2);
        }
    }
    
    completeCellMerge(cell1, cell2) {
        // Safety checks to prevent crashes
        if (!cell1 || !cell2 || !cell1.alive || !cell2.alive) {
            console.warn('Attempted to merge invalid cells');
            return;
        }
        
        // Critical safety check: Never allow main player to be removed
        if (cell1 === this.player && cell2 === this.player) {
            console.warn('Attempted to merge player with itself - aborting');
            return;
        }
        
        // Use simple mass addition to prevent merging to smaller cells
        const newMass = Math.max(cell1.mass + cell2.mass, Math.max(cell1.mass, cell2.mass));
        const newRadius = Math.sqrt(newMass / Math.PI) * 3;
        
        // Determine which cell to keep (prefer main player)
        let keepCell, removeCell;
        if (cell1 === this.player) {
            keepCell = cell1;
            removeCell = cell2;
        } else if (cell2 === this.player) {
            keepCell = cell2;
            removeCell = cell1;
        } else {
            // Both are split cells, keep the larger one or first one if equal
            if (cell1.mass >= cell2.mass) {
                keepCell = cell1;
                removeCell = cell2;
            } else {
                keepCell = cell2;
                removeCell = cell1;
            }
        }
        
        // Safety check for valid cells
        if (!keepCell || !removeCell) {
            console.warn('Invalid cell selection during merge');
            return;
        }
        
        // Critical safety check: Ensure we never remove the main player
        if (removeCell === this.player) {
            console.error('CRITICAL ERROR: Attempted to remove main player during merge - aborting');
            return;
        }
        
        // Additional safety: Ensure main player is never marked as dead
        if (keepCell === this.player) {
            keepCell.alive = true; // Explicitly ensure player stays alive
        }
        
        // Update the kept cell with validation
        keepCell.mass = Math.max(newMass, 20); // Ensure minimum mass
        keepCell.radius = Math.max(newRadius, Math.sqrt(20 / Math.PI) * 3); // Ensure minimum radius
        keepCell.score += removeCell.score || 0;
        
        // Reset merge state safely and add grace period
        if (keepCell.mergeState) {
            keepCell.mergeState.mergeTarget = null;
            keepCell.mergeState.mergeDuration = 0;
            keepCell.mergeState.mergeProgress = 0;
        }
        
        // Reset merge state for removed cell too
        if (removeCell.mergeState) {
            removeCell.mergeState.mergeTarget = null;
            removeCell.mergeState.mergeDuration = 0;
            removeCell.mergeState.mergeProgress = 0;
        }
        
        // Add post-merge grace period to ensure movement works immediately
        if (keepCell.movementState) {
            keepCell.movementState.postMergeGracePeriod = 2000; // 2 seconds grace period
            keepCell.movementState.isStill = false;
            keepCell.movementState.stillStartTime = 0;
            keepCell.movementState.stillDuration = 0;
        }
        
        // Force reset velocity to ensure responsive movement after merge
        keepCell.vx = 0;
        keepCell.vy = 0;
        
        // Clear any merge-related state that might interfere with movement
        keepCell.mergeState = {
            canMerge: false,
            mergeTarget: null,
            mergeDuration: 0,
            mergeProgress: 0,
            maxMergeDistance: 0
        };
        
        // Safely remove the other cell from playerCells array
        if (removeCell !== this.player && this.playerCells) {
            const index = this.playerCells.indexOf(removeCell);
            if (index > -1) {
                this.playerCells.splice(index, 1);
                console.log(`Removed split cell from playerCells array. Remaining: ${this.playerCells.length}`);
            }
        }
        
        // Mark removed cell as dead ONLY after removing from arrays
        removeCell.alive = false;
        
        // Play merge sound
        try {
            this.playSound(this.sounds.eat, 0.4);
        } catch (e) {
            console.warn('Error playing merge sound:', e);
        }
        
        // Create merge particles
        try {
            this.createMergeParticles(keepCell.x, keepCell.y, keepCell.color);
        } catch (e) {
            console.warn('Error creating merge particles:', e);
        }
        
        console.log(`Merged: New mass ${Math.round(newMass)}, Total cells: ${1 + (this.playerCells ? this.playerCells.length : 0)}`);
    }
    
    calculateDistance(cell1, cell2) {
        const dx = cell1.x - cell2.x;
        const dy = cell1.y - cell2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    createMergeParticles(x, y, color) {
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const particle = new Particle(
                x + Math.cos(angle) * 10,
                y + Math.sin(angle) * 10,
                Math.cos(angle) * 80,
                Math.sin(angle) * 80,
                color,
                0.6,
                4
            );
            this.particles.push(particle);
        }
    }
    
    updateEjectedFood(deltaTime) {
        for (let i = this.food.length - 1; i >= 0; i--) {
            const food = this.food[i];
            
            // Only update ejected food with velocity
            if (food.isEjected && (food.vx || food.vy)) {
                // Update position based on velocity
                food.x += food.vx * deltaTime;
                food.y += food.vy * deltaTime;
                
                // Apply friction to slow down over time
                food.vx *= 0.95;
                food.vy *= 0.95;
                
                // Stop moving when velocity is very low
                if (Math.abs(food.vx) < 5 && Math.abs(food.vy) < 5) {
                    food.vx = 0;
                    food.vy = 0;
                }
                
                // Keep ejected food in bounds
                if (food.x < food.radius || food.x > this.worldWidth - food.radius ||
                    food.y < food.radius || food.y > this.worldHeight - food.radius) {
                    
                    // Bounce off walls
                    if (food.x < food.radius || food.x > this.worldWidth - food.radius) {
                        food.vx *= -0.7; // Reduce velocity on bounce
                        food.x = Math.max(food.radius, Math.min(this.worldWidth - food.radius, food.x));
                    }
                    if (food.y < food.radius || food.y > this.worldHeight - food.radius) {
                        food.vy *= -0.7; // Reduce velocity on bounce
                        food.y = Math.max(food.radius, Math.min(this.worldHeight - food.radius, food.y));
                    }
                }
            }
        }
    }
    
    checkCollisions() {
        const allCells = [this.player, ...this.playerCells, ...this.bots].filter(cell => cell && cell.alive);
        
        // Cell vs Food collisions
        allCells.forEach(cell => {
            for (let i = this.food.length - 1; i >= 0; i--) {
                const food = this.food[i];
                const dx = cell.x - food.x;
                const dy = cell.y - food.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < cell.radius + food.radius) {
                    // Eat food - use stored mass if available (for ejected mass), otherwise default to 1
                    const massGain = food.mass || 1;
                    cell.mass += massGain;
                    cell.radius = Math.sqrt(cell.mass / Math.PI) * 3;
                    cell.score += massGain; // Score based on mass gained
                    
                    // Create particles
                    this.createEatParticles(food.x, food.y, food.color);
                    
                    // Play sound
                    if (cell === this.player) {
                        this.playSound(this.sounds.eat, 0.3);
                    }
                    
                    // Remove food
                    this.food.splice(i, 1);
                }
            }
        });
        
        // Cell vs Virus collisions
        allCells.forEach(cell => {
            for (let i = this.viruses.length - 1; i >= 0; i--) {
                const virus = this.viruses[i];
                const dx = cell.x - virus.x;
                const dy = cell.y - virus.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < cell.radius + virus.radius) {
                    // Only cells with mass > 50 are affected by viruses, and only if virus is fully grown
                    if (cell.mass > 50 && virus.isDangerous()) {
                        // Handle virus splitting for large cells
                        this.handleVirusSplitting(cell, virus);
                        
                        // Remove the virus after interaction
                        this.viruses.splice(i, 1);
                        
                        // Spawn a new virus elsewhere
                        if (this.viruses.length < this.maxViruses) {
                            setTimeout(() => this.spawnVirus(), 5000);
                        }
                    }
                }
            }
        });
        
        // Cell vs Cell collisions
        for (let i = 0; i < allCells.length; i++) {
            for (let j = i + 1; j < allCells.length; j++) {
                const cell1 = allCells[i];
                const cell2 = allCells[j];
                
                if (!cell1.alive || !cell2.alive) continue;
                
                const dx = cell1.x - cell2.x;
                const dy = cell1.y - cell2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < Math.max(cell1.radius, cell2.radius)) {
                    // Determine eating rules based on cell types
                    let predator, prey;
                    let requiredRatio;
                    
                    // Check if either cell is a split cell
                    const cell1IsSplit = cell1.isPlayerSplit || (cell1 !== this.player && cell1.type === 'player');
                    const cell2IsSplit = cell2.isPlayerSplit || (cell2 !== this.player && cell2.type === 'player');
                    
                    // Apply different eating rules
                    if (cell1IsSplit || cell2IsSplit) {
                        // Split cells need 33% larger mass to eat
                        requiredRatio = 1.33;
                    } else {
                        // Single cells need 10% larger mass to eat
                        requiredRatio = 1.10;
                    }
                    
                    if (cell1.mass > cell2.mass * requiredRatio) {
                        predator = cell1;
                        prey = cell2;
                    } else if (cell2.mass > cell1.mass * requiredRatio) {
                        predator = cell2;
                        prey = cell1;
                    } else {
                        continue; // No eating if size difference is too small
                    }
                    
                    // Transfer mass (full mass transfer)
                    predator.mass += prey.mass;
                    predator.radius = Math.sqrt(predator.mass / Math.PI) * 3;
                    predator.score += prey.type === 'bot' ? 10 : 50;
                    
                    // Kill prey
                    prey.alive = false;
                    
                    // Create death particles
                    this.createDeathParticles(prey.x, prey.y, prey.color);
                    
                    // Play sound
                    if (predator === this.player || predator.type === 'player') {
                        this.playSound(this.sounds.eat, 0.5);
                    } else if (prey === this.player || prey.type === 'player') {
                        this.playSound(this.sounds.death, 0.7);
                    }
                    
                    // Remove split cell from playerCells if eaten
                    if (prey.type === 'player' && prey !== this.player) {
                        const index = this.playerCells.indexOf(prey);
                        if (index > -1) {
                            this.playerCells.splice(index, 1);
                        }
                    }
                    
                    // Respawn bot if killed
                    if (prey.type === 'bot') {
                        setTimeout(() => this.respawnBot(prey), 3000);
                    }
                }
            }
        }
    }
    
    applyPassiveMassLoss(deltaTime) {
        // Apply 0.2% mass loss per second to all cells
        const massLossRate = 0.998; // 0.2% loss per second
        const massLossMultiplier = Math.pow(massLossRate, deltaTime);
        
        const allCells = [this.player, ...this.bots].filter(cell => cell && cell.alive);
        
        allCells.forEach(cell => {
            const oldMass = cell.mass;
            cell.mass = Math.max(20, cell.mass * massLossMultiplier); // Don't go below minimum mass
            
            // Update radius if mass changed
            if (cell.mass !== oldMass) {
                cell.radius = Math.sqrt(cell.mass / Math.PI) * 3;
            }
        });
    }
    
    respawnBot(deadBot) {
        if (this.gameState !== 'playing') return;
        
        deadBot.x = Math.random() * this.worldWidth;
        deadBot.y = Math.random() * this.worldHeight;
        deadBot.mass = 20 + Math.random() * 4;
        deadBot.radius = Math.sqrt(deadBot.mass / Math.PI) * 3;
        deadBot.alive = true;
        deadBot.target = null;
        deadBot.lastDirectionChange = 0;
    }
    
    createEatParticles(x, y, color) {
        for (let i = 0; i < 5; i++) {
            const particle = new Particle(
                x + (Math.random() - 0.5) * 10,
                y + (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 100,
                (Math.random() - 0.5) * 100,
                color,
                0.5,
                2
            );
            this.particles.push(particle);
        }
    }
    
    createDeathParticles(x, y, color) {
        for (let i = 0; i < 15; i++) {
            const particle = new Particle(
                x + (Math.random() - 0.5) * 20,
                y + (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 200,
                (Math.random() - 0.5) * 200,
                color,
                1.0,
                5
            );
            this.particles.push(particle);
        }
    }
    
    createVirusExplosion(x, y, color) {
        for (let i = 0; i < 25; i++) {
            const angle = (i / 25) * Math.PI * 2;
            const speed = 100 + Math.random() * 150;
            const particle = new Particle(
                x + Math.cos(angle) * 10,
                y + Math.sin(angle) * 10,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                i % 2 === 0 ? color : '#00ff00',
                1.5,
                6
            );
            this.particles.push(particle);
        }
    }
    
    handleVirusSplitting(cell, virus) {
        const currentTime = Date.now();
        
        // Calculate how many cells to split into - aim for 16 total cells when possible
        const totalPlayerCells = cell === this.player ? 1 + this.playerCells.length : 1;
        const availableSlots = 16 - totalPlayerCells; // How many new cells we can create
        
        // Determine target split count based on mass and available slots
        let targetSplitCount;
        if (cell.mass >= 400) {
            // Large cells: try to split into 16 total parts
            targetSplitCount = Math.min(15, availableSlots); // 15 new + 1 original = 16 total
        } else if (cell.mass >= 200) {
            // Medium cells: split into 8 parts
            targetSplitCount = Math.min(7, availableSlots); // 7 new + 1 original = 8 total
        } else if (cell.mass >= 100) {
            // Small-medium cells: split into 4 parts
            targetSplitCount = Math.min(3, availableSlots); // 3 new + 1 original = 4 total
        } else {
            // Small cells: split into 2 parts
            targetSplitCount = Math.min(1, availableSlots); // 1 new + 1 original = 2 total
        }
        
        if (targetSplitCount <= 0) {
            // Can't split further, just create explosion effect
            this.createVirusExplosion(cell.x, cell.y, cell.color);
            return;
        }
        
        // Calculate mass per cell - ensure even distribution
        const totalMass = cell.mass * 0.98; // Only 2% mass loss for more even splitting
        const totalCells = targetSplitCount + 1; // +1 for original cell
        const massPerCell = totalMass / totalCells;
        
        // Update original cell with exact mass
        cell.mass = massPerCell;
        cell.radius = Math.sqrt(cell.mass / Math.PI) * 3;
        cell.calculateSplitCooldown(totalMass); // Set cooldown based on original mass
        
        // Create split cells with even mass distribution
        const splitCells = [];
        for (let i = 0; i < targetSplitCount; i++) {
            // Distribute cells evenly in a circle
            const angle = (i / targetSplitCount) * Math.PI * 2;
            const distance = cell.radius + 20; // Fixed distance for even distribution
            
            const splitCell = new Cell(
                cell.x + Math.cos(angle) * distance,
                cell.y + Math.sin(angle) * distance,
                massPerCell, // Exact same mass as original
                cell.color,
                cell.name + (i + 1),
                cell.type
            );
            
            // Set up split cell properties
            if (cell === this.player || cell.type === 'player') {
                splitCell.isPlayerSplit = true;
                splitCell.splitTime = currentTime;
                splitCell.calculateSplitCooldown(totalMass);
                
                // Add to player cells
                this.playerCells.push(splitCell);
            } else if (cell.type === 'bot') {
                // For bots, create new bot instances
                const newBot = new Bot(
                    splitCell.x,
                    splitCell.y,
                    splitCell.mass,
                    splitCell.color,
                    splitCell.name,
                    cell.botType
                );
                newBot.calculateSplitCooldown(totalMass);
                this.bots.push(newBot);
            }
            
            // Add initial velocity away from virus - more controlled
            const virusAngle = Math.atan2(splitCell.y - virus.y, splitCell.x - virus.x);
            const splitSpeed = 70; // Fixed speed for consistent spreading
            splitCell.vx = Math.cos(virusAngle) * splitSpeed;
            splitCell.vy = Math.sin(virusAngle) * splitSpeed;
            
            splitCells.push(splitCell);
        }
        
        // Add velocity to original cell
        const originalVirusAngle = Math.atan2(cell.y - virus.y, cell.x - virus.x);
        const originalSpeed = 70; // Same speed as split cells
        cell.vx = Math.cos(originalVirusAngle) * originalSpeed;
        cell.vy = Math.sin(originalVirusAngle) * originalSpeed;
        
        // Create spectacular explosion particles
        this.createVirusExplosion(virus.x, virus.y, cell.color);
        
        // Play explosion sound
        if (cell === this.player || cell.type === 'player') {
            this.playSound(this.sounds.eat, 0.6);
        }
        
        console.log(`Virus split: ${cell.name} split into ${totalCells} equal cells (${Math.round(massPerCell)} mass each)`);
    }
    
    updateCamera() {
        if (!this.player || !this.player.alive) return;
        
        // Calculate maximum zoom level where full game area fits the screen
        if (this.maxZoom === null) {
            const worldAspectRatio = this.worldWidth / this.worldHeight;
            const screenAspectRatio = this.canvas.width / this.canvas.height;
            
            if (worldAspectRatio > screenAspectRatio) {
                // World is wider than screen - limit by width
                this.maxZoom = this.canvas.width / this.worldWidth;
            } else {
                // World is taller than screen - limit by height
                this.maxZoom = this.canvas.height / this.worldHeight;
            }
        }
        
        // Smooth camera following using linear interpolation
        const cameraSmoothing = 0.15; // Lower = smoother, higher = more responsive
        
        // Target camera position
        const targetX = this.player.x;
        const targetY = this.player.y;
        
        // Initialize camera position if not set
        if (this.camera.x === undefined || this.camera.y === undefined) {
            this.camera.x = targetX;
            this.camera.y = targetY;
        }
        
        // Smooth camera movement using linear interpolation
        this.camera.x += (targetX - this.camera.x) * cameraSmoothing;
        this.camera.y += (targetY - this.camera.y) * cameraSmoothing;
        
        // Calculate target zoom based on player size
        const baseZoom = 1;
        let targetZoom = baseZoom * Math.max(0.5, Math.min(2, 50 / this.player.radius));
        
        // Apply zoom limitation - don't zoom out beyond maxZoom
        const isZoomLimited = targetZoom < this.maxZoom;
        if (isZoomLimited) {
            targetZoom = this.maxZoom;
            
            // When zoom is limited, apply visual scaling to the player cell
            const desiredZoom = baseZoom * Math.max(0.5, Math.min(2, 50 / this.player.radius));
            const visualScaleFactor = this.maxZoom / desiredZoom;
            this.player.renderScale = Math.max(1.0, visualScaleFactor);
            
            // Apply visual scaling to player split cells as well
            this.playerCells.forEach(cell => {
                cell.renderScale = Math.max(1.0, visualScaleFactor);
            });
        } else {
            // Reset visual scaling when not zoom limited
            this.player.renderScale = 1.0;
            this.playerCells.forEach(cell => {
                cell.renderScale = 1.0;
            });
        }
        
        // Initialize zoom if not set
        if (this.camera.zoom === undefined) {
            this.camera.zoom = targetZoom;
        }
        
        // Smooth zoom changes
        const zoomSmoothing = 0.1; // Slower zoom changes for stability
        this.camera.zoom += (targetZoom - this.camera.zoom) * zoomSmoothing;
    }
    
    updateUI() {
        if (!this.player) return;
        
        // Update player stats
        document.getElementById('scoreDisplay').textContent = Math.round(this.player.score);
        document.getElementById('massDisplay').textContent = Math.round(this.player.mass);
        
        // Update time
        const gameTime = Math.floor((Date.now() - this.gameStartTime) / 1000);
        const minutes = Math.floor(gameTime / 60);
        const seconds = gameTime % 60;
        document.getElementById('timeDisplay').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Update leaderboard
        this.updateLeaderboard();
    }
    
    updateLeaderboard() {
        // Include all player cells (main player + split cells) in leaderboard calculation
        const allPlayerCells = [this.player, ...this.playerCells].filter(cell => cell && cell.alive);
        const totalPlayerMass = allPlayerCells.reduce((sum, cell) => sum + cell.mass, 0);
        
        // Create a virtual player entry with combined mass for leaderboard
        const playerEntry = {
            name: this.player ? this.player.name : 'Player',
            mass: totalPlayerMass,
            type: 'player',
            isPlayerEntry: true
        };
        
        const allCells = [playerEntry, ...this.bots.filter(bot => bot && bot.alive)];
        allCells.sort((a, b) => b.mass - a.mass);
        
        const leaderboardList = document.getElementById('leaderboardList');
        leaderboardList.innerHTML = '';
        
        // Find player's rank
        let playerRank = -1;
        for (let i = 0; i < allCells.length; i++) {
            if (allCells[i].isPlayerEntry) {
                playerRank = i + 1;
                break;
            }
        }
        
        let cellsToShow = [];
        
        if (playerRank <= 5) {
            // Player is in top 5: show ranks 1-5
            cellsToShow = allCells.slice(0, 5);
        } else {
            // Player is outside top 5: show ranks 1-4 + player's rank
            cellsToShow = allCells.slice(0, 4);
            cellsToShow.push(allCells[playerRank - 1]); // Add player
        }
        
        for (let i = 0; i < cellsToShow.length; i++) {
            const cell = cellsToShow[i];
            const item = document.createElement('div');
            item.className = `leaderboard-item ${cell.type}`;
            
            const rank = document.createElement('span');
            rank.className = 'leaderboard-rank';
            
            // Calculate actual rank in the sorted list
            let actualRank = allCells.indexOf(cell) + 1;
            
            // Add "..." before player rank if showing player outside top 5
            if (playerRank > 5 && i === 4) {
                rank.textContent = `${actualRank}.`;
                // Add visual indicator that this is a gap
                if (actualRank > 5) {
                    const prevRank = document.createElement('div');
                    prevRank.className = 'leaderboard-gap';
                    prevRank.textContent = '...';
                    leaderboardList.appendChild(prevRank);
                }
            } else {
                rank.textContent = `${actualRank}.`;
            }
            
            const name = document.createElement('span');
            name.textContent = cell.name;
            
            const mass = document.createElement('span');
            mass.textContent = Math.round(cell.mass);
            
            item.appendChild(rank);
            item.appendChild(name);
            item.appendChild(mass);
            leaderboardList.appendChild(item);
        }
    }
    
    checkGameOver() {
        // More robust game over check - only trigger when ALL player cells are dead
        const playerAlive = this.player && this.player.alive;
        const splitCellsAlive = this.playerCells.filter(cell => cell && cell.alive).length;
        const totalPlayerCells = (playerAlive ? 1 : 0) + splitCellsAlive;
        
        // Game over only when no player cells remain alive
        if (totalPlayerCells > 0) return;
        
        // Additional safety check - ensure we're not in the middle of a merge operation
        const mergingCells = this.playerCells.filter(cell => 
            cell && cell.mergeState && cell.mergeState.mergeTarget
        ).length;
        
        if (mergingCells > 0) {
            console.log('Delaying game over check - cells are merging');
            return; // Don't trigger game over during merge operations
        }
        
        console.log('Game Over: All player cells eliminated');
        this.gameState = 'gameOver';
        
        // Calculate final stats using the last known player data
        const finalPlayer = this.player || { score: 0, mass: 0 };
        const gameTime = Math.floor((Date.now() - this.gameStartTime) / 1000);
        const minutes = Math.floor(gameTime / 60);
        const seconds = gameTime % 60;
        const botsKilled = Math.floor(finalPlayer.score / 10);
        
        // Update game over screen
        document.getElementById('finalScore').textContent = Math.round(finalPlayer.score);
        document.getElementById('finalTime').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('finalMass').textContent = Math.round(finalPlayer.mass);
        document.getElementById('botsKilled').textContent = botsKilled;
        
        // Show game over screen
        setTimeout(() => this.showGameOverScreen(), 1000);
    }
    
    render() {
        // Clear canvas
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Save context
        this.ctx.save();
        
        // Calculate display dimensions (accounting for DPI scaling)
        const displayWidth = window.innerWidth;
        const displayHeight = window.innerHeight;
        
        // Apply camera transform using display dimensions instead of canvas dimensions
        this.ctx.translate(displayWidth / 2, displayHeight / 2);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        this.ctx.translate(-this.camera.x, -this.camera.y);
        
        // Draw grid
        this.drawGrid();
        
        // Draw food
        this.food.forEach(food => food.render(this.ctx));
        
        // Draw viruses
        this.viruses.forEach(virus => virus.render(this.ctx));
        
        // Draw particles
        this.particles.forEach(particle => particle.render(this.ctx));
        
        // Draw cells
        const allCells = [this.player, ...this.playerCells, ...this.bots].filter(cell => cell && cell.alive);
        allCells.sort((a, b) => a.radius - b.radius); // Draw smaller cells first
        allCells.forEach(cell => cell.render(this.ctx));
        
        // Restore context
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
    
    renderMinimap() {
        const scale = 150 / Math.max(this.worldWidth, this.worldHeight);
        
        // Clear minimap
        this.minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.minimapCtx.fillRect(0, 0, 150, 150);
        
        // Draw world border
        this.minimapCtx.strokeStyle = '#00ffff';
        this.minimapCtx.lineWidth = 1;
        this.minimapCtx.strokeRect(0, 0, this.worldWidth * scale, this.worldHeight * scale);
        
        // Draw cells
        const allCells = [this.player, ...this.bots].filter(cell => cell && cell.alive);
        allCells.forEach(cell => {
            const x = cell.x * scale;
            const y = cell.y * scale;
            const radius = Math.max(1, cell.radius * scale * 0.5);
            
            this.minimapCtx.fillStyle = cell.color;
            this.minimapCtx.beginPath();
            this.minimapCtx.arc(x, y, radius, 0, Math.PI * 2);
            this.minimapCtx.fill();
            
            if (cell === this.player) {
                this.minimapCtx.strokeStyle = '#ffffff';
                this.minimapCtx.lineWidth = 2;
                this.minimapCtx.stroke();
            }
        });
    }
    
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
        this.startGame(playerName);
    }
    
    showStartScreen() {
        this.gameState = 'menu';
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
    
    setupMobileControls() {
        // Enhanced device detection
        const isTouchDevice = this.detectTouchCapability();
        const isIOSSafari = this.detectIOSSafari();
        const isAndroidChrome = this.detectAndroidChrome();
        
        if (isTouchDevice) {
            // Show mobile controls
            document.getElementById('mobileControls').classList.remove('hidden');
            
            // Apply browser-specific optimizations
            this.applyMobileBrowserOptimizations(isIOSSafari, isAndroidChrome);
            
            // Prevent default touch behaviors with better event handling
            this.setupTouchEventPrevention();
        }
        
        // Setup enhanced touch events for canvas
        this.setupCanvasTouchEvents();
        
        // Setup virtual buttons with improved feedback
        this.setupVirtualButtons();
        
        // Setup enhanced joystick
        this.setupJoystick();
        
        // Initialize touch performance monitoring
        this.initializeTouchPerformanceMonitoring();
    }
    
    detectTouchCapability() {
        return (
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            navigator.msMaxTouchPoints > 0 ||
            window.DocumentTouch && document instanceof DocumentTouch
        );
    }
    
    detectIOSSafari() {
        const userAgent = navigator.userAgent.toLowerCase();
        return /iphone|ipad|ipod/.test(userAgent) && /safari/.test(userAgent) && !/chrome/.test(userAgent);
    }
    
    detectAndroidChrome() {
        const userAgent = navigator.userAgent.toLowerCase();
        return /android/.test(userAgent) && /chrome/.test(userAgent);
    }
    
    applyMobileBrowserOptimizations(isIOSSafari, isAndroidChrome) {
        if (isIOSSafari) {
            // iOS Safari specific optimizations
            document.body.style.webkitUserSelect = 'none';
            document.body.style.webkitTouchCallout = 'none';
            document.body.style.webkitTapHighlightColor = 'transparent';
            
            // Prevent zoom on double tap
            let lastTouchEnd = 0;
            document.addEventListener('touchend', (e) => {
                const now = (new Date()).getTime();
                if (now - lastTouchEnd <= 300) {
                    e.preventDefault();
                }
                lastTouchEnd = now;
            }, false);
        }
        
        if (isAndroidChrome) {
            // Android Chrome specific optimizations
            document.body.style.touchAction = 'manipulation';
            
            // Optimize for Android's touch handling
            this.mobileControls.sensitivity *= 1.1; // Slightly increase sensitivity
        }
        
        // Universal mobile optimizations
        document.body.style.userSelect = 'none';
        document.body.style.msUserSelect = 'none';
        document.body.style.mozUserSelect = 'none';
    }
    
    setupTouchEventPrevention() {
        // More selective touch event prevention
        const preventDefaultElements = [this.canvas, document.getElementById('mobileControls')];
        
        preventDefaultElements.forEach(element => {
            if (element) {
                element.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                }, { passive: false });
                
                element.addEventListener('touchmove', (e) => {
                    e.preventDefault();
                }, { passive: false });
                
                element.addEventListener('touchend', (e) => {
                    e.preventDefault();
                }, { passive: false });
            }
        });
        
        // Allow scrolling on UI elements
        const allowScrollElements = document.querySelectorAll('.hud, .leaderboard, .pause-menu');
        allowScrollElements.forEach(element => {
            element.addEventListener('touchmove', (e) => {
                e.stopPropagation();
            }, { passive: true });
        });
    }
    
    setupCanvasTouchEvents() {
        // Enhanced touch event handling with better coordinate normalization
        this.canvas.addEventListener('touchstart', (e) => this.handleEnhancedTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleEnhancedTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleEnhancedTouchEnd(e), { passive: false });
        this.canvas.addEventListener('touchcancel', (e) => this.handleTouchCancel(e), { passive: false });
    }
    
    initializeTouchPerformanceMonitoring() {
        this.touchPerformance = {
            lastTouchTime: 0,
            touchEventCount: 0,
            averageResponseTime: 0,
            responseTimeHistory: []
        };
    }
    
    setupVirtualButtons() {
        const splitButton = document.getElementById('splitButton');
        const ejectButton = document.getElementById('ejectButton');
        
        // Split button with enhanced feedback
        splitButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.gameState === 'playing' && this.player && this.player.alive) {
                this.splitPlayer();
                this.addHapticFeedback();
                this.addVisualFeedback(splitButton);
            }
        }, { passive: false });
        
        splitButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.gameState === 'playing' && this.player && this.player.alive) {
                this.splitPlayer();
                this.addVisualFeedback(splitButton);
            }
        });
        
        // Eject button with enhanced feedback
        ejectButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.gameState === 'playing' && this.player && this.player.alive) {
                this.ejectMass();
                this.addHapticFeedback();
                this.addVisualFeedback(ejectButton);
            }
        }, { passive: false });
        
        ejectButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.gameState === 'playing' && this.player && this.player.alive) {
                this.ejectMass();
                this.addVisualFeedback(ejectButton);
            }
        });
        
        // Setup touch settings
        this.setupTouchSettings();
        
        // Update button states based on cooldowns
        this.updateVirtualButtonStates();
    }
    
    setupTouchSettings() {
        const settingsToggle = document.getElementById('settingsToggle');
        const touchSettings = document.getElementById('touchSettings');
        const closeSettings = document.getElementById('closeSettings');
        const sensitivitySlider = document.getElementById('sensitivitySlider');
        const sensitivityValue = document.getElementById('sensitivityValue');
        const hapticToggle = document.getElementById('hapticToggle');
        const visualFeedbackToggle = document.getElementById('visualFeedbackToggle');
        
        // Settings toggle
        settingsToggle.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleTouchSettings();
        }, { passive: false });
        
        settingsToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleTouchSettings();
        });
        
        // Close settings
        closeSettings.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.hideTouchSettings();
        }, { passive: false });
        
        closeSettings.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.hideTouchSettings();
        });
        
        // Sensitivity slider
        sensitivitySlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.mobileControls.sensitivity = value;
            sensitivityValue.textContent = value.toFixed(1);
            this.updateSensitivityIndicator(value);
            
            // Save to localStorage
            localStorage.setItem('miniagar_touch_sensitivity', value);
        });
        
        // Haptic feedback toggle
        hapticToggle.addEventListener('change', (e) => {
            this.mobileControls.hapticEnabled = e.target.checked;
            localStorage.setItem('miniagar_haptic_enabled', e.target.checked);
        });
        
        // Visual feedback toggle
        visualFeedbackToggle.addEventListener('change', (e) => {
            this.mobileControls.visualFeedback = e.target.checked;
            localStorage.setItem('miniagar_visual_feedback', e.target.checked);
        });
        
        // Load saved settings
        this.loadTouchSettings();
    }
    
    loadTouchSettings() {
        // Load sensitivity
        const savedSensitivity = localStorage.getItem('miniagar_touch_sensitivity');
        if (savedSensitivity) {
            const sensitivity = parseFloat(savedSensitivity);
            this.mobileControls.sensitivity = sensitivity;
            document.getElementById('sensitivitySlider').value = sensitivity;
            document.getElementById('sensitivityValue').textContent = sensitivity.toFixed(1);
            this.updateSensitivityIndicator(sensitivity);
        }
        
        // Load haptic setting
        const savedHaptic = localStorage.getItem('miniagar_haptic_enabled');
        if (savedHaptic !== null) {
            const hapticEnabled = savedHaptic === 'true';
            this.mobileControls.hapticEnabled = hapticEnabled;
            document.getElementById('hapticToggle').checked = hapticEnabled;
        }
        
        // Load visual feedback setting
        const savedVisualFeedback = localStorage.getItem('miniagar_visual_feedback');
        if (savedVisualFeedback !== null) {
            const visualFeedback = savedVisualFeedback === 'true';
            this.mobileControls.visualFeedback = visualFeedback;
            document.getElementById('visualFeedbackToggle').checked = visualFeedback;
        }
    }
    
    toggleTouchSettings() {
        const settingsToggle = document.getElementById('settingsToggle');
        const touchSettings = document.getElementById('touchSettings');
        
        if (touchSettings.classList.contains('hidden')) {
            touchSettings.classList.remove('hidden');
            settingsToggle.classList.add('active');
        } else {
            touchSettings.classList.add('hidden');
            settingsToggle.classList.remove('active');
        }
    }
    
    hideTouchSettings() {
        const settingsToggle = document.getElementById('settingsToggle');
        const touchSettings = document.getElementById('touchSettings');
        
        touchSettings.classList.add('hidden');
        settingsToggle.classList.remove('active');
    }
    
    updateSensitivityIndicator(sensitivity) {
        const sensitivityBar = document.querySelector('.sensitivity-bar');
        if (sensitivityBar) {
            // Map sensitivity (0.5-2.0) to percentage (0-100%)
            const percentage = ((sensitivity - 0.5) / 1.5) * 100;
            sensitivityBar.style.width = `${percentage}%`;
        }
    }
    
    addVisualFeedback(button) {
        if (!this.mobileControls.visualFeedback) return;
        
        const ripple = button.querySelector('.btn-ripple');
        if (ripple) {
            // Reset ripple animation
            ripple.style.width = '0';
            ripple.style.height = '0';
            ripple.style.opacity = '0';
            
            // Trigger ripple effect
            setTimeout(() => {
                ripple.style.width = '100px';
                ripple.style.height = '100px';
                ripple.style.opacity = '1';
            }, 10);
            
            // Reset after animation
            setTimeout(() => {
                ripple.style.width = '0';
                ripple.style.height = '0';
                ripple.style.opacity = '0';
            }, 300);
        }
    }
    
    setupJoystick() {
        const joystickToggle = document.getElementById('joystickToggle');
        const touchJoystick = document.getElementById('touchJoystick');
        const joystickOuter = document.querySelector('.joystick-outer');
        const joystickInner = document.querySelector('.joystick-inner');
        
        // Joystick toggle
        joystickToggle.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleJoystick();
        }, { passive: false });
        
        joystickToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleJoystick();
        });
        
        // Joystick touch events
        joystickOuter.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleJoystickStart(e);
        }, { passive: false });
        
        joystickOuter.addEventListener('touchmove', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleJoystickMove(e);
        }, { passive: false });
        
        joystickOuter.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleJoystickEnd(e);
        }, { passive: false });
    }
    
    // Enhanced touch event handlers
    handleEnhancedTouchStart(e) {
        if (this.gameState !== 'playing') return;
        
        e.preventDefault();
        const currentTime = performance.now();
        
        // Update touch performance metrics
        this.touchPerformance.lastTouchTime = currentTime;
        this.touchPerformance.touchEventCount++;
        
        // Get the first touch point with enhanced coordinate calculation
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        
        // Apply device pixel ratio correction for accurate coordinates
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        this.touch.active = true;
        this.touch.x = (touch.clientX - rect.left) * scaleX / this.performance.adaptiveRatio;
        this.touch.y = (touch.clientY - rect.top) * scaleY / this.performance.adaptiveRatio;
        this.touch.startX = this.touch.x;
        this.touch.startY = this.touch.y;
        
        // Calculate touch velocity for smoother movement
        this.mobileControls.touchVelocity.x = 0;
        this.mobileControls.touchVelocity.y = 0;
        
        this.updateEnhancedTouchWorldPosition();
    }
    
    handleEnhancedTouchMove(e) {
        if (this.gameState !== 'playing' || !this.touch.active) return;
        
        e.preventDefault();
        const currentTime = performance.now();
        
        // Get the first touch point with enhanced coordinate calculation
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        
        // Apply device pixel ratio correction
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const newX = (touch.clientX - rect.left) * scaleX / this.performance.adaptiveRatio;
        const newY = (touch.clientY - rect.top) * scaleY / this.performance.adaptiveRatio;
        
        // Calculate touch velocity for momentum
        const deltaTime = currentTime - this.mobileControls.lastTouchTime;
        if (deltaTime > 0) {
            this.mobileControls.touchVelocity.x = (newX - this.touch.x) / deltaTime;
            this.mobileControls.touchVelocity.y = (newY - this.touch.y) / deltaTime;
        }
        
        this.touch.x = newX;
        this.touch.y = newY;
        this.mobileControls.lastTouchTime = currentTime;
        
        this.updateEnhancedTouchWorldPosition();
    }
    
    handleEnhancedTouchEnd(e) {
        e.preventDefault();
        
        this.touch.active = false;
        
        // Apply momentum for smoother movement continuation
        if (this.mobileControls.touchVelocity.x !== 0 || this.mobileControls.touchVelocity.y !== 0) {
            this.applyTouchMomentum();
        }
        
        // Reset touch velocity
        this.mobileControls.touchVelocity.x = 0;
        this.mobileControls.touchVelocity.y = 0;
    }
    
    handleTouchCancel(e) {
        e.preventDefault();
        
        // Handle touch cancellation (e.g., when user receives a call)
        this.touch.active = false;
        this.mobileControls.touchVelocity.x = 0;
        this.mobileControls.touchVelocity.y = 0;
        
        // Reset joystick if active
        if (this.mobileControls.joystickActive) {
            this.mobileControls.joystickActive = false;
            const joystickInner = document.querySelector('.joystick-inner');
            if (joystickInner) {
                joystickInner.style.transform = 'translate(-50%, -50%)';
            }
        }
    }
    
    // Legacy touch handlers for backward compatibility
    handleTouchStart(e) {
        this.handleEnhancedTouchStart(e);
    }
    
    handleTouchMove(e) {
        this.handleEnhancedTouchMove(e);
    }
    
    handleTouchEnd(e) {
        this.handleEnhancedTouchEnd(e);
    }
    
    updateEnhancedTouchWorldPosition() {
        if (!this.player || !this.touch.active) return;
        
        // Use display dimensions for consistent coordinate calculation
        const displayWidth = window.innerWidth;
        const displayHeight = window.innerHeight;
        
        // Calculate world position from touch using display dimensions with sensitivity adjustment
        const rawWorldX = (this.touch.x - displayWidth / 2) / this.camera.zoom + this.camera.x;
        const rawWorldY = (this.touch.y - displayHeight / 2) / this.camera.zoom + this.camera.y;
        
        // Apply sensitivity and smoothing
        const sensitivity = this.mobileControls.sensitivity;
        const smoothing = this.mobileControls.smoothing;
        
        // Initialize if not set
        if (this.touch.worldX === undefined) {
            this.touch.worldX = rawWorldX;
            this.touch.worldY = rawWorldY;
        } else {
            // Apply smoothing for more responsive touch control
            this.touch.worldX += (rawWorldX - this.touch.worldX) * (1 - smoothing) * sensitivity;
            this.touch.worldY += (rawWorldY - this.touch.worldY) * (1 - smoothing) * sensitivity;
        }
        
        // If not in joystick mode, update mouse position for movement
        if (!this.mobileControls.joystickMode) {
            this.mouse.worldX = this.touch.worldX;
            this.mouse.worldY = this.touch.worldY;
        }
    }
    
    updateTouchWorldPosition() {
        // Legacy function - redirect to enhanced version
        this.updateEnhancedTouchWorldPosition();
    }
    
    applyTouchMomentum() {
        if (!this.player || !this.mobileControls.touchVelocity) return;
        
        // Apply momentum for smoother movement continuation
        const momentumFactor = 0.3;
        const maxMomentumDistance = 50;
        
        // Calculate momentum-based target position
        const momentumX = this.mobileControls.touchVelocity.x * momentumFactor;
        const momentumY = this.mobileControls.touchVelocity.y * momentumFactor;
        
        // Limit momentum distance
        const momentumDistance = Math.sqrt(momentumX * momentumX + momentumY * momentumY);
        if (momentumDistance > maxMomentumDistance) {
            const scale = maxMomentumDistance / momentumDistance;
            this.mouse.worldX = this.player.x + momentumX * scale;
            this.mouse.worldY = this.player.y + momentumY * scale;
        } else {
            this.mouse.worldX = this.player.x + momentumX;
            this.mouse.worldY = this.player.y + momentumY;
        }
        
        // Gradually reduce momentum over time
        setTimeout(() => {
            if (this.mobileControls.touchVelocity) {
                this.mobileControls.touchVelocity.x *= 0.8;
                this.mobileControls.touchVelocity.y *= 0.8;
            }
        }, 100);
    }
    
    toggleJoystick() {
        this.mobileControls.joystickMode = !this.mobileControls.joystickMode;
        
        const joystickToggle = document.getElementById('joystickToggle');
        const touchJoystick = document.getElementById('touchJoystick');
        
        if (this.mobileControls.joystickMode) {
            joystickToggle.classList.add('active');
            touchJoystick.classList.remove('hidden');
        } else {
            joystickToggle.classList.remove('active');
            touchJoystick.classList.add('hidden');
            this.mobileControls.joystickActive = false;
        }
    }
    
    handleJoystickStart(e) {
        if (!this.mobileControls.joystickMode) return;
        
        const touch = e.touches[0];
        const joystickOuter = document.querySelector('.joystick-outer');
        const rect = joystickOuter.getBoundingClientRect();
        
        this.mobileControls.joystickActive = true;
        this.mobileControls.joystickCenter.x = rect.left + rect.width / 2;
        this.mobileControls.joystickCenter.y = rect.top + rect.height / 2;
        
        this.updateJoystickPosition(touch.clientX, touch.clientY);
    }
    
    handleJoystickMove(e) {
        if (!this.mobileControls.joystickMode || !this.mobileControls.joystickActive) return;
        
        const touch = e.touches[0];
        this.updateJoystickPosition(touch.clientX, touch.clientY);
    }
    
    handleJoystickEnd(e) {
        if (!this.mobileControls.joystickMode) return;
        
        this.mobileControls.joystickActive = false;
        
        // Reset joystick to center
        const joystickInner = document.querySelector('.joystick-inner');
        joystickInner.style.transform = 'translate(-50%, -50%)';
    }
    
    updateJoystickPosition(touchX, touchY) {
        const dx = touchX - this.mobileControls.joystickCenter.x;
        const dy = touchY - this.mobileControls.joystickCenter.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Constrain to joystick radius
        const maxDistance = this.mobileControls.joystickRadius;
        let constrainedX = dx;
        let constrainedY = dy;
        
        if (distance > maxDistance) {
            constrainedX = (dx / distance) * maxDistance;
            constrainedY = (dy / distance) * maxDistance;
        }
        
        // Update joystick visual
        const joystickInner = document.querySelector('.joystick-inner');
        joystickInner.style.transform = `translate(calc(-50% + ${constrainedX}px), calc(-50% + ${constrainedY}px))`;
        
        // Update movement if outside deadzone
        if (distance > this.mobileControls.joystickDeadzone && this.player) {
            const normalizedX = constrainedX / maxDistance;
            const normalizedY = constrainedY / maxDistance;
            
            // Calculate target world position based on joystick input
            const moveDistance = 100; // How far ahead to target
            this.mouse.worldX = this.player.x + normalizedX * moveDistance;
            this.mouse.worldY = this.player.y + normalizedY * moveDistance;
        }
    }
    
    updateVirtualButtonStates() {
        if (this.gameState !== 'playing') return;
        
        const currentTime = Date.now();
        const splitButton = document.getElementById('splitButton');
        const ejectButton = document.getElementById('ejectButton');
        
        // Update split button
        const canSplit = this.player && this.player.alive && this.player.mass >= 25;
        if (canSplit) {
            splitButton.classList.remove('disabled');
        } else {
            splitButton.classList.add('disabled');
        }
        
        // Update eject button
        const canEject = this.player && this.player.alive && this.player.mass >= 30 && 
                        (currentTime - this.lastMassEjection >= 500);
        if (canEject) {
            ejectButton.classList.remove('disabled');
        } else {
            ejectButton.classList.add('disabled');
        }
    }
    
    addHapticFeedback() {
        // Add haptic feedback if supported
        if (navigator.vibrate) {
            navigator.vibrate(50); // Short vibration
        }
    }
}

// Cell class
class Cell {
    constructor(x, y, mass, color, name, type) {
        this.x = x;
        this.y = y;
        this.mass = mass;
        this.radius = Math.sqrt(mass / Math.PI) * 3;
        this.color = color;
        this.name = name;
        this.type = type;
        this.vx = 0;
        this.vy = 0;
        this.alive = true;
        this.score = 0;
        
        // Enhanced split/merge mechanics
        this.splitCooldown = {
            baseDuration: 30000,  // 30 seconds base
            additionalDuration: 0,  // 1 second per 50 mass
            expiryTime: 0
        };
        this.splitHistory = {
            lastSplitTime: 0,
            splitCount: 0,
            originalMass: mass  // Mass at time of split
        };
        this.mergeState = {
            canMerge: false,
            mergeTarget: null,
            mergeDuration: 0,
            mergeProgress: 0,
            maxMergeDistance: 0
        };
        this.movementState = {
            isStill: false,
            stillStartTime: 0,
            speedThreshold: 0.1, // Further reduced to prevent movement blocking
            stillDuration: 0,
            postMergeGracePeriod: 0 // Grace period after merging
        };
        
        // Visual properties
        this.renderScale = 1.0;  // For visual growth when zoom limited
    }
    
    calculateSplitCooldown(massAtSplit) {
        const additionalCooldown = Math.floor(massAtSplit / 50) * 1000;
        this.splitCooldown.additionalDuration = additionalCooldown;
        this.splitCooldown.expiryTime = Date.now() + 
            this.splitCooldown.baseDuration + 
            additionalCooldown;
        this.splitHistory.originalMass = massAtSplit;
    }
    
    canSplit(currentCellCount) {
        return currentCellCount < 16 && 
               this.mass >= 25;  // Minimum mass to split, no cooldown restriction
    }
    
    canMergeWith(otherCell) {
        const currentTime = Date.now();
        
        // Basic eligibility checks
        if (!this.alive || !otherCell.alive) return false;
        if (this === otherCell) return false;
        
        // Check if both cells are moving slowly enough to merge
        const thisSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const otherSpeed = Math.sqrt(otherCell.vx * otherCell.vx + otherCell.vy * otherCell.vy);
        const MAX_MERGE_SPEED = 8.0; // Further increased to allow merging during normal movement
        
        // Calculate dynamic cooldown based on combined mass
        const combinedMass = this.mass + otherCell.mass;
        const baseCooldown = 1500; // Reduced to 1.5 seconds minimum for faster merging
        const massMultiplier = Math.min(1.5, combinedMass / 300); // Reduced scaling for faster merging
        const dynamicCooldown = baseCooldown * massMultiplier;
        
        // Check minimum time since split with dynamic cooldown
        const timeSinceSplit = Math.min(
            currentTime - (this.splitHistory?.lastSplitTime || 0),
            currentTime - (otherCell.splitHistory?.lastSplitTime || 0)
        );
        
        // Check if cells belong to the same player
        const thisIsPlayerCell = (this.type === 'player' || this.isPlayerSplit);
        const otherIsPlayerCell = (otherCell.type === 'player' || otherCell.isPlayerSplit);
        const bothPlayerCells = thisIsPlayerCell && otherIsPlayerCell;
        
        // Check merge conditions
        const speedOk = thisSpeed <= MAX_MERGE_SPEED && otherSpeed <= MAX_MERGE_SPEED;
        const cooldownOk = timeSinceSplit >= dynamicCooldown;
        
        return speedOk && cooldownOk && bothPlayerCells;
    }
    
    updateMovementState(deltaTime) {
        const currentTime = Date.now();
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const wasStill = this.movementState.isStill;
        
        // Update post-merge grace period
        if (this.movementState.postMergeGracePeriod > 0) {
            this.movementState.postMergeGracePeriod -= deltaTime * 1000; // Convert to milliseconds
        }
        
        // During grace period, always allow movement
        if (this.movementState.postMergeGracePeriod > 0) {
            this.movementState.isStill = false;
            this.movementState.stillStartTime = 0;
            this.movementState.stillDuration = 0;
            return;
        }
        
        // Relaxed stillness detection - lower threshold and more forgiving
        this.movementState.isStill = speed < this.movementState.speedThreshold;
        
        if (this.movementState.isStill) {
            if (!wasStill) {
                this.movementState.stillStartTime = currentTime;
                this.movementState.stillDuration = 0;
            } else {
                this.movementState.stillDuration = currentTime - this.movementState.stillStartTime;
            }
        } else {
            // Reset stillness tracking when moving
            this.movementState.stillStartTime = 0;
            this.movementState.stillDuration = 0;
        }
    }
    
    getSpeedMultiplier() {
        // Speed decreases as mass increases
        return Math.max(0.1, 1 / Math.sqrt(this.mass / 100));
    }
    
    render(ctx) {
        if (!this.alive) return;
        
        // Apply visual scaling for zoom-limited cells
        const visualRadius = this.radius * this.renderScale;
        
        // Draw cell body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, visualRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw glow effect
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, visualRadius * 1.5);
        gradient.addColorStop(0, this.color + '40');
        gradient.addColorStop(1, this.color + '00');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, visualRadius * 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * this.renderScale;
        ctx.beginPath();
        ctx.arc(this.x, this.y, visualRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw name
        if (visualRadius > 15) {
            ctx.fillStyle = '#ffffff';
            ctx.font = `${Math.min(visualRadius / 3, 16 * this.renderScale)}px Orbitron`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.name, this.x, this.y);
        }
    }
}

// Bot class with AI
class Bot extends Cell {
    constructor(x, y, mass, color, name, botType) {
        super(x, y, mass, color, name, 'bot');
        this.botType = botType;
        this.target = null;
        this.lastDirectionChange = 0;
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.aggressionLevel = this.getAggressionLevel();
        this.fearLevel = this.getFearLevel();
    }
    
    getAggressionLevel() {
        switch (this.botType) {
            case 'aggressive': return 0.9;
            case 'passive': return 0.1;
            case 'balanced': return 0.5;
            case 'opportunistic': return 0.3;
            default: return 0.5;
        }
    }
    
    getFearLevel() {
        switch (this.botType) {
            case 'aggressive': return 0.2;
            case 'passive': return 0.8;
            case 'balanced': return 0.5;
            case 'opportunistic': return 0.6;
            default: return 0.5;
        }
    }
    
    update(deltaTime, game) {
        if (!this.alive) return;
        
        this.findTarget(game);
        this.moveTowardsTarget(deltaTime, game);
        this.updatePosition(deltaTime);
        this.stayInBounds(game);
    }
    
    findTarget(game) {
        const currentTime = Date.now();
        
        // Change target every 2-5 seconds or if current target is invalid
        if (currentTime - this.lastDirectionChange > 2000 + Math.random() * 3000 || 
            !this.isValidTarget(this.target, game)) {
            
            this.target = this.selectBestTarget(game);
            this.lastDirectionChange = currentTime;
        }
    }
    
    isValidTarget(target, game) {
        if (!target) return false;
        
        if (target.type === 'food') {
            return game.food.includes(target);
        } else if (target.type === 'bot' || target.type === 'player') {
            return target.alive;
        }
        
        return false;
    }
    
    selectBestTarget(game) {
        const allTargets = [...game.food];
        const allCells = [game.player, ...game.bots].filter(cell => cell && cell.alive && cell !== this);
        
        // Add cells as potential targets based on bot type with enhanced survival logic
        allCells.forEach(cell => {
            const canEat = this.mass > cell.mass * 1.25;
            const shouldFear = cell.mass > this.mass * 1.1; // Lower threshold for fear
            const isSignificantlyLarger = cell.mass > this.mass * 2.0; // Very dangerous cells
            
            // Never target cells that are significantly larger - prioritize survival
            if (isSignificantlyLarger) {
                return; // Skip this cell entirely
            }
            
            if (canEat && Math.random() < this.aggressionLevel) {
                allTargets.push(cell);
            } else if (!shouldFear || Math.random() > this.fearLevel * 1.5) { // Increased fear factor
                // Sometimes consider equal-sized targets for opportunistic behavior
                if (this.botType === 'opportunistic' && Math.abs(this.mass - cell.mass) < 5) {
                    allTargets.push(cell);
                }
            }
        });
        
        if (allTargets.length === 0) {
            return this.createWanderTarget(game);
        }
        
        // Find closest target
        let bestTarget = null;
        let bestScore = -1;
        
        allTargets.forEach(target => {
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            let score = 0;
            
            if (target.type === 'food') {
                score = 100 / (distance + 1); // Prefer close food
            } else {
                const massRatio = target.mass / this.mass;
                if (massRatio < 0.8) {
                    score = (200 / (distance + 1)) * (1 - massRatio); // Prefer smaller, closer cells
                } else if (this.botType === 'opportunistic') {
                    score = 50 / (distance + 1); // Opportunistic behavior
                }
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestTarget = target;
            }
        });
        
        return bestTarget || this.createWanderTarget(game);
    }
    
    createWanderTarget(game) {
        // Create a virtual target for wandering
        this.wanderAngle += (Math.random() - 0.5) * 0.5;
        const wanderDistance = 100;
        
        return {
            x: this.x + Math.cos(this.wanderAngle) * wanderDistance,
            y: this.y + Math.sin(this.wanderAngle) * wanderDistance,
            type: 'wander'
        };
    }
    
    moveTowardsTarget(deltaTime, game) {
        if (!this.target) return;
        
        // Check for threats first
        const threats = this.findThreats(game);
        if (threats.length > 0 && Math.random() < this.fearLevel) {
            this.fleeFromThreats(threats, game);
            return;
        }
        
        // Move towards target with smoothing
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 5) {
            const speed = game.baseSpeed / Math.sqrt(this.mass / 100);
            const targetVx = (dx / distance) * speed;
            const targetVy = (dy / distance) * speed;
            
            // Smooth velocity changes to prevent erratic movement
            const smoothingFactor = 0.15; // Lower = smoother movement
            this.vx += (targetVx - this.vx) * smoothingFactor;
            this.vy += (targetVy - this.vy) * smoothingFactor;
            
            // Add slight randomness to prevent robotic movement
            const randomFactor = 0.1;
            this.vx += (Math.random() - 0.5) * randomFactor;
            this.vy += (Math.random() - 0.5) * randomFactor;
        } else {
            this.vx *= 0.9;
            this.vy *= 0.9;
        }
    }
    
    findThreats(game) {
        const threats = [];
        const allCells = [game.player, ...game.bots].filter(cell => cell && cell.alive && cell !== this);
        
        allCells.forEach(cell => {
            const dx = cell.x - this.x;
            const dy = cell.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Enhanced threat detection with multiple threat levels
            const canEatUs = cell.mass > this.mass * 1.1; // Lower threshold for threat detection
            const isSignificantThreat = cell.mass > this.mass * 2.0; // Very dangerous cells
            
            // Expand detection range based on threat level
            let detectionRange = 150;
            if (isSignificantThreat) {
                detectionRange = 250; // Detect very dangerous cells from farther away
            } else if (canEatUs) {
                detectionRange = 200; // Detect moderately dangerous cells
            }
            
            if (canEatUs && distance < detectionRange) {
                // Add threat weight based on mass difference and distance
                const massRatio = cell.mass / this.mass;
                const threatWeight = massRatio * (1 / (distance + 1));
                threats.push({ cell, distance, dx, dy, weight: threatWeight });
            }
        });
        
        return threats.sort((a, b) => b.weight - a.weight); // Sort by threat weight (highest first)
    }
    
    fleeFromThreats(threats, game) {
        let fleeX = 0;
        let fleeY = 0;
        
        threats.forEach(threat => {
            const weight = 1 / (threat.distance + 1);
            fleeX -= threat.dx * weight;
            fleeY -= threat.dy * weight;
        });
        
        const fleeLength = Math.sqrt(fleeX * fleeX + fleeY * fleeY);
        if (fleeLength > 0) {
            const speed = game.baseSpeed / Math.sqrt(this.mass / 100) * 1.2; // Flee faster
            const targetVx = (fleeX / fleeLength) * speed;
            const targetVy = (fleeY / fleeLength) * speed;
            
            // Apply smoothing even when fleeing to prevent jittery movement
            const smoothingFactor = 0.25; // Slightly more responsive when fleeing
            this.vx += (targetVx - this.vx) * smoothingFactor;
            this.vy += (targetVy - this.vy) * smoothingFactor;
        }
    }
    
    updatePosition(deltaTime) {
        this.x += this.vx * deltaTime * 60; // Normalize for frame rate
        this.y += this.vy * deltaTime * 60;
        
        // Apply friction
        this.vx *= 0.98;
        this.vy *= 0.98;
    }
    
    stayInBounds(game) {
        this.x = Math.max(this.radius, Math.min(game.worldWidth - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(game.worldHeight - this.radius, this.y));
    }
}

// Food class
class Food {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 3;
        this.type = 'food';
        this.color = this.getRandomColor();
        this.pulsePhase = Math.random() * Math.PI * 2;
    }
    
    getRandomColor() {
        const colors = [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
            '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43',
            '#10ac84', '#ee5a24', '#0984e3', '#6c5ce7', '#a29bfe'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    render(ctx) {
        // Pulsing effect
        this.pulsePhase += 0.1;
        const pulseScale = 1 + Math.sin(this.pulsePhase) * 0.2;
        const currentRadius = this.radius * pulseScale;
        
        // Draw glow
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, currentRadius * 2);
        gradient.addColorStop(0, this.color + '80');
        gradient.addColorStop(1, this.color + '00');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius * 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw food
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw sparkle
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        ctx.stroke();
    }
}

// Virus class
class Virus {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.maxRadius = 20;
        this.radius = 5; // Start small
        this.type = 'virus';
        this.color = '#00AA00';
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.spikes = 16;
        this.spawnTime = Date.now();
        this.growthDuration = 10000; // 10 seconds to grow
        this.isFullyGrown = false;
    }
    
    update(deltaTime) {
        const currentTime = Date.now();
        const growthProgress = Math.min(1, (currentTime - this.spawnTime) / this.growthDuration);
        
        // Grow from 5 to maxRadius over 10 seconds
        this.radius = 5 + (this.maxRadius - 5) * growthProgress;
        
        // Mark as fully grown when growth is complete
        if (growthProgress >= 1 && !this.isFullyGrown) {
            this.isFullyGrown = true;
        }
    }
    
    isDangerous() {
        return this.isFullyGrown;
    }

    render(ctx) {
        // Pulsing effect
        this.pulsePhase += 0.05;
        const pulseScale = 1 + Math.sin(this.pulsePhase) * 0.1;
        const currentRadius = this.radius * pulseScale;

        // Draw glow effect
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, currentRadius * 2);
        gradient.addColorStop(0, this.color + '60');
        gradient.addColorStop(1, this.color + '00');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius * 2, 0, Math.PI * 2);
        ctx.fill();

        // Draw main virus body (green circle)
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();

        // Draw 16 spikes with alternating lengths
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#007700';
        ctx.lineWidth = 1;

        for (let i = 0; i < this.spikes; i++) {
            const angle = (i / this.spikes) * Math.PI * 2;
            
            // Alternating spike lengths: even indices = long (R/2), odd indices = short (R/3)
            const spikeLength = (i % 2 === 0) ? currentRadius / 2 : currentRadius / 3;
            
            // Calculate spike end position
            const spikeEndX = this.x + Math.cos(angle) * (currentRadius + spikeLength);
            const spikeEndY = this.y + Math.sin(angle) * (currentRadius + spikeLength);
            
            // Draw spike line
            ctx.beginPath();
            ctx.moveTo(this.x + Math.cos(angle) * currentRadius, this.y + Math.sin(angle) * currentRadius);
            ctx.lineTo(spikeEndX, spikeEndY);
            ctx.stroke();
            
            // Draw small ellipse at spike end
            const ellipseSize = currentRadius / 8;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.save();
            ctx.translate(spikeEndX, spikeEndY);
            ctx.rotate(angle + Math.PI / 2);
            ctx.scale(1, 0.6);
            ctx.arc(0, 0, ellipseSize, 0, Math.PI * 2);
            ctx.restore();
            ctx.fill();
        }

        // Optional: Add subtle inner detail
        ctx.fillStyle = '#00CC00';
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius * 0.7, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Particle class for visual effects
class Particle {
    constructor(x, y, vx, vy, color, life, size) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = size;
    }
    
    update(deltaTime) {
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        this.vx *= 0.98;
        this.vy *= 0.98;
        this.life -= deltaTime;
    }
    
    render(ctx) {
        if (this.life <= 0) return;
        
        const alpha = this.life / this.maxLife;
        const currentSize = this.size * alpha;
        
        ctx.fillStyle = this.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentSize, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    const game = new MiniAgar();
});
