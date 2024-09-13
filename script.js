<script>
        /* JavaScript code */
        // Game variables and elements
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const hud = document.getElementById('hud');
        const playerHealthSpan = document.getElementById('playerHealth');
        const currentRoundSpan = document.getElementById('currentRound');
        const multiplierSpan = document.getElementById('multiplier');
        const playerAmmoSpan = document.getElementById('playerAmmo');
        const currentWeaponSpan = document.getElementById('currentWeapon');
        const startScreen = document.getElementById('mainMenu');
        const startButton = document.getElementById('startButton');
        const viewHighScoresButton = document.getElementById('viewHighScores');
        const settingsButton = document.getElementById('settingsButton');
        const highScoresContainer = document.getElementById('highScoresContainer');
        const backFromHighScoresButton = document.getElementById('backFromHighScores');
        const settingsContainer = document.getElementById('settingsContainer');
        const backFromSettingsButton = document.getElementById('backFromSettings');
        const mouseSensitivityInput = document.getElementById('mouseSensitivity');
        const mouseSensitivityValue = document.getElementById('mouseSensitivityValue');
        const roundInfo = document.getElementById('roundInfo');
        const roundMessage = document.getElementById('roundMessage');
        const countdownElement = document.getElementById('countdown');
        const restartButton = document.getElementById('restartButton');
        const pauseMenu = document.getElementById('pauseMenu');
        const resumeButton = document.getElementById('resumeButton');
        const quitButton = document.getElementById('quitButton');
        const miniMap = document.getElementById('miniMap');
        const miniMapCtx = miniMap.getContext('2d');
        const crosshair = document.querySelector('.crosshair');

        // Audio elements
        const backgroundMusic = document.getElementById('backgroundMusic');
        const shootSound = document.getElementById('shootSound');
        const hitSound = document.getElementById('hitSound');
        const killSound = document.getElementById('killSound');
        const reloadSound = document.getElementById('reloadSound');
        const noAmmoSound = document.getElementById('noAmmoSound');
        const collectSound = document.getElementById('collectSound');

        // Audio Context for programmatic sounds (if needed)
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Player rotation speed (configurable)
        let playerRotationSpeed = parseFloat(mouseSensitivityInput.value); // Default value from settings

        // Weapon data
        const weapons = {
            pistol: {
                name: 'Pistol',
                damage: 25,
                fireRate: 500, // in ms
                ammo: Infinity,
                maxAmmo: Infinity
            },
            shotgun: {
                name: 'Shotgun',
                damage: 50,
                fireRate: 1000,
                ammo: 20,
                maxAmmo: 20
            },
            rifle: {
                name: 'Rifle',
                damage: 35,
                fireRate: 300,
                ammo: 30,
                maxAmmo: 30
            }
        };

        let currentWeapon = 'pistol';

        // Classes
        class Player {
            constructor() {
                this.x = 3;
                this.y = 3;
                this.dir = 0;
                this.health = 100;
                this.speed = 0.1;
                this.damageMultiplier = 1.0;
                this.currentWeapon = 'pistol';
            }

            move(moveX, moveY) {
                // Collision detection with walls
                if (getMap(Math.floor(this.x + moveX), Math.floor(this.y)) === '.') {
                    this.x += moveX;
                }
                if (getMap(Math.floor(this.x), Math.floor(this.y + moveY)) === '.') {
                    this.y += moveY;
                }
            }

            takeDamage(amount) {
                this.health -= amount;
                this.health = Math.max(0, this.health);
                playerHealthSpan.textContent = Math.floor(this.health);
                if (this.health > 0) {
                    playDamageSound();
                }
                if (this.health <= 0) {
                    gameOver = true;
                }
            }

            heal(amount) {
                this.health += amount;
                this.health = Math.min(this.health, 100);
                playerHealthSpan.textContent = Math.floor(this.health);
            }

            reset() {
                this.x = 3;
                this.y = 3;
                this.dir = 0;
                this.health = 100;
                this.damageMultiplier = 1.0;
                this.currentWeapon = 'pistol';
            }
        }

        class Enemy {
            constructor(x, y, health) {
                this.x = x + 0.5;
                this.y = y + 0.5;
                this.health = health;
                this.lastAttackTime = 0;
                this.distance = 0;
            }

            moveTowards(player, deltaTime) {
                let dx = player.x - this.x;
                let dy = player.y - this.y;
                let dist = Math.hypot(dx, dy);

                if (dist > 0.5) {
                    let moveSpeed = 0.02 * deltaTime * 60; // Adjusted for frame rate
                    let moveX = (dx / dist) * moveSpeed;
                    let moveY = (dy / dist) * moveSpeed;
                    let newX = this.x + moveX;
                    let newY = this.y + moveY;

                    // Collision detection with walls
                    if (getMap(Math.floor(newX), Math.floor(this.y)) === '.' && isPositionFree(newX, this.y, this)) {
                        this.x = newX;
                    }
                    if (getMap(Math.floor(this.x), Math.floor(newY)) === '.' && isPositionFree(this.x, newY, this)) {
                        this.y = newY;
                    }
                }
            }

            attack(player, currentTime) {
                if (currentTime - this.lastAttackTime > 500) { // Attack cooldown of 0.5 seconds
                    this.lastAttackTime = currentTime;
                    player.takeDamage(25); // Fixed damage per hit
                }
            }
        }

        class HealthPack {
            constructor(x, y, healingAmount) {
                this.x = x + 0.5;
                this.y = y + 0.5;
                this.healingAmount = healingAmount;
                this.collected = false;
            }

            // Optional: Remove or fix rendering to prevent the green ball issue
            // Currently removed to avoid visual clutter
            /*
            draw(ctx, player) {
                // Simple representation as a green circle in first-person view
                let dx = this.x - player.x;
                let dy = this.y - player.y;
                let dist = Math.hypot(dx, dy);
                let fovDistance = 16;
                if (dist < fovDistance) {
                    let size = (canvas.height / dist) * 0.5;
                    let screenX = Math.tan((Math.atan2(dy, dx) - player.dir) * (canvas.width / (Math.PI / 3))) + canvas.width / 2;
                    ctx.fillStyle = 'green';
                    ctx.beginPath();
                    ctx.arc(screenX, canvas.height / 2, size / 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            */

            checkCollection(player) {
                let dx = this.x - player.x;
                let dy = this.y - player.y;
                let dist = Math.hypot(dx, dy);
                if (dist < 0.5) {
                    player.heal(this.healingAmount);
                    this.collected = true;
                    playCollectSound();
                }
            }
        }

        // Initialize player
        const player = new Player();

        // Keys pressed
        const keys = {};

        // Enemies array
        let enemies = [];

        // Health packs array
        let healthPacks = [];

        // Game state variables
        let gameOver = false;
        let currentRound = 1;
        const baseEnemies = 5;
        const enemiesIncrementPerRound = 2;
        const maxEnemies = 20;
        const baseEnemyHealth = 50;
        const enemyHealthIncrement = 10;
        let playerDamageMultiplier = 1.0;
        const fov = Math.PI / 3; // 60 degrees field of view

        let totalRounds = 0;
        let totalKills = 0;
        let shotsFired = 0;
        let shotsHit = 0;
        let inCountdown = false;
        let score = 0;

        // Automatic firing variables
        let isFiring = false;
        let initialFireRate = 500; // Starting at 500ms between shots
        let minFireRate = 100; // Minimum interval between shots
        let fireRate = initialFireRate;
        let fireRateDecrease = 50; // Decrease interval by 50ms per shot
        let fireTimeout;

        let lastFrameTime = null; // For delta time calculation

        // Mini-map variables
        const miniMapScale = 10; // Each map unit equals 10 pixels on the mini-map

        // Set canvas dimensions to full window size
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas(); // Initial call

        // Map data (simple 2D grid)
        const mapWidth = 16;
        const mapHeight = 16;
        let map = [
            '################',
            '#....H.........#',
            '#..............#',
            '#.......#......#',
            '#.......#......#',
            '#.......#......#',
            '#..............#',
            '#....H.........#',
            '#.......#......#',
            '#.......#......#',
            '#.......#......#',
            '#........H.....#',
            '#..............#',
            '#..............#',
            '#..............#',
            '################'
        ];

        // Function to get the map character at position (x, y)
        function getMap(x, y) {
            if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) {
                return '#';
            }
            if (map[y][x] === 'H') {
                return '.'; // Treat 'H' as empty space for collision
            }
            return map[y][x];
        }

        // High Score Functions
        function saveHighScore(name, score) {
            let highScores = JSON.parse(localStorage.getItem('highScores')) || [];
            highScores.push({ name, score });
            highScores.sort((a, b) => b.score - a.score);
            highScores = highScores.slice(0, 10); // Keep top 10
            localStorage.setItem('highScores', JSON.stringify(highScores));
        }

        function getHighScores() {
            return JSON.parse(localStorage.getItem('highScores')) || [];
        }

        function displayHighScores() {
            let highScores = getHighScores();
            const highScoresList = document.getElementById('highScoresList');
            highScoresList.innerHTML = ''; // Clear existing scores

            if (highScores.length === 0) {
                highScoresList.innerHTML = '<li>No high scores yet.</li>';
                return;
            }

            highScores.forEach(scoreEntry => {
                let li = document.createElement('li');
                li.textContent = `${scoreEntry.name}: ${scoreEntry.score}`;
                highScoresList.appendChild(li);
            });
        }

        // Event listeners for main menu buttons
        startButton.addEventListener('click', startGame);
        viewHighScoresButton.addEventListener('click', function() {
            displayHighScores();
            highScoresContainer.style.display = 'block';
        });
        backFromHighScoresButton.addEventListener('click', function() {
            highScoresContainer.style.display = 'none';
        });
        settingsButton.addEventListener('click', function() {
            settingsContainer.style.display = 'block';
        });
        backFromSettingsButton.addEventListener('click', function() {
            settingsContainer.style.display = 'none';
        });

        // Update mouse sensitivity display and functionality
        mouseSensitivityInput.addEventListener('input', function() {
            mouseSensitivityValue.textContent = mouseSensitivityInput.value;
            playerRotationSpeed = parseFloat(mouseSensitivityInput.value);
        });

        // Keydown and Keyup events
        document.addEventListener('keydown', function (e) {
            keys[e.key.toLowerCase()] = true;

            // Weapon switching
            if (e.key === '1') {
                currentWeapon = 'pistol';
                updateHUD();
            } else if (e.key === '2') {
                currentWeapon = 'shotgun';
                updateHUD();
            } else if (e.key === '3') {
                currentWeapon = 'rifle';
                updateHUD();
            }

            // Reloading
            if (e.key.toLowerCase() === 'r') {
                reloadWeapon();
            }

            // Pause Game with Esc key
            if (e.key === 'Escape') {
                togglePause();
            }
        });
        document.addEventListener('keyup', function (e) {
            keys[e.key.toLowerCase()] = false;
        });

        // Mouse movement for player direction
        document.addEventListener('mousemove', function (e) {
            if (document.pointerLockElement === canvas) {
                player.dir += e.movementX * playerRotationSpeed;
                // Keep angle between 0 and 2pi
                if (player.dir < 0) player.dir += 2 * Math.PI;
                if (player.dir > 2 * Math.PI) player.dir -= 2 * Math.PI;
            }
        });

        // Mouse down and up events for automatic firing
        document.addEventListener('mousedown', function (e) {
            if (document.pointerLockElement === canvas && e.button === 0) {
                isFiring = true;
                fireRate = weapons[currentWeapon].fireRate; // Reset fire rate based on weapon
                fireShot(); // Start firing immediately
            }
        });

        document.addEventListener('mouseup', function (e) {
            if (e.button === 0) {
                isFiring = false;
                clearTimeout(fireTimeout);
                fireRate = weapons[currentWeapon].fireRate; // Reset fire rate based on weapon
            }
        });

        // Fire shot function for automatic firing
        function fireShot() {
            if (!isFiring || gameOver) return;

            shoot(); // Fire the shot

            // Schedule next shot
            fireTimeout = setTimeout(fireShot, fireRate);
        }

        // Start game function
        function startGame() {
            startScreen.style.display = 'none';
            canvas.style.display = 'block';
            backgroundMusic.play();
            initGame();
            requestAnimationFrame(gameLoop);
        }

        // Initialize game variables
        function initGame() {
            player.reset();
            player.currentWeapon = 'pistol';
            currentWeapon = 'pistol';
            weapons.pistol.ammo = Infinity;
            weapons.shotgun.ammo = weapons.shotgun.maxAmmo;
            weapons.rifle.ammo = weapons.rifle.maxAmmo;
            player.damageMultiplier = 1.0;
            currentRound = 1;
            enemies = [];
            healthPacks = [];
            gameOver = false;
            totalRounds = 0;
            totalKills = 0;
            shotsFired = 0;
            shotsHit = 0;
            inCountdown = false;
            isFiring = false;
            fireRate = weapons[currentWeapon].fireRate;
            lastFrameTime = null;
            score = 0;
            updateHUD();
            // Parse health packs from the map
            parseHealthPacks();
            showRoundInfo(`Round ${currentRound}`, false);
        }

        // Parse health packs from the map
        function parseHealthPacks() {
            healthPacks = [];
            for (let y = 0; y < mapHeight; y++) {
                for (let x = 0; x < mapWidth; x++) {
                    if (map[y][x] === 'H') {
                        healthPacks.push(new HealthPack(x, y, 25)); // Heal 25 health
                    }
                }
            }
        }

        // Initialize enemies for the current round
        function initEnemies() {
            enemies = []; // Clear existing enemies
            let enemiesToSpawn = getEnemiesPerRound(currentRound);
            for (let i = 0; i < enemiesToSpawn; i++) {
                let spawn = getRandomSpawnPosition();
                if (spawn) {
                    enemies.push(new Enemy(spawn.x, spawn.y, getEnemyHealth(currentRound)));
                }
            }
            updateHUD();
        }

        // Calculate number of enemies per round
        function getEnemiesPerRound(round) {
            let enemiesCount = baseEnemies + (round - 1) * enemiesIncrementPerRound;
            if (round % 10 === 0) {
                enemiesCount += enemiesIncrementPerRound; // Accelerate every 10 rounds
            }
            return Math.min(enemiesCount, maxEnemies);
        }

        // Calculate enemy health based on round
        function getEnemyHealth(round) {
            return baseEnemyHealth + (round - 1) * enemyHealthIncrement;
        }

        // Get random spawn position, avoiding spawning too close to the player
        function getRandomSpawnPosition() {
            const minDistanceFromPlayer = 5; // Units
            let maxAttempts = 100;
            for (let i = 0; i < maxAttempts; i++) {
                let x = Math.random() * (mapWidth - 2) + 1; // Avoid walls at edges
                let y = Math.random() * (mapHeight - 2) + 1;
                if (getMap(Math.floor(x), Math.floor(y)) === '.') {
                    let distance = Math.hypot(x - player.x, y - player.y);
                    if (distance > minDistanceFromPlayer) {
                        // Ensure no enemy is already at this position
                        let isOccupied = enemies.some(enemy =>
                            Math.floor(enemy.x) === Math.floor(x) && Math.floor(enemy.y) === Math.floor(y)
                        );
                        if (!isOccupied) {
                            return { x: Math.floor(x), y: Math.floor(y) };
                        }
                    }
                }
            }
            return null; // No spawn found after max attempts
        }

        // Show round information with countdown
        function showRoundInfo(message, isGameOver) {
            roundMessage.innerHTML = `<h2>${message}</h2>`;
            roundInfo.style.display = 'flex';
            if (isGameOver) {
                restartButton.style.display = 'block';
                roundInfo.style.pointerEvents = 'auto'; // Allow clicking buttons
                countdownElement.style.display = 'none';
                inCountdown = false;
            } else {
                restartButton.style.display = 'none';
                roundInfo.style.pointerEvents = 'none'; // Ignore pointer events
                countdownElement.style.display = 'block';
                inCountdown = true; // Start countdown phase
            }
            // Start the countdown if not game over
            if (!isGameOver) {
                let countdown = 3; // 3-second countdown
                countdownElement.textContent = `Next round starts in ${countdown}`;
                let countdownInterval = setInterval(() => {
                    countdown--;
                    if (countdown > 0) {
                        countdownElement.textContent = `Next round starts in ${countdown}`;
                    } else {
                        clearInterval(countdownInterval);
                        roundInfo.style.display = 'none';
                        inCountdown = false; // End countdown phase
                        initEnemies();
                    }
                }, 1000);
            }
        }

        // Restart game function
        restartButton.addEventListener('click', function () {
            roundInfo.style.display = 'none';
            startGame();
        });

        // Pause Menu Functionality
        function togglePause() {
            if (pauseMenu.style.display === 'flex') {
                // Resume game
                pauseMenu.style.display = 'none';
                document.addEventListener('mousemove', mouseMoveHandler);
                if (!gameOver && !inCountdown) {
                    requestAnimationFrame(gameLoop);
                }
            } else {
                // Pause game
                pauseMenu.style.display = 'flex';
                document.removeEventListener('mousemove', mouseMoveHandler);
            }
        }

        resumeButton.addEventListener('click', function() {
            togglePause();
        });

        quitButton.addEventListener('click', function() {
            // Stop the game loop and return to main menu
            gameOver = true;
            pauseMenu.style.display = 'none';
            roundInfo.style.display = 'none';
            canvas.style.display = 'none';
            startScreen.style.display = 'flex';
            backgroundMusic.pause();
        });

        // Pointer lock function
        function pointerLock() {
            canvas.requestPointerLock = canvas.requestPointerLock ||
                canvas.mozRequestPointerLock ||
                canvas.webkitRequestPointerLock;
            canvas.requestPointerLock();
        }
        // Request pointer lock when the canvas is clicked
        canvas.addEventListener('click', function () {
            if (document.pointerLockElement !== canvas) {
                pointerLock();
            }
        });

        // Game loop
        function gameLoop(timestamp) {
            if (gameOver) {
                endGame();
                return;
            }

            if (!lastFrameTime) lastFrameTime = timestamp;
            let deltaTime = (timestamp - lastFrameTime) / 1000; // Convert to seconds
            lastFrameTime = timestamp;

            update(deltaTime);
            render();

            // Continue the game loop only if the game is not paused
            if (pauseMenu.style.display !== 'flex') {
                requestAnimationFrame(gameLoop);
            }
        }

        // Update game state
        function update(deltaTime) {
            // Only update the game if not in countdown
            if (gameOver || inCountdown) {
                return;
            }

            // Player movement
            let moveX = 0;
            let moveY = 0;
            if (keys['w']) {
                moveX += Math.cos(player.dir) * player.speed;
                moveY += Math.sin(player.dir) * player.speed;
            }
            if (keys['s']) {
                moveX -= Math.cos(player.dir) * player.speed;
                moveY -= Math.sin(player.dir) * player.speed;
            }
            if (keys['a']) {
                // Strafe left
                moveX += Math.cos(player.dir - Math.PI / 2) * player.speed;
                moveY += Math.sin(player.dir - Math.PI / 2) * player.speed;
            }
            if (keys['d']) {
                // Strafe right
                moveX += Math.cos(player.dir + Math.PI / 2) * player.speed;
                moveY += Math.sin(player.dir + Math.PI / 2) * player.speed;
            }

            player.move(moveX, moveY);

            // Update enemies
            let currentTime = performance.now();

            enemies.forEach((enemy) => {
                enemy.moveTowards(player, deltaTime);
                let dx = player.x - enemy.x;
                let dy = player.y - enemy.y;
                let dist = Math.hypot(dx, dy);
                if (dist <= 0.5) {
                    enemy.attack(player, currentTime);
                }
            });

            // Remove dead enemies
            enemies = enemies.filter(enemy => enemy.health > 0);

            // Check if round is complete
            if (enemies.length === 0) {
                totalRounds++;
                currentRound++;
                updateHUD();
                showRoundInfo(`Round ${currentRound}`, false);
            }

            // Check for health pack collection
            healthPacks.forEach(healthPack => {
                if (!healthPack.collected) {
                    healthPack.checkCollection(player);
                }
            });

            // Remove collected health packs
            healthPacks = healthPacks.filter(pack => !pack.collected);
        }

        // Check if position is free from other enemies
        function isPositionFree(x, y, currentEnemy) {
            for (let enemy of enemies) {
                if (enemy !== currentEnemy) {
                    let dx = enemy.x - x;
                    let dy = enemy.y - y;
                    if (Math.hypot(dx, dy) < 0.4) { // Enemy radius
                        return false;
                    }
                }
            }
            return true;
        }

        // Render game
        function render() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const zBuffer = [];

            // Simple raycasting engine
            for (let x = 0; x < canvas.width; x++) {
                let rayAngle = (player.dir - fov / 2) + (x / canvas.width) * fov;
                let distanceToWall = 0;
                let hitWall = false;
                let eyeX = Math.cos(rayAngle);
                let eyeY = Math.sin(rayAngle);

                while (!hitWall && distanceToWall < 16) {
                    distanceToWall += 0.05;
                    let testX = Math.floor(player.x + eyeX * distanceToWall);
                    let testY = Math.floor(player.y + eyeY * distanceToWall);

                    if (testX < 0 || testX >= mapWidth || testY < 0 || testY >= mapHeight) {
                        hitWall = true;
                        distanceToWall = 16;
                    } else {
                        if (getMap(testX, testY) === '#') {
                            hitWall = true;
                        }
                    }
                }

                // Calculate distance to ceiling and floor
                let lineHeight = canvas.height / distanceToWall;

                let drawStart = -lineHeight / 2 + canvas.height / 2;
                if (drawStart < 0) drawStart = 0;
                let drawEnd = lineHeight / 2 + canvas.height / 2;
                if (drawEnd >= canvas.height) drawEnd = canvas.height - 1;

                // Shade walls based on distance
                let shade = 1 - distanceToWall / 16;
                if (shade < 0) shade = 0;
                ctx.fillStyle = `rgba(150, 150, 150, ${shade})`;
                ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);

                // Draw floor
                ctx.fillStyle = 'black';
                ctx.fillRect(x, drawEnd, 1, canvas.height - drawEnd);

                // Add distance to zBuffer
                zBuffer[x] = distanceToWall;
            }

            // Calculate distances for enemies and sort them
            enemies.forEach((enemy) => {
                let dx = enemy.x - player.x;
                let dy = enemy.y - player.y;
                enemy.distance = Math.hypot(dx, dy);
            });

            enemies.sort((a, b) => b.distance - a.distance);

            // Draw enemies
            enemies.forEach((enemy) => {
                let dx = enemy.x - player.x;
                let dy = enemy.y - player.y;
                let distance = enemy.distance;

                // Calculate angle between player direction and enemy
                let angle = Math.atan2(dy, dx) - player.dir;
                if (angle < -Math.PI) angle += 2 * Math.PI;
                if (angle > Math.PI) angle -= 2 * Math.PI;

                // Only render enemies within field of view
                if (Math.abs(angle) < fov / 2) {
                    let enemySize = (canvas.height / distance) * 0.7;
                    let enemyX = Math.tan(angle) * (canvas.width / 2) / Math.tan(fov / 2) + canvas.width / 2 - enemySize / 2;
                    let enemyY = canvas.height / 2 - enemySize / 2;

                    // Depth buffering: Only draw enemy if it's closer than wall
                    let screenX = Math.floor(enemyX + enemySize / 2);
                    if (screenX >= 0 && screenX < canvas.width) {
                        if (distance < zBuffer[screenX] || isNaN(zBuffer[screenX])) {
                            // Draw enemy with outline
                            ctx.fillStyle = 'red';
                            ctx.strokeStyle = 'black';
                            ctx.lineWidth = 2;
                            ctx.fillRect(enemyX, enemyY, enemySize, enemySize);
                            ctx.strokeRect(enemyX, enemyY, enemySize, enemySize);

                            // Draw enemy health bar at top of enemy
                            ctx.fillStyle = 'black';
                            ctx.fillRect(enemyX + enemySize / 4, enemyY - 10, enemySize / 2, 5);
                            ctx.fillStyle = 'green';
                            ctx.fillRect(enemyX + enemySize / 4, enemyY - 10, (enemy.health / getEnemyHealth(currentRound)) * (enemySize / 2), 5);
                        }
                    }
                }
            });

            // Draw crosshair is handled by CSS; no need to draw in canvas

            // Draw Mini-Map
            drawMiniMap();
        }

        // Update HUD
        function updateHUD() {
            playerHealthSpan.textContent = Math.floor(player.health);
            currentRoundSpan.textContent = currentRound;
            multiplierSpan.textContent = player.damageMultiplier.toFixed(1);
            playerAmmoSpan.textContent = weapons[currentWeapon].ammo === Infinity ? '∞' : weapons[currentWeapon].ammo;
            currentWeaponSpan.textContent = weapons[currentWeapon].name;
        }

        // Shoot function
        function shoot() {
            shotsFired++; // Increment shots fired

            // Check ammo
            if (weapons[currentWeapon].ammo <= 0) {
                // No ammo, cannot shoot
                playNoAmmoSound();
                return;
            }

            // Decrement ammo if not infinite
            if (weapons[currentWeapon].ammo !== Infinity) {
                weapons[currentWeapon].ammo--;
                updateHUD();
            }

            // Play shooting sound
            shootSound.currentTime = 0;
            shootSound.play();

            let hit = false;
            let rayAngle = player.dir;
            let eyeX = Math.cos(rayAngle);
            let eyeY = Math.sin(rayAngle);
            let maxDistance = 16; // Maximum shooting distance

            // Determine damage based on weapon
            let damage = weapons[currentWeapon].damage * player.damageMultiplier;

            // Loop until we hit a wall or reach max distance
            for (let distanceToWall = 0; distanceToWall < maxDistance; distanceToWall += 0.05) {
                let testX = player.x + eyeX * distanceToWall;
                let testY = player.y + eyeY * distanceToWall;

                if (getMap(Math.floor(testX), Math.floor(testY)) === '#') {
                    // Hit a wall, stop the ray
                    break;
                }

                // Check for enemies along the ray
                for (let enemy of enemies) {
                    let dx = enemy.x - testX;
                    let dy = enemy.y - testY;
                    let dist = Math.hypot(dx, dy);
                    if (dist < 0.3) { // Hit threshold
                        // Enemy hit
                        enemy.health -= damage;
                        hit = true;
                        if (enemy.health <= 0) {
                            // Enemy killed
                            enemies.splice(enemies.indexOf(enemy), 1);
                            playKillSound(); // Play kill sound
                            // Increase multiplier by 0.1 per kill
                            player.damageMultiplier += 0.1;
                            totalKills++; // Increment kill count
                            // Increase score
                            score += Math.floor(100 * player.damageMultiplier);
                            updateHUD();
                        } else {
                            playHitSound(); // Play hit sound for damage
                        }
                        shotsHit++; // Increment shots hit

                        // Increase rate of fire based on weapon
                        fireRate = Math.max(minFireRate, fireRate - fireRateDecrease);

                        break; // Stop checking other enemies
                    }
                }

                if (hit) {
                    break; // Stop the ray if we've hit an enemy
                }
            }

            if (!hit) {
                // Missed shot
                player.damageMultiplier = 1.0;
                fireRate = weapons[currentWeapon].fireRate; // Reset fire rate based on weapon
                updateHUD();
                playMissSound();
            }
        }

        // Reload weapon function
        function reloadWeapon() {
            if (weapons[currentWeapon].ammo === Infinity) return; // Cannot reload weapons with infinite ammo
            // Simple reload: reset ammo to max
            weapons[currentWeapon].ammo = weapons[currentWeapon].maxAmmo;
            updateHUD();
            // Play reload sound
            reloadSound.currentTime = 0;
            reloadSound.play();
        }

        // Game end function
        function endGame() {
            backgroundMusic.pause();
            let accuracy = shotsFired > 0 ? ((shotsHit / shotsFired) * 100).toFixed(1) : 0;
            let scoreDisplay = `
                <h2>Game Over</h2>
                <p>Score: ${score}</p>
                <p>Rounds Survived: ${totalRounds}</p>
                <p>Enemies Killed: ${totalKills}</p>
                <p>Shots Fired: ${shotsFired}</p>
                <p>Accuracy: ${accuracy}%</p>
            `;

            // Check if score qualifies for high scores
            let highScores = getHighScores();
            let qualifies = highScores.length < 10 || score > highScores[highScores.length - 1].score;

            if (qualifies) {
                scoreDisplay += `<p>New High Score!</p>
                                <input type="text" id="playerName" placeholder="Enter your name" maxlength="10">
                                <button id="saveScoreButton">Save Score</button>`;
            }

            roundMessage.innerHTML = scoreDisplay;
            countdownElement.style.display = 'none';
            roundInfo.style.display = 'flex';
            roundInfo.style.pointerEvents = 'auto';
            restartButton.style.display = 'block';
            inCountdown = false;

            if (qualifies) {
                document.getElementById('saveScoreButton').addEventListener('click', function() {
                    let playerName = document.getElementById('playerName').value.trim() || 'Anonymous';
                    saveHighScore(playerName, score);
                    displayHighScores();
                    // Optionally, hide the input after saving
                    document.getElementById('playerName').style.display = 'none';
                    document.getElementById('saveScoreButton').style.display = 'none';
                });
            }
        }

        // Sound effect functions
        function playHitSound() {
            hitSound.currentTime = 0;
            hitSound.play();
        }

        function playMissSound() {
            // Optional: Implement a miss sound if desired
            // Currently, resetting multiplier and fire rate without a sound
        }

        function playKillSound() {
            killSound.currentTime = 0;
            killSound.play();
        }

        function playDamageSound() {
            // Optional: Implement damage sound if desired
            // Currently handled in Player class's takeDamage method
        }

        function playNoAmmoSound() {
            noAmmoSound.currentTime = 0;
            noAmmoSound.play();
        }

        function playCollectSound() {
            collectSound.currentTime = 0;
            collectSound.play();
        }

        // High Score Leaderboard handling (already included above)

        // Mini-Map rendering
        function drawMiniMap() {
            miniMapCtx.clearRect(0, 0, miniMap.width, miniMap.height);

            // Draw the map
            for (let y = 0; y < mapHeight; y++) {
                for (let x = 0; x < mapWidth; x++) {
                    if (map[y][x] === '#') {
                        miniMapCtx.fillStyle = 'gray';
                        miniMapCtx.fillRect(x * miniMapScale, y * miniMapScale, miniMapScale, miniMapScale);
                    } else if (map[y][x] === 'H') {
                        miniMapCtx.fillStyle = 'green';
                        miniMapCtx.fillRect(x * miniMapScale, y * miniMapScale, miniMapScale, miniMapScale);
                    } else {
                        miniMapCtx.fillStyle = 'black';
                        miniMapCtx.fillRect(x * miniMapScale, y * miniMapScale, miniMapScale, miniMapScale);
                    }
                }
            }

            // Draw enemies on the mini-map
            enemies.forEach(enemy => {
                miniMapCtx.fillStyle = 'red';
                miniMapCtx.fillRect(enemy.x * miniMapScale - 2, enemy.y * miniMapScale - 2, 4, 4);
            });

            // Draw health packs on the mini-map
            healthPacks.forEach(pack => {
                miniMapCtx.fillStyle = 'green';
                miniMapCtx.fillRect(pack.x * miniMapScale - 2, pack.y * miniMapScale - 2, 4, 4);
            });

            // Draw player on the mini-map
            miniMapCtx.fillStyle = 'blue';
            miniMapCtx.beginPath();
            miniMapCtx.arc(player.x * miniMapScale, player.y * miniMapScale, 4, 0, Math.PI * 2);
            miniMapCtx.fill();

            // Draw player direction on the mini-map
            miniMapCtx.strokeStyle = 'blue';
            miniMapCtx.beginPath();
            miniMapCtx.moveTo(player.x * miniMapScale, player.y * miniMapScale);
            miniMapCtx.lineTo(
                (player.x + Math.cos(player.dir)) * miniMapScale,
                (player.y + Math.sin(player.dir)) * miniMapScale
            );
            miniMapCtx.stroke();
        }

        // Function to display high scores on start screen
        function displayHighScoresOnStart() {
            displayHighScores();
        }

        // Initialize high scores on page load
        window.onload = function() {
            displayHighScoresOnStart();
        }

        // Function to handle key presses for weapon switching and reloading is already included above

        // Function to handle shooting and reloading is already included above

        // Function to handle pointer lock is already included above

        // Function to handle health packs is already included above

    </script>
