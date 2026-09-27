// Morphogenetic ASCII Field with idle management and easter eggs
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
        
        // Generate 6-bit RGB palette (2 bits per channel = 64 colors)
        this.palette6bit = this.generate6BitPalette();
        
        // Color palettes (1-9 keys) - duotones from 6-bit space
        this.colorPalettes = [
            { name: 'default', colors: ['#ffffff'] }, // 1 - white mono
            { name: 'hacker', colors: ['#00aa00'] },  // 2 - terminal green mono
            { name: 'cyber', colors: ['#00aaaa', '#aa00aa'] }, // 3 - cyan/magenta
            { name: 'ocean', colors: ['#0000aa', '#00ffff'] },  // 4 - deep blue/bright cyan
            { name: 'forest', colors: ['#005500', '#55ff55'] }, // 5 - dark green/bright green
            { name: 'sunset', colors: ['#aa5500', '#ffff55'] }, // 6 - orange/pale yellow
            { name: 'berry', colors: ['#aa0055', '#ff55ff'] },  // 7 - dark magenta/bright pink
            { name: 'fire', colors: ['#aa0000', '#ffaa00'] },   // 8 - red/orange
            { name: 'electric', colors: ['#5500aa', '#55ffff'] } // 9 - purple/cyan
        ];
        
        this.currentPaletteIndex = 0;
        this.rainbowMode = false;
        
        // Rainbow mode color sequences for each value range
        // Each sequence cycles through perceptually-organized 6-bit colors
        this.rainbowSequences = {
            // 0-0.25: Dark tones
            dark: [
                '#000000', '#000055', '#0000aa', '#550055', 
                '#550000', '#005500', '#005555'
            ],
            // 0.25-0.5: Mid-dark tones
            midDark: [
                '#0000aa', '#0055aa', '#00aa55', '#00aa00',
                '#55aa00', '#aa5500', '#aa0055', '#5500aa'
            ],
            // 0.5-0.75: Mid-bright tones
            midBright: [
                '#00aaaa', '#00ff55', '#55ff00', '#aaff00',
                '#ffaa00', '#ff5500', '#ff0055', '#aa00aa'
            ],
            // 0.75-1.0: Bright tones
            bright: [
                '#55ffff', '#aaffaa', '#ffffaa', '#ffaaaa',
                '#ffaaff', '#aaaaff', '#ffffff'
            ]
        };
        
        // Animation timing for rainbow cycling
        this.rainbowCycleSpeed = 0.0003; // Slower cycle
        this.rainbowOffsets = [0, 0.25, 0.5, 0.75]; // Offset for each range
        
        // Modifier keys state
        this.modifierKeys = {
            shift: false,
            ctrl: false
        };
        
        // Idle management
        this.isActive = true;
        this.idleTimeout = null;
        this.idleDelay = 30000;
        this.animationFrameId = null;
        
        this.resize();
        this.init();
        this.setupEvents();
        this.animate();
        this.resetIdleTimer();
    }
    
    // Generate 6-bit RGB palette (2 bits per channel)
    generate6BitPalette() {
        const palette = [];
        const levels = [0x00, 0x55, 0xaa, 0xff]; // 4 levels per channel
        
        for (let r = 0; r < 4; r++) {
            for (let g = 0; g < 4; g++) {
                for (let b = 0; b < 4; b++) {
                    const hex = '#' + 
                        levels[r].toString(16).padStart(2, '0') +
                        levels[g].toString(16).padStart(2, '0') +
                        levels[b].toString(16).padStart(2, '0');
                    palette.push(hex);
                }
            }
        }
        
        return palette;
    }
    
    resetIdleTimer() {
        if (this.idleTimeout) {
            clearTimeout(this.idleTimeout);
        }
        
        if (!this.isActive) {
            this.isActive = true;
            this.animate();
        }
        
        this.idleTimeout = setTimeout(() => {
            this.pauseAnimation();
        }, this.idleDelay);
    }
    
    pauseAnimation() {
        this.isActive = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    
    resize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.cols = Math.floor(width / this.cellSize);
        this.rows = Math.floor(height / this.cellSize);
        
        this.canvas.width = width;
        this.canvas.height = height;
        
        this.offsetX = (width - this.cols * this.cellSize) / 2;
        this.offsetY = (height - this.rows * this.cellSize) / 2;
        
        const size = this.cols * this.rows;
        this.gridA = new Float32Array(size);
        this.gridB = new Float32Array(size);
        this.nextA = new Float32Array(size);
        this.nextB = new Float32Array(size);
        
        this.init();
    }
    
    init() {
        for (let i = 0; i < this.gridA.length; i++) {
            this.gridA[i] = 1.0;
            this.gridB[i] = 0.0;
        }
        
        const centerX = Math.floor(this.cols / 2);
        const centerY = Math.floor(this.rows / 2);
        this.addChemical(centerX, centerY, 1, 'B');
    }
    
    addSeeds(count) {
        for (let i = 0; i < count; i++) {
            const x = Math.floor(Math.random() * this.cols);
            const y = Math.floor(Math.random() * this.rows);
            const r = 2 + Math.random() * 3;
            this.addChemical(x, y, r, 'B');
        }
    }
    
    addChemical(x, y, radius = 3, type = 'B') {
        const r = Math.floor(radius);
        for (let i = -r; i <= r; i++) {
            for (let j = -r; j <= r; j++) {
                if (i*i + j*j <= r*r) {
                    const px = (x + i + this.cols) % this.cols;
                    const py = (y + j + this.rows) % this.rows;
                    const idx = py * this.cols + px;
                    if (idx >= 0 && idx < this.gridB.length) {
                        if (type === 'B') {
                            this.gridB[idx] = 1.0;
                        } else if (type === 'A') {
                            this.gridA[idx] = 1.0;
                        } else if (type === 'removeB') {
                            this.gridB[idx] = 0.0;
                        }
                    }
                }
            }
        }
    }
    
    // Get color from cycling rainbow sequence based on value range
    getRainbowColor(normalized) {
        const time = Date.now() * this.rainbowCycleSpeed;
        
        let sequence, offset;
        
        // Determine which range and sequence to use
        if (normalized < 0.25) {
            sequence = this.rainbowSequences.dark;
            offset = this.rainbowOffsets[0];
        } else if (normalized < 0.5) {
            sequence = this.rainbowSequences.midDark;
            offset = this.rainbowOffsets[1];
        } else if (normalized < 0.75) {
            sequence = this.rainbowSequences.midBright;
            offset = this.rainbowOffsets[2];
        } else {
            sequence = this.rainbowSequences.bright;
            offset = this.rainbowOffsets[3];
        }
        
        // Calculate index in sequence with time offset
        const cycle = (time + offset) % 1.0;
        const index = Math.floor(cycle * sequence.length);
        
        return sequence[index];
    }
    
    // Get color based on current mode
    getColor(normalized) {
        if (this.rainbowMode) {
            return this.getRainbowColor(normalized);
        }
        
        const palette = this.colorPalettes[this.currentPaletteIndex];
        
        // For duotone, use discrete threshold
        if (palette.colors.length > 1) {
            return normalized > 0.5 ? palette.colors[1] : palette.colors[0];
        }
        
        return palette.colors[0];
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
        
        [this.gridA, this.nextA] = [this.nextA, this.gridA];
        [this.gridB, this.nextB] = [this.nextB, this.gridB];
    }
    
    valueToChar(value) {
        for (let i = this.chars.length - 1; i >= 0; i--) {
            if (value >= this.chars[i].threshold) {
                return this.chars[i].char;
            }
        }
        return ' ';
    }
    
    draw() {
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.font = `${this.fontSize}px "Inter", monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const idx = y * this.cols + x;
                const value = this.gridA[idx] - this.gridB[idx];
                let normalized = 1 - ((value + 1) / 2);
                
                normalized = Math.pow(normalized, this.contrastPower);
                normalized = Math.max(0, Math.min(1, normalized));
                
                const char = this.valueToChar(normalized);
                
                if (char === ' ') continue;
                
                const px = this.offsetX + x * this.cellSize + this.cellSize / 2;
                const py = this.offsetY + y * this.cellSize + this.cellSize / 2;
                
                this.ctx.fillStyle = this.getColor(normalized);
                this.ctx.fillText(char, px, py);
            }
        }
    }
    
    animate() {
        if (!this.isActive) return;
        
        for (let i = 0; i < this.updatesPerFrame; i++) {
            this.update();
        }
        this.draw();
        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }
    
    setupEvents() {
        let isDrawing = false;
        
        const getGridPos = (clientX, clientY) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = Math.floor((clientX - rect.left - this.offsetX) / this.cellSize);
            const y = Math.floor((clientY - rect.top - this.offsetY) / this.cellSize);
            return { x, y };
        };
        
        const onInteraction = () => {
            this.resetIdleTimer();
        };
        
        // Keyboard events
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Shift') {
                this.modifierKeys.shift = true;
            }
            if (e.key === 'Control' || e.key === 'Meta') {
                this.modifierKeys.ctrl = true;
            }
            
            // Number keys 1-9 for color palettes
            const num = parseInt(e.key);
            if (num >= 1 && num <= 9) {
                this.currentPaletteIndex = num - 1;
                this.rainbowMode = false;
                onInteraction();
            }
            
            // 0 for rainbow mode
            if (e.key === '0') {
                this.rainbowMode = !this.rainbowMode;
                onInteraction();
            }
        });
        
        window.addEventListener('keyup', (e) => {
            if (e.key === 'Shift') {
                this.modifierKeys.shift = false;
            }
            if (e.key === 'Control' || e.key === 'Meta') {
                this.modifierKeys.ctrl = false;
            }
        });
        
        // Mouse events
        this.canvas.addEventListener('mousedown', () => {
            isDrawing = true;
            onInteraction();
        });
        
        this.canvas.addEventListener('mouseup', () => {
            isDrawing = false;
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            isDrawing = false;
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            onInteraction();
            if (isDrawing) {
                const { x, y } = getGridPos(e.clientX, e.clientY);
                if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
                    if (this.modifierKeys.shift) {
                        this.addChemical(x, y, this.brushRadius, 'removeB');
                    } else if (this.modifierKeys.ctrl) {
                        this.addChemical(x, y, this.brushRadius, 'A');
                    } else {
                        this.addChemical(x, y, this.brushRadius, 'B');
                    }
                }
            }
        });
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            isDrawing = true;
            onInteraction();
        });
        
        this.canvas.addEventListener('touchend', () => {
            isDrawing = false;
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            onInteraction();
            if (isDrawing && e.touches[0]) {
                const { x, y } = getGridPos(e.touches[0].clientX, e.touches[0].clientY);
                if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
                    this.addChemical(x, y, this.brushRadius, 'B');
                }
            }
        });
        
        // Resize handler
        let resizeTimeout;
        let lastWidth = window.innerWidth;
        let lastHeight = window.innerHeight;
        
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            
            const currentWidth = window.innerWidth;
            const currentHeight = window.innerHeight;
            
            const widthChanged = Math.abs(currentWidth - lastWidth) > 50;
            const heightChanged = Math.abs(currentHeight - lastHeight) > 100;
            
            if (widthChanged || heightChanged) {
                resizeTimeout = setTimeout(() => {
                    this.resize();
                    lastWidth = currentWidth;
                    lastHeight = currentHeight;
                }, 100);
            }
        }, { passive: true });
    }
}

// Initialize (bundled as a deferred module: the DOM may already be parsed)
function initMorpho() {
    const canvas = document.getElementById('bg-canvas');
    if (canvas) {
        window.morphoInstance = new MorphoASCII(canvas);
    }
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initMorpho);
} else {
    initMorpho();
}