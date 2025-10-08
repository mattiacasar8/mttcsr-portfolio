// Projects loader - Optimized infinite scroll with transform
class ProjectLoader {
    constructor() {
        this.projects = document.querySelectorAll('.project-section[data-project-folder]');
        this.init();
    }
    
    async init() {
        // Load all projects
        for (const section of this.projects) {
            const folder = section.dataset.projectFolder;
            await this.loadProject(section, folder);
        }

        // Notify that the site is ready
        window.dispatchEvent(new Event('site:ready'));
    }
    
    async loadProject(section, folder) {
        try {
            // Load info.txt
            const infoPath = `assets/projects/${folder}/info.txt`;
            let title = folder.replace(/^\d+-/, '').replace(/-/g, ' ');
            let description = 'Project description';
            
            try {
                const response = await fetch(infoPath);
                if (response.ok) {
                    const infoContent = await response.text();
                    const parsed = this.parseInfo(infoContent);
                    title = parsed.title;
                    description = parsed.description;
                }
            } catch (e) {
                console.log(`Could not load info.txt for ${folder}, using default`);
            }
            
            // Update section
            const titleEl = section.querySelector('.project-title');
            const descEl = section.querySelector('.project-description');
            const gallery = section.querySelector('.project-gallery');
            
            if (titleEl) titleEl.textContent = title;
            if (descEl) descEl.textContent = description;
            
            // Load media
            await this.loadGalleryMedia(gallery, folder, title);
            
        } catch (error) {
            console.error(`Error loading project ${folder}:`, error);
        }
    }
    
    async loadGalleryMedia(gallery, folder, projectTitle) {
        const mediaExtensions = ['webp', 'webm'];
        const prefixes = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];
        
        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'gallery-wrapper';
        
        // Create main track
        const track = document.createElement('div');
        track.className = 'gallery-track';
        
        let foundMedia = false;
        let mediaIndex = 1;
        let totalMediaToLoad = 0;
        let loadedMediaCount = 0;
        
        // Callback when a media loads
        const onMediaLoaded = () => {
            loadedMediaCount++;
            if (loadedMediaCount === totalMediaToLoad) {
                // All media loaded - do final calculation
                setTimeout(() => {
                    const event = new CustomEvent('allMediaLoaded', { bubbles: true });
                    gallery.dispatchEvent(event);
                }, 100);
            }
        };
        
        // Try to load numbered media files
        for (const prefix of prefixes) {
            for (const ext of mediaExtensions) {
                const filename = `${prefix}-media.${ext}`;
                const path = `assets/projects/${folder}/${filename}`;
                
                try {
                    // HEAD check for Cloudflare fallback detection
                    const response = await fetch(path, { method: 'HEAD' });
                    
                    if (response.ok) {
                        const contentType = response.headers.get('Content-Type') || '';
                        const isValidWebp = ext === 'webp' && contentType.includes('image/webp');
                        const isValidWebm = ext === 'webm' && contentType.includes('video/webm');
                        
                        if (isValidWebp || isValidWebm) {
                            totalMediaToLoad++;
                            this.createGalleryItem(track, path, ext, projectTitle, mediaIndex, onMediaLoaded);
                            foundMedia = true;
                            mediaIndex++;
                        }
                    }
                } catch (e) {
                    // File doesn't exist, continue
                }
            }
        }
        
        if (!foundMedia) {
            console.log(`No media files found for ${folder}, creating dummy content`);
            this.createDummyItems(track, 5);
        }
        
        // Clone the track once for seamless infinite scroll (2x total)
        const clone = track.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        wrapper.appendChild(track);
        wrapper.appendChild(clone);
        
        gallery.appendChild(wrapper);
        
