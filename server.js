const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Game state
const gameState = {
    players: new Map(),
    bots: [],
    food: [],
    viruses: [],
    worldWidth: 2000,
    worldHeight: 2000,
    maxFood: 200,
    virusCount: 8,
    botCount: 15
};

// Game configuration
const config = {
    tickRate: 60, // Server updates per second
    foodSpawnRate: 2, // food per second
    baseSpeed: 2,
    maxPlayers: 50
};

// Initialize game world
function initializeGameWorld() {
    // Spawn initial food
    for (let i = 0; i < gameState.maxFood; i++) {
        spawnFood();
    }
    
    // Spawn initial viruses
    for (let i = 0; i < gameState.virusCount; i++) {
        spawnVirus();
    }
    
    // Spawn initial bots
    createBots();
    
    console.log(`Game world initialized: ${gameState.food.length} food, ${gameState.viruses.length} viruses, ${gameState.bots.length} bots`);
}

function spawnFood() {
    const food = {
        id: uuidv4(),
        x: Math.random() * gameState.worldWidth,
        y: Math.random() * gameState.worldHeight,
        radius: 3,
        color: getRandomFoodColor(),
        mass: 1
    };
    gameState.food.push(food);
    return food;
}

function spawnVirus() {
    const virus = {
        id: uuidv4(),
        x: Math.random() * gameState.worldWidth,
        y: Math.random() * gameState.worldHeight,
        radius: 20,
        color: '#00AA00',
        spawnTime: Date.now(),
        isFullyGrown: true
    };
    gameState.viruses.push(virus);
    return virus;
}

