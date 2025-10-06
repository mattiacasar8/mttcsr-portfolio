// Morphogenetic ASCII Field
class MorphoASCII {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.container = canvas.parentElement;
        
        // ASCII character mapping
        this.chars = [
            { char: ' ', threshold: 0.10 },
            { char: '.', threshold: 0.20 },
            { char: ':', threshold: 0.25 },
            { char: 'r', threshold: 0.30 },
            { char: 's', threshold: 0.40 },
            { char: 'c', threshold: 0.50 },
            { char: 't', threshold: 0.60 },
            { char: 'm', threshold: 0.70 },
            { char: '#', threshold: 0.80 },
            { char: '%', threshold: 0.90 },
            { char: '@', threshold: 1.00 }
        ];
        
        // Reaction-diffusion parameters
        this.params = {
            feed: 0.09,
            kill: 0.059,
            dA: 0.84,
            dB: 0.35,
            dt: 1.0
        };
        
        this.cellSize = 10;
        this.fontSize = 10;
        this.contrastPower = 0.60;
        this.updatesPerFrame = 4;
        this.brushRadius = 1;
        
        this.resize();
        this.init();
        this.setupEvents();
        this.animate();
    }
    
    resize() {
        // Calculate grid based on container size
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.cols = Math.floor(width / this.cellSize);
        this.rows = Math.floor(height / this.cellSize);
        
        this.canvas.width = width;
        this.canvas.height = height;
        
        // Center the grid
        this.offsetX = (width - this.cols * this.cellSize) / 2;
        this.offsetY = (height - this.rows * this.cellSize) / 2;
        
        // Initialize grids
        const size = this.cols * this.rows;
        this.gridA = new Float32Array(size);
        this.gridB = new Float32Array(size);
        this.nextA = new Float32Array(size);
        this.nextB = new Float32Array(size);
        
        this.init();
    }
    
    init() {
        // Initialize: A=1, B=0 everywhere (stable state = black)
        for (let i = 0; i < this.gridA.length; i++) {
            this.gridA[i] = 1.0;
            this.gridB[i] = 0.0;
        }
        
        // Single tiny seed at center
        const centerX = Math.floor(this.cols / 2);
        const centerY = Math.floor(this.rows / 2);
        this.addChemical(centerX, centerY, 1);
    }
    
    addSeeds(count) {
        for (let i = 0; i < count; i++) {
            const x = Math.floor(Math.random() * this.cols);
            const y = Math.floor(Math.random() * this.rows);
            const r = 2 + Math.random() * 3;
            this.addChemical(x, y, r);
        }
    }
    
    addChemical(x, y, radius = 3) {
        const r = Math.floor(radius);
        for (let i = -r; i <= r; i++) {
            for (let j = -r; j <= r; j++) {
                if (i*i + j*j <= r*r) {
                    const px = (x + i + this.cols) % this.cols;
                    const py = (y + j + this.rows) % this.rows;
                    const idx = py * this.cols + px;
                    if (idx >= 0 && idx < this.gridB.length) {
                        this.gridB[idx] = 1.0;
                    }
                }
            }
        }
    }
    
    laplace(x, y, grid) {
        const xp = (x + 1) % this.cols;
        const xm = (x - 1 + this.cols) % this.cols;
        const yp = (y + 1) % this.rows;
        const ym = (y - 1 + this.rows) % this.rows;
        
        let sum = 0;
        sum += grid[y * this.cols + x] * -1;
        sum += grid[y * this.cols + xp] * 0.2;
        sum += grid[y * this.cols + xm] * 0.2;
        sum += grid[yp * this.cols + x] * 0.2;
        sum += grid[ym * this.cols + x] * 0.2;
        sum += grid[yp * this.cols + xp] * 0.05;
        sum += grid[yp * this.cols + xm] * 0.05;
        sum += grid[ym * this.cols + xp] * 0.05;
        sum += grid[ym * this.cols + xm] * 0.05;
        return sum;
    }
    
    update() {
        for (let x = 0; x < this.cols; x++) {
            for (let y = 0; y < this.rows; y++) {
                const idx = y * this.cols + x;
                const a = this.gridA[idx];
                const b = this.gridB[idx];
                const reaction = a * b * b;
                
                this.nextA[idx] = a + 
                    (this.params.dA * this.laplace(x, y, this.gridA) - reaction + 
                     this.params.feed * (1 - a)) * this.params.dt;
                this.nextB[idx] = b + 
                    (this.params.dB * this.laplace(x, y, this.gridB) + reaction - 
                     (this.params.kill + this.params.feed) * b) * this.params.dt;
                
                this.nextA[idx] = Math.max(0, Math.min(1, this.nextA[idx]));
                this.nextB[idx] = Math.max(0, Math.min(1, this.nextB[idx]));
            }
        }
        
        // Swap grids
        [this.gridA, this.nextA] = [this.nextA, this.gridA];
        [this.gridB, this.nextB] = [this.nextB, this.gridB];
    }
    
    valueToChar(value) {
        // Map normalized value [0-1] to character
        for (let i = this.chars.length - 1; i >= 0; i--) {
            if (value >= this.chars[i].threshold) {
                return this.chars[i].char;
            }
        }
        return ' ';
    }
    
    draw() {
        // Clear with pure black
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Setup text rendering
        this.ctx.font = `${this.fontSize}px "Inter", monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = '#ffffff';
        
        // Render ASCII
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const idx = y * this.cols + x;
                const value = this.gridA[idx] - this.gridB[idx];
                // Normalize from [-1, 1] to [0, 1], then invert
                let normalized = 1 - ((value + 1) / 2);
                
                // Contrast enhancement - expand the range
                // Apply power curve to increase contrast
                normalized = Math.pow(normalized, this.contrastPower);
                normalized = Math.max(0, Math.min(1, normalized));
                
                const char = this.valueToChar(normalized);
                
                const px = this.offsetX + x * this.cellSize + this.cellSize / 2;
                const py = this.offsetY + y * this.cellSize + this.cellSize / 2;
                
                this.ctx.fillText(char, px, py);
            }
        }
    }
    
    animate() {
        // Run multiple updates per frame for faster evolution
        for (let i = 0; i < this.updatesPerFrame; i++) {
            this.update();
        }
        this.draw();
        requestAnimationFrame(() => this.animate());
    }
    
    setupEvents() {
        let isDrawing = false;
        
        const getGridPos = (clientX, clientY) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = Math.floor((clientX - rect.left - this.offsetX) / this.cellSize);
            const y = Math.floor((clientY - rect.top - this.offsetY) / this.cellSize);
            return { x, y };
        };
        
        // Mouse events
        this.canvas.addEventListener('mousedown', () => isDrawing = true);
        this.canvas.addEventListener('mouseup', () => isDrawing = false);
        this.canvas.addEventListener('mouseleave', () => isDrawing = false);
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (isDrawing) {
                const { x, y } = getGridPos(e.clientX, e.clientY);
                if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
                    this.addChemical(x, y, this.brushRadius);
                }
            }
        });
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            isDrawing = true;
        });
        
        this.canvas.addEventListener('touchend', () => isDrawing = false);
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (isDrawing && e.touches[0]) {
                const { x, y } = getGridPos(e.touches[0].clientX, e.touches[0].clientY);
                if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
                    this.addChemical(x, y, this.brushRadius);
                }
            }
        });
        
        // Resize handler
        window.addEventListener('resize', () => {
            this.resize();
        });
    }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('bg-canvas');
    if (canvas) {
        window.morphoInstance = new MorphoASCII(canvas);
    }
});