        // Wait for content to load and measure
        setTimeout(() => {
            const singleTrackWidth = track.scrollWidth;
            
            console.log(`Gallery ${folder}: trackWidth=${singleTrackWidth}px`);
            
            // Setup infinite scroll with transform
            this.setupInfiniteScroll(gallery, wrapper, track, singleTrackWidth);
            
            // Setup video lifecycle
            this.setupVideoObserver(gallery);
        }, 300);
    }
    
    createGalleryItem(track, path, ext, projectTitle, mediaIndex, onMediaLoaded) {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        
        const isVideo = ext.toLowerCase() === 'webm';
        
        // Add loading skeleton placeholder
        const placeholder = document.createElement('div');
        placeholder.className = 'gallery-item-placeholder';
        placeholder.style.cssText = `
            position: absolute;
            inset: 0;
            width: 60vw;
            min-width: 300px;
            height: 100%;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
            pointer-events: none;
            z-index: 1;
        `;
        
        item.style.position = 'relative';
        item.appendChild(placeholder);
        
        const removePlaceholderAndRecalc = () => {
            placeholder.remove();
            // Use requestAnimationFrame to ensure DOM has updated before recalculating
            requestAnimationFrame(() => {
                item.dispatchEvent(new CustomEvent('mediaLoaded', { bubbles: true }));
                if (onMediaLoaded) onMediaLoaded();
            });
        };
        
        if (isVideo) {
            const video = document.createElement('video');
            video.src = path;
            video.muted = true;
            video.setAttribute('muted', '');
            video.loop = true;
            video.playsInline = true;
            video.volume = 0;
            video.preload = 'metadata';
            video.setAttribute('aria-label', `${projectTitle} - video ${mediaIndex}`);
            
            let loaded = false;
            video.addEventListener('loadedmetadata', () => {
                if (!loaded) {
                    loaded = true;
                    removePlaceholderAndRecalc();
                }
            });
            
            video.addEventListener('canplay', () => {
                if (!loaded && placeholder.parentElement) {
                    loaded = true;
                    removePlaceholderAndRecalc();
                }
            });
            
            item.appendChild(video);
        } else {
            const img = document.createElement('img');
            img.src = path;
            img.alt = `${projectTitle} - image ${mediaIndex}`;
            img.loading = 'lazy';
            img.decoding = 'async';
            
            img.addEventListener('load', () => {
                removePlaceholderAndRecalc();
            });
            
            img.addEventListener('error', () => {
                console.error(`Failed to load image: ${path}`);
                placeholder.style.background = 'rgba(255, 0, 0, 0.1)';
                // Still count as loaded even if failed
                if (onMediaLoaded) onMediaLoaded();
            });
            
            item.appendChild(img);
        }
        
        track.appendChild(item);
    }
    
    createDummyItems(track, count) {
        const colors = ['#1a1a1a', '#2a2a2a', '#3a3a3a', '#2a2a2a', '#1a1a1a'];
        
        for (let i = 0; i < count; i++) {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            
            const placeholder = document.createElement('div');
            placeholder.style.cssText = `
                width: 60vw;
                height: 100%;
                background: ${colors[i % colors.length]};
                display: flex;
                align-items: center;
                justify-content: center;
                color: rgba(255,255,255,0.3);
                font-family: var(--font-sans);
                font-size: 0.875rem;
            `;
            placeholder.textContent = `Media ${i + 1}`;
            placeholder.setAttribute('role', 'img');
            placeholder.setAttribute('aria-label', `Placeholder media ${i + 1}`);
            
            item.appendChild(placeholder);
            track.appendChild(item);
        }
    }
    
    setupInfiniteScroll(gallery, wrapper, track, initialTrackWidth) {
        // Configuration
        const speed = 30; // pixels per second
        
        // State
        let singleTrackWidth = initialTrackWidth;
        let computedGap = parseFloat(getComputedStyle(wrapper).gap) || 16;
        let isPlaying = true;
        let isHovered = false;
        let currentPosition = 0;
        let animationId = null;
        let lastTimestamp = null;
        let isManuallyScrolling = false;
        let manualScrollTimeout = null;
        
        // Device detection
        const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        const isTouchDevice = 'ontouchstart' in window;
        
        // Track if we've recalculated on first interaction
        let hasRecalculatedOnInteraction = false;
        
        const recalculateOnFirstInteraction = () => {
            if (!hasRecalculatedOnInteraction) {
                hasRecalculatedOnInteraction = true;
                calculateDimensions();
            }
        };
        
        // Function to recalculate dimensions on resize
        const calculateDimensions = () => {
            const oldWidth = singleTrackWidth;
            singleTrackWidth = track.scrollWidth;
            computedGap = parseFloat(getComputedStyle(wrapper).gap) || 16;
            
            // Adjust position proportionally if dimensions changed
            if (oldWidth > 0 && oldWidth !== singleTrackWidth) {
                const ratio = singleTrackWidth / oldWidth;
                currentPosition *= ratio;
                
                // Ensure position is in valid range
                const totalWidth = singleTrackWidth + computedGap;
                while (currentPosition >= totalWidth) {
                    currentPosition -= totalWidth;
                }
                while (currentPosition < 0) {
                    currentPosition += totalWidth;
                }
                
                updatePosition();
            }
        };
        
        // Setup resize observer
        const setupResizeObserver = () => {
            let resizeTimeout;
            const handleResize = () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(calculateDimensions, 150);
            };
            
            if (typeof ResizeObserver !== 'undefined') {
                const resizeObserver = new ResizeObserver(handleResize);
                resizeObserver.observe(gallery);
                gallery._resizeObserver = resizeObserver;
            } else {
                window.addEventListener('resize', handleResize);
            }
        };
        
        // Animation loop with delta-time for smooth consistent speed
        const animate = (timestamp) => {
            if (!lastTimestamp) {
                lastTimestamp = timestamp;
            }
            
            const deltaTime = (timestamp - lastTimestamp) / 1000; // Convert to seconds
            lastTimestamp = timestamp;
            
            // Auto-scroll only if playing, not hovered, and not manually scrolling
            if (isPlaying && !isHovered && !isManuallyScrolling && isDesktop) {
                currentPosition += speed * deltaTime;
                checkPosition();
                updatePosition();
            }
            
            animationId = requestAnimationFrame(animate);
        };
        
        // Seamless loop: reset position when reaching end of first set
        const checkPosition = () => {
            const totalWidth = singleTrackWidth + computedGap;
            if (currentPosition >= totalWidth) {
                currentPosition -= totalWidth;
            } else if (currentPosition < 0) {
                currentPosition += totalWidth;
            }
        };
        
        // Update wrapper position with transform
        const updatePosition = () => {
            wrapper.style.transform = `translateX(-${currentPosition}px)`;
        };
        
        // Pause on hover (desktop only)
        if (isDesktop) {
            gallery.addEventListener('mouseenter', () => {
                recalculateOnFirstInteraction();
                isHovered = true;
            });
            
            gallery.addEventListener('mouseleave', () => {
                isHovered = false;
                lastTimestamp = null; // Reset to avoid jump
            });
        }
        
        // Manual scroll handling with wheel
        gallery.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            recalculateOnFirstInteraction();
            isManuallyScrolling = true;
            clearTimeout(manualScrollTimeout);
            
            // Use deltaX if horizontal scroll, otherwise use deltaY and translate to horizontal
            const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
            currentPosition += delta * 0.5;
            checkPosition();
            updatePosition();
            
            // Resume auto-scroll after idle
            manualScrollTimeout = setTimeout(() => {
                isManuallyScrolling = false;
                lastTimestamp = null;
            }, 800);
        }, { passive: false });
        
        // Touch support for mobile
        if (isTouchDevice) {
            let touchStartX = 0;
            let touchCurrentX = 0;
            
            gallery.addEventListener('touchstart', (e) => {
                recalculateOnFirstInteraction();
                touchStartX = e.touches[0].clientX;
                isManuallyScrolling = true;
                clearTimeout(manualScrollTimeout);
            }, { passive: true });
            
            gallery.addEventListener('touchmove', (e) => {
                touchCurrentX = e.touches[0].clientX;
                const delta = touchStartX - touchCurrentX;
                currentPosition += delta;
                touchStartX = touchCurrentX;
                checkPosition();
                updatePosition();
            }, { passive: true });
            
            gallery.addEventListener('touchend', () => {
                manualScrollTimeout = setTimeout(() => {
                    isManuallyScrolling = false;
                    lastTimestamp = null;
                }, 400);
            }, { passive: true });
        }
        
        // Keyboard navigation
        gallery.setAttribute('tabindex', '0');
        gallery.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                recalculateOnFirstInteraction();
                isManuallyScrolling = true;
                clearTimeout(manualScrollTimeout);
                
                const scrollAmount = e.key === 'ArrowLeft' ? -50 : 50;
                currentPosition += scrollAmount;
                checkPosition();
                updatePosition();
                
                manualScrollTimeout = setTimeout(() => {
                    isManuallyScrolling = false;
                    lastTimestamp = null;
                }, 800);
            }
        });
        
        // Setup resize handling
        setupResizeObserver();
        
        // Listen for media load events to recalculate dimensions
        gallery.addEventListener('mediaLoaded', () => {
            calculateDimensions();
        });
        
        // Listen for all media loaded event for final calculation
        gallery.addEventListener('allMediaLoaded', () => {
            console.log('All media loaded, final dimension calculation');
            calculateDimensions();
        });
        
        // Start animation
        animationId = requestAnimationFrame(animate);
        
        // Cleanup
        const cleanup = () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
            clearTimeout(manualScrollTimeout);
            if (gallery._resizeObserver) {
                gallery._resizeObserver.disconnect();
            }
        };
        
        window.addEventListener('beforeunload', cleanup);
        
        // Store cleanup function for potential future use
        gallery._cleanupInfiniteScroll = cleanup;
    }
    
    setupVideoObserver(gallery) {
        const options = {
            root: gallery,
            rootMargin: '100px',
            threshold: 0.1
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const video = entry.target.querySelector('video');
                if (video) {
                    if (entry.isIntersecting) {
                        video.play().catch(() => {});
                    } else {
                        video.pause();
                    }
                }
            });
        }, options);
        
        // Observe all gallery items
        gallery.querySelectorAll('.gallery-item').forEach(item => {
            observer.observe(item);
        });
    }
    
    parseInfo(content) {
        const lines = content.split('\n').filter(l => l.trim());
        let title = 'Project Title';
        let description = '';
        
        if (lines.length > 0) {
            const firstLine = lines[0].trim();
            if (firstLine.startsWith('#')) {
                title = firstLine.substring(1).trim();
                description = lines.slice(1).join('\n').trim();
            } else {
                title = firstLine;
                description = lines.slice(1).join('\n').trim();
            }
        }
        
        return { title, description };
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new ProjectLoader();
    });
} else {
    new ProjectLoader();
}