function getRandomFoodColor() {
    const colors = [
        '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
        '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43',
        '#10ac84', '#ee5a24', '#0984e3', '#6c5ce7', '#a29bfe'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Player management
function createPlayer(socketId, name) {
    const player = {
        id: socketId,
        name: name || 'Player',
        x: gameState.worldWidth / 2 + (Math.random() - 0.5) * 200,
        y: gameState.worldHeight / 2 + (Math.random() - 0.5) * 200,
        mass: 20,
        radius: Math.sqrt(20 / Math.PI) * 3,
        color: getRandomPlayerColor(),
        vx: 0,
        vy: 0,
        alive: true,
        score: 0,
        lastUpdate: Date.now(),
        targetX: 0,
        targetY: 0
    };
    
    gameState.players.set(socketId, player);
    return player;
}

function getRandomPlayerColor() {
    const colors = [
        '#00ffff', '#ff00ff', '#ffff00', '#ff0000', '#00ff00',
        '#0000ff', '#ff8000', '#8000ff', '#00ff80', '#ff0080'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

function removePlayer(socketId) {
    gameState.players.delete(socketId);
}

// Bot management
function createBots() {
    const botTypes = ['aggressive', 'passive', 'balanced', 'opportunistic'];
    const botColors = {
        aggressive: '#ff4444',
        passive: '#4444ff',
        balanced: '#44ff44',
        opportunistic: '#ffff44'
    };
    
    for (let i = 0; i < gameState.botCount; i++) {
        const type = botTypes[i % botTypes.length];
        const bot = {
            id: `bot_${i}`,
            name: `Bot${i + 1}`,
            x: Math.random() * gameState.worldWidth,
            y: Math.random() * gameState.worldHeight,
            mass: 20 + Math.random() * 4,
            radius: Math.sqrt((20 + Math.random() * 4) / Math.PI) * 3,
            color: botColors[type],
            vx: 0,
            vy: 0,
            alive: true,
            score: 0,
            type: 'bot',
            botType: type,
            target: null,
            lastDirectionChange: 0,
            wanderAngle: Math.random() * Math.PI * 2,
            aggressionLevel: getAggressionLevel(type),
            fearLevel: getFearLevel(type)
        };
        gameState.bots.push(bot);
    }
}

function getAggressionLevel(botType) {
    switch (botType) {
        case 'aggressive': return 0.9;
        case 'passive': return 0.1;
        case 'balanced': return 0.5;
        case 'opportunistic': return 0.3;
        default: return 0.5;
    }
}

function getFearLevel(botType) {
    switch (botType) {
        case 'aggressive': return 0.2;
        case 'passive': return 0.8;
        case 'balanced': return 0.5;
        case 'opportunistic': return 0.6;
        default: return 0.5;
    }
}

function updateBots() {
    const currentTime = Date.now();
    const deltaTime = 1 / config.tickRate;
    
    gameState.bots.forEach(bot => {
        if (!bot.alive) return;
        
        // Find target
        findBotTarget(bot, currentTime);
        
        // Move towards target
        moveBotTowardsTarget(bot, deltaTime);
        
        // Update position
        bot.x += bot.vx * deltaTime * 60;
        bot.y += bot.vy * deltaTime * 60;
        
        // Apply friction
        bot.vx *= 0.98;
        bot.vy *= 0.98;
        
        // Keep in bounds
        bot.x = Math.max(bot.radius, Math.min(gameState.worldWidth - bot.radius, bot.x));
        bot.y = Math.max(bot.radius, Math.min(gameState.worldHeight - bot.radius, bot.y));
        
        // Update radius based on mass
        bot.radius = Math.sqrt(bot.mass / Math.PI) * 3;
    });
}

function findBotTarget(bot, currentTime) {
    // Change target every 2-5 seconds or if current target is invalid
    if (currentTime - bot.lastDirectionChange > 2000 + Math.random() * 3000 || 
        !isValidBotTarget(bot.target)) {
        
        bot.target = selectBestBotTarget(bot);
        bot.lastDirectionChange = currentTime;
    }
}

function isValidBotTarget(target) {
    if (!target) return false;
    
    if (target.type === 'food') {
        return gameState.food.includes(target);
    } else if (target.type === 'bot') {
        return gameState.bots.includes(target) && target.alive;
    } else if (target.type === 'player') {
        return Array.from(gameState.players.values()).includes(target) && target.alive;
    }
    
    return false;
}

function selectBestBotTarget(bot) {
    const allTargets = [...gameState.food];
    const allCells = [...Array.from(gameState.players.values()), ...gameState.bots].filter(cell => cell && cell.alive && cell !== bot);
    
    // Add cells as potential targets based on bot type
    allCells.forEach(cell => {
        const canEat = bot.mass > cell.mass * 1.25;
        const shouldFear = cell.mass > bot.mass * 1.1;
        const isSignificantlyLarger = cell.mass > bot.mass * 2.0;
        
        // Never target cells that are significantly larger
        if (isSignificantlyLarger) {
            return;
        }
        
        if (canEat && Math.random() < bot.aggressionLevel) {
            allTargets.push(cell);
        } else if (!shouldFear || Math.random() > bot.fearLevel * 1.5) {
            if (bot.botType === 'opportunistic' && Math.abs(bot.mass - cell.mass) < 5) {
                allTargets.push(cell);
            }
        }
    });
    
    if (allTargets.length === 0) {
        return createWanderTarget(bot);
    }
    
    // Find closest target
    let bestTarget = null;
    let bestScore = -1;
    
    allTargets.forEach(target => {
        const dx = target.x - bot.x;
        const dy = target.y - bot.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        let score = 0;
        
        if (target.type === 'food') {
            score = 100 / (distance + 1);
        } else {
            const massRatio = target.mass / bot.mass;
            if (massRatio < 0.8) {
                score = (200 / (distance + 1)) * (1 - massRatio);
            } else if (bot.botType === 'opportunistic') {
                score = 50 / (distance + 1);
            }
        }
        
        if (score > bestScore) {
            bestScore = score;
            bestTarget = target;
        }
    });
    
    return bestTarget || createWanderTarget(bot);
}

function createWanderTarget(bot) {
    bot.wanderAngle += (Math.random() - 0.5) * 0.5;
    const wanderDistance = 100;
    
    return {
        x: bot.x + Math.cos(bot.wanderAngle) * wanderDistance,
        y: bot.y + Math.sin(bot.wanderAngle) * wanderDistance,
        type: 'wander'
    };
}

function moveBotTowardsTarget(bot, deltaTime) {
    if (!bot.target) return;
    
    // Check for threats first
    const threats = findBotThreats(bot);
    if (threats.length > 0 && Math.random() < bot.fearLevel) {
        fleeFromThreats(bot, threats);
        return;
    }
    
    // Move towards target
    const dx = bot.target.x - bot.x;
    const dy = bot.target.y - bot.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 5) {
        const speed = config.baseSpeed / Math.sqrt(bot.mass / 100);
        const targetVx = (dx / distance) * speed;
        const targetVy = (dy / distance) * speed;
        
        const smoothingFactor = 0.15;
        bot.vx += (targetVx - bot.vx) * smoothingFactor;
        bot.vy += (targetVy - bot.vy) * smoothingFactor;
        
        // Add slight randomness
        const randomFactor = 0.1;
        bot.vx += (Math.random() - 0.5) * randomFactor;
        bot.vy += (Math.random() - 0.5) * randomFactor;
    } else {
        bot.vx *= 0.9;
        bot.vy *= 0.9;
    }
}

function findBotThreats(bot) {
    const threats = [];
    const allCells = [...Array.from(gameState.players.values()), ...gameState.bots].filter(cell => cell && cell.alive && cell !== bot);
    
    allCells.forEach(cell => {
        const dx = cell.x - bot.x;
        const dy = cell.y - bot.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const canEatUs = cell.mass > bot.mass * 1.1;
        const isSignificantThreat = cell.mass > bot.mass * 2.0;
        
        let detectionRange = 150;
        if (isSignificantThreat) {
            detectionRange = 250;
        } else if (canEatUs) {
            detectionRange = 200;
        }
        
        if (canEatUs && distance < detectionRange) {
            const massRatio = cell.mass / bot.mass;
            const threatWeight = massRatio * (1 / (distance + 1));
            threats.push({ cell, distance, dx, dy, weight: threatWeight });
        }
    });
    
    return threats.sort((a, b) => b.weight - a.weight);
}

function fleeFromThreats(bot, threats) {
    let fleeX = 0;
    let fleeY = 0;
    
    threats.forEach(threat => {
        const weight = 1 / (threat.distance + 1);
        fleeX -= threat.dx * weight;
        fleeY -= threat.dy * weight;
    });
    
    const fleeLength = Math.sqrt(fleeX * fleeX + fleeY * fleeY);
    if (fleeLength > 0) {
        const speed = config.baseSpeed / Math.sqrt(bot.mass / 100) * 1.2;
        const targetVx = (fleeX / fleeLength) * speed;
        const targetVy = (fleeY / fleeLength) * speed;
        
        const smoothingFactor = 0.25;
        bot.vx += (targetVx - bot.vx) * smoothingFactor;
        bot.vy += (targetVy - bot.vy) * smoothingFactor;
    }
}

function respawnBot(deadBot) {
    deadBot.x = Math.random() * gameState.worldWidth;
    deadBot.y = Math.random() * gameState.worldHeight;
    deadBot.mass = Math.trunc(20 + Math.random() * 4);
    deadBot.radius = Math.sqrt(deadBot.mass / Math.PI) * 3;
    deadBot.alive = true;
    deadBot.target = null;
    deadBot.lastDirectionChange = 0;
    deadBot.score = 0;
}

// Game logic
function updateGameState() {
    const currentTime = Date.now();
    
    // Update players
    gameState.players.forEach((player, socketId) => {
        if (!player.alive) return;
        
        // Calculate movement towards target
        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 5) {
            const speed = config.baseSpeed / Math.sqrt(player.mass / 100);
            const targetVx = (dx / distance) * speed;
            const targetVy = (dy / distance) * speed;
            
            // Smooth velocity interpolation
            const smoothing = 0.25;
            player.vx += (targetVx - player.vx) * smoothing;
            player.vy += (targetVy - player.vy) * smoothing;
        } else {
            player.vx *= 0.85;
            player.vy *= 0.85;
        }
        
        // Update position
        const deltaTime = 1 / config.tickRate;
        player.x += player.vx * deltaTime * 60;
        player.y += player.vy * deltaTime * 60;
        
        // Keep in bounds
        player.x = Math.max(player.radius, Math.min(gameState.worldWidth - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(gameState.worldHeight - player.radius, player.y));
        
        // Update radius based on mass
        player.radius = Math.sqrt(player.mass / Math.PI) * 3;
    });
    
    // Update bots
    updateBots();
    
    // Check collisions
    checkCollisions();
    
    // Spawn food if needed
    if (Math.random() < config.foodSpawnRate / config.tickRate && gameState.food.length < gameState.maxFood) {
        spawnFood();
    }
    
    // Apply passive mass loss (slow but noticeable - approximately 0.5% per second)
    const allCells = [...Array.from(gameState.players.values()), ...gameState.bots];
    allCells.forEach(cell => {
        if (cell.alive && cell.mass > 20) {
            // Balanced mass loss: 0.9999 per tick = ~0.5% per second
            const massLossRate = 0.9999;
            const newMass = Math.max(20, cell.mass * massLossRate);
            
            // Always apply mass loss (no threshold condition)
            cell.mass = Math.trunc(newMass);
            
            // Log mass loss for debugging (only for players, not bots)
            if (cell.type !== 'bot' && Math.abs(cell.mass - newMass) > 0.01) {
                console.log(`Mass loss: ${cell.name || cell.id} lost ${(cell.mass - newMass).toFixed(3)} mass`);
            }
        }
    });
}

function checkCollisions() {
    const alivePlayers = Array.from(gameState.players.values()).filter(p => p.alive);
    const aliveBots = gameState.bots.filter(b => b.alive);
    const allCells = [...alivePlayers, ...aliveBots];
    
    // Cell vs Food collisions
    allCells.forEach(cell => {
        for (let i = gameState.food.length - 1; i >= 0; i--) {
            const food = gameState.food[i];
            const dx = cell.x - food.x;
            const dy = cell.y - food.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < cell.radius + food.radius) {
                // Eat food
                const oldMass = cell.mass;
                cell.mass = Math.trunc(cell.mass + food.mass);
                cell.score = Math.trunc(cell.score + food.mass);
                gameState.food.splice(i, 1);
                
                // Log food consumption only for players, not bots
                if (cell.type !== 'bot') {
                    console.log(`Food eaten: ${cell.name || cell.id} mass ${Math.round(oldMass)} -> ${Math.round(cell.mass)}`);
                }
            }
        }
    });
    
    // Cell vs Cell collisions
    for (let i = 0; i < allCells.length; i++) {
        for (let j = i + 1; j < allCells.length; j++) {
            const cell1 = allCells[i];
            const cell2 = allCells[j];
            
            const dx = cell1.x - cell2.x;
            const dy = cell1.y - cell2.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < Math.max(cell1.radius, cell2.radius)) {
                let predator, prey;
                const requiredRatio = 1.10;
                
                if (cell1.mass > cell2.mass * requiredRatio) {
                    predator = cell1;
                    prey = cell2;
                } else if (cell2.mass > cell1.mass * requiredRatio) {
                    predator = cell2;
                    prey = cell1;
                } else {
                    continue;
                }
                
                // Log collision details
                console.log(`COLLISION: ${predator.name || predator.id} (${predator.mass}) eats ${prey.name || prey.id} (${prey.mass})`);
                
                // Transfer mass
                const oldPredatorMass = predator.mass;
                predator.mass = Math.trunc(predator.mass + prey.mass);
                predator.score = Math.trunc(predator.score + (prey.type === 'bot' ? 10 : 50));
                
                // Kill prey - CRITICAL STATE CHANGE
                prey.alive = false;
                prey.mass = 0;
                
                // Log the kill event explicitly
                console.log(`PLAYER KILLED: ${prey.name || prey.id} is now DEAD. Predator ${predator.name || predator.id} mass: ${oldPredatorMass} -> ${predator.mass}`);
                
                // If a player was killed, log it prominently
                if (prey.type === 'player' || gameState.players.has(prey.id)) {
                    console.log(`*** GAME OVER EVENT: Player ${prey.name || prey.id} has been eliminated! ***`);
                }
                
                // Respawn bot if killed
                if (prey.type === 'bot') {
                    console.log(`Bot ${prey.name} will respawn in 3 seconds`);
                    setTimeout(() => respawnBot(prey), 3000);
                }
            }
        }
    }
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    
    socket.on('joinGame', (data) => {
        const playerName = data.name || 'Player';
        const player = createPlayer(socket.id, playerName);
        
        // Send initial game state to new player
        socket.emit('gameJoined', {
            playerId: socket.id,
            worldWidth: gameState.worldWidth,
            worldHeight: gameState.worldHeight
        });
        
        // Send current game state
        socket.emit('gameState', {
            players: Array.from(gameState.players.values()),
            food: gameState.food,
            viruses: gameState.viruses,
            timestamp: Date.now()
        });
        
        console.log(`Player ${playerName} (${socket.id}) joined the game`);
    });
    
    socket.on('playerInput', (data) => {
        const player = gameState.players.get(socket.id);
        if (player && player.alive) {
            player.targetX = data.targetX;
            player.targetY = data.targetY;
            player.lastUpdate = Date.now();
        }
    });
    
    socket.on('playerSplit', () => {
        const player = gameState.players.get(socket.id);
        if (player && player.alive && player.mass >= 25) {
            // Simple split: reduce mass by half
            player.mass = Math.trunc(player.mass / 2);
            console.log(`Player ${player.name} split, new mass: ${player.mass}`);
        }
    });
    
    socket.on('playerEject', () => {
        const player = gameState.players.get(socket.id);
        if (player && player.alive && player.mass >= 30) {
            // Eject mass as food
            const massToEject = Math.trunc(Math.min(8, player.mass * 0.1));
            player.mass = Math.trunc(player.mass - massToEject);
            
            // Create ejected food
            const ejectedFood = {
                id: uuidv4(),
                x: player.x + Math.random() * 40 - 20,
                y: player.y + Math.random() * 40 - 20,
                radius: Math.max(4, Math.sqrt(massToEject)),
                color: player.color,
                mass: massToEject
            };
            
            gameState.food.push(ejectedFood);
            console.log(`Player ${player.name} ejected mass: ${massToEject}`);
        }
    });
    
    socket.on('playerMassCheat', () => {
        const player = gameState.players.get(socket.id);
        if (player && player.alive) {
            // Add 50 mass (same as single-player)
            const massGain = 50;
            player.mass = Math.trunc(player.mass + massGain);
            player.score = Math.trunc(player.score + massGain); // Also add to score
            
            console.log(`Player ${player.name} used mass cheat: +${massGain} mass (Total: ${player.mass})`);
        }
    });
    
    socket.on('ping', () => {
        socket.emit('pong');
    });
    
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        removePlayer(socket.id);
    });
});

