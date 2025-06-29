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
    food: [],
    viruses: [],
    worldWidth: 2000,
    worldHeight: 2000,
    maxFood: 200,
    virusCount: 8
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
    
    console.log(`Game world initialized: ${gameState.food.length} food, ${gameState.viruses.length} viruses`);
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
    
    // Check collisions
    checkCollisions();
    
    // Spawn food if needed
    if (Math.random() < config.foodSpawnRate / config.tickRate && gameState.food.length < gameState.maxFood) {
        spawnFood();
    }
    
    // Apply passive mass loss (0.2% per second)
    gameState.players.forEach(player => {
        if (player.alive) {
            const massLossRate = 0.998;
            const massLossMultiplier = Math.pow(massLossRate, 1 / config.tickRate);
            player.mass = Math.max(20, player.mass * massLossMultiplier);
        }
    });
}

function checkCollisions() {
    const alivePlayers = Array.from(gameState.players.values()).filter(p => p.alive);
    
    // Player vs Food collisions
    alivePlayers.forEach(player => {
        for (let i = gameState.food.length - 1; i >= 0; i--) {
            const food = gameState.food[i];
            const dx = player.x - food.x;
            const dy = player.y - food.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < player.radius + food.radius) {
                // Eat food
                player.mass += food.mass;
                player.score += food.mass;
                gameState.food.splice(i, 1);
            }
        }
    });
    
    // Player vs Player collisions
    for (let i = 0; i < alivePlayers.length; i++) {
        for (let j = i + 1; j < alivePlayers.length; j++) {
            const player1 = alivePlayers[i];
            const player2 = alivePlayers[j];
            
            const dx = player1.x - player2.x;
            const dy = player1.y - player2.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < Math.max(player1.radius, player2.radius)) {
                let predator, prey;
                const requiredRatio = 1.10;
                
                if (player1.mass > player2.mass * requiredRatio) {
                    predator = player1;
                    prey = player2;
                } else if (player2.mass > player1.mass * requiredRatio) {
                    predator = player2;
                    prey = player1;
                } else {
                    continue;
                }
                
                // Transfer mass
                predator.mass += prey.mass;
                predator.score += 50;
                
                // Kill prey
                prey.alive = false;
                prey.mass = 0;
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
            player.mass = player.mass / 2;
            console.log(`Player ${player.name} split, new mass: ${player.mass}`);
        }
    });
    
    socket.on('playerEject', () => {
        const player = gameState.players.get(socket.id);
        if (player && player.alive && player.mass >= 30) {
            // Eject mass as food
            const massToEject = Math.min(8, player.mass * 0.1);
            player.mass -= massToEject;
            
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
    
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        removePlayer(socket.id);
    });
});

// Game loop
function gameLoop() {
    updateGameState();
    
    // Send game state to all connected clients
    const gameStateData = {
        players: Array.from(gameState.players.values()),
        food: gameState.food,
        viruses: gameState.viruses,
        timestamp: Date.now()
    };
    
    io.emit('gameState', gameStateData);
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
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Singleplayer: http://localhost:${PORT}`);
    console.log(`Multiplayer: http://localhost:${PORT}/multiplayer`);
    
    // Initialize game world
    initializeGameWorld();
    
    // Start game loop
    setInterval(gameLoop, 1000 / config.tickRate);
});
