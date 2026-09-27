// Simple ASCII loader with an 8x8 grid and Game of Life-like updates
(function () {
    const CHARS = [
        ' ', '.', ':', 'r', 's', 'c', 't', 'm', '#', '%', '@'
    ];
    const GRID_SIZE = 5;
    const TICK_MS = 300;
    const ACTIVE_CHAR_INDEXES = [3, 4, 5, 6, 7, 8, 9, 10];
    const INACTIVE_CHAR_INDEX = 0; // space
    let timer = null;
    let grid = [];
    let container = null;

    function createGrid() {
        grid = new Array(GRID_SIZE)
            .fill(null)
            .map(() => new Array(GRID_SIZE).fill(0));
        // seed a few random cells as active
        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                grid[i][j] = Math.random() < 0.3 ? 1 : 0;
            }
        }
    }

    function nextState() {
        // Conway-like rules with random noise
        const dirs = [-1, 0, 1];
        const newGrid = new Array(GRID_SIZE)
            .fill(null)
            .map(() => new Array(GRID_SIZE).fill(0));
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                let neighbors = 0;
                for (let dy of dirs) {
                    for (let dx of dirs) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = (x + dx + GRID_SIZE) % GRID_SIZE;
                        const ny = (y + dy + GRID_SIZE) % GRID_SIZE;
                        neighbors += grid[ny][nx];
                    }
                }
                const alive = grid[y][x] === 1;
                let nextAlive = alive;
                if (alive && (neighbors < 2 || neighbors > 3)) nextAlive = 0;
                else if (!alive && neighbors === 3) nextAlive = 1;
                // small random noise to keep it lively
                if (Math.random() < 0.02) nextAlive = 1 - nextAlive;
                newGrid[y][x] = nextAlive;
            }
        }
        grid = newGrid;
    }

    function pickChar(isActive) {
        if (!isActive) return CHARS[INACTIVE_CHAR_INDEX];
        const idx = ACTIVE_CHAR_INDEXES[Math.floor(Math.random() * ACTIVE_CHAR_INDEXES.length)];
        return CHARS[idx];
    }

    function render() {
        if (!container) return;
        const frag = document.createDocumentFragment();
        container.innerHTML = '';
        for (let y = 0; y < GRID_SIZE; y++) {
            const rowEl = document.createElement('div');
            rowEl.className = 'loader-row';
            for (let x = 0; x < GRID_SIZE; x++) {
                const cell = document.createElement('span');
                cell.className = 'loader-cell';
                cell.textContent = pickChar(grid[y][x] === 1);
                frag.appendChild(cell);
                rowEl.appendChild(cell);
            }
            container.appendChild(rowEl);
        }
    }

    function show() {
        const overlay = document.getElementById('loader-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.setAttribute('aria-hidden', 'false');
        }
    }

    function hide() {
        const overlay = document.getElementById('loader-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            // remove from flow after transition
            setTimeout(() => {
                overlay.style.display = 'none';
                overlay.setAttribute('aria-hidden', 'true');
            }, 250);
        }
    }

    function start() {
        const overlay = document.getElementById('loader-overlay');
        container = overlay ? overlay.querySelector('.loader-grid') : null;
        if (!overlay || !container) return;
        createGrid();
        render();
        show();
        timer = setInterval(() => {
            nextState();
            render();
        }, TICK_MS);
    }

    function stop() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        hide();
    }

    // Start as early as DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }

    // Listen for site-ready events to stop loader
    window.addEventListener('site:ready', stop, { once: true });
})();