// Helper function to create clean state objects without circular references
function createCleanStateObject(entity) {
    if (!entity) return null;
    
    return {
        id: entity.id,
        name: entity.name,
        x: Math.round(entity.x * 100) / 100, // Round to 2 decimal places
        y: Math.round(entity.y * 100) / 100,
        mass: Math.trunc(entity.mass), // Truncate to whole number
        radius: Math.round(entity.radius * 100) / 100,
        color: entity.color,
        alive: entity.alive,
        score: Math.round(entity.score || 0),
        type: entity.type || 'player'
    };
}

// Game loop with improved logging and performance tracking
let gameLoopCounter = 0;
let lastLogTime = 0;
let lastStateEmitTime = 0;

function gameLoop() {
    const loopStartTime = Date.now();
    gameLoopCounter++;
    
    updateGameState();
    
    // Send game state to all connected clients
    const alivePlayers = Array.from(gameState.players.values()).filter(p => p.alive);
    const deadPlayers = Array.from(gameState.players.values()).filter(p => !p.alive);
    
    // Create clean state objects to avoid circular references
    const cleanPlayers = Array.from(gameState.players.values()).map(createCleanStateObject);
    const cleanBots = gameState.bots.filter(bot => bot.alive).map(createCleanStateObject);
    const cleanFood = gameState.food.map(food => ({
        id: food.id,
        x: Math.round(food.x * 100) / 100,
        y: Math.round(food.y * 100) / 100,
        radius: food.radius,
        color: food.color,
        mass: food.mass || 1
    }));
    const cleanViruses = gameState.viruses.map(virus => ({
        id: virus.id,
        x: Math.round(virus.x * 100) / 100,
        y: Math.round(virus.y * 100) / 100,
        radius: virus.radius,
        color: virus.color,
        isFullyGrown: virus.isFullyGrown
    }));
    
    const gameStateData = {
        players: cleanPlayers,
        bots: cleanBots,
        food: cleanFood,
        viruses: cleanViruses,
        timestamp: Date.now(),
        serverTick: gameLoopCounter
    };
    
    // Emit state to all clients
    const emitStartTime = Date.now();
    io.emit('gameState', gameStateData);
    const emitDuration = Date.now() - emitStartTime;
    lastStateEmitTime = Date.now();
    
    // Log performance and state every 5 seconds in one line
    const currentTime = Date.now();
    if (currentTime - lastLogTime > 5000) {
        const loopDuration = Date.now() - loopStartTime;
        const connectedClients = io.engine.clientsCount;
        const avgTickRate = Math.round(gameLoopCounter / ((currentTime - serverStartTime) / 1000));
        
        console.log(`SERVER [${gameLoopCounter}]: ${connectedClients} clients, ${alivePlayers.length}/${deadPlayers.length} players, ${cleanBots.length} bots, ${cleanFood.length} food, ${cleanViruses.length} viruses, ${loopDuration}ms loop, ${emitDuration}ms emit, ${avgTickRate}Hz`);
        
        lastLogTime = currentTime;
    }
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/multiplayer', (req, res) => {
    res.sendFile(path.join(__dirname, 'multiplayer.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
let serverStartTime = 0;

server.listen(PORT, '0.0.0.0', () => {
    serverStartTime = Date.now();
    console.log(`Server running on port ${PORT}`);
    console.log(`Singleplayer: http://localhost:${PORT}`);
    console.log(`Multiplayer: http://localhost:${PORT}/multiplayer`);
    console.log(`LAN Access: http://[YOUR_IP]:${PORT}/multiplayer`);
    console.log(`Server tick rate: ${config.tickRate} Hz`);
    console.log(`Max players: ${config.maxPlayers}`);
    
    // Initialize game world
    initializeGameWorld();
    
    // Start game loop
    setInterval(gameLoop, 1000 / config.tickRate);
    console.log(`Game loop started at ${new Date().toISOString()}`);
});
