// Projects loader - Adaptive infinite scroll (duplicates based on content width)
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
                            this.createGalleryItem(track, path, ext, projectTitle, mediaIndex);
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
        
        // Add track temporarily to measure width
        const tempWrapper = document.createElement('div');
        tempWrapper.style.cssText = 'display: flex; gap: 16px; position: absolute; visibility: hidden;';
        tempWrapper.appendChild(track);
        gallery.appendChild(tempWrapper);
        
        // Wait for content to load and measure
        setTimeout(() => {
            const viewportWidth = gallery.offsetWidth;
            const trackWidth = track.scrollWidth;
            
            // Calculate how many copies needed to fill at least viewport * 3
            const minTotalWidth = viewportWidth * 3;
            const copiesNeeded = Math.max(3, Math.ceil(minTotalWidth / trackWidth));
            
            console.log(`Gallery ${folder}: viewport=${viewportWidth}px, track=${trackWidth}px, copies=${copiesNeeded}`);
            
            // Remove temp wrapper
            gallery.removeChild(tempWrapper);
            
            // Create all copies
            const centerIndex = Math.floor(copiesNeeded / 2);
            for (let i = 0; i < copiesNeeded; i++) {
                const clone = track.cloneNode(true);
                if (i !== centerIndex) {
                    clone.setAttribute('aria-hidden', 'true');
                }
                wrapper.appendChild(clone);
            }
            
            gallery.appendChild(wrapper);
            
            // Setup infinite scroll with adaptive parameters
            this.setupInfiniteScroll(gallery, wrapper, trackWidth, copiesNeeded);
            
            // Setup video lifecycle
            this.setupVideoObserver(gallery);
        }, 300);
    }
    
    createGalleryItem(track, path, ext, projectTitle, mediaIndex) {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        
        const isVideo = ext.toLowerCase() === 'webm';
        
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
            item.appendChild(video);
        } else {
            const img = document.createElement('img');
            img.src = path;
            img.alt = `${projectTitle} - image ${mediaIndex}`;
            img.loading = 'lazy';
            img.decoding = 'async';
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
    
    setupInfiniteScroll(gallery, wrapper, singleTrackWidth, totalCopies) {
        // Read actual CSS gap from wrapper to avoid drift with hardcoded values
        const computedGap = parseFloat(getComputedStyle(wrapper).gap) || 16;
        const trackWidth = singleTrackWidth + computedGap;
        const centerIndex = Math.floor(totalCopies / 2);

        // Start at center track
        gallery.scrollLeft = trackWidth * centerIndex;

        let isPaused = false;
        let animationId = null;
        let interactionTimeout = null;
        let edgeDebounceTimeout = null;
        let autoDirection = 1; // 1: right, -1: left
        let lastScrollLeft = gallery.scrollLeft;

        const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

        // Autoscroll function
        const scroll = () => {
            if (!isPaused && isDesktop) {
                gallery.scrollLeft += 0.5 * autoDirection;
            }
            animationId = requestAnimationFrame(scroll);
        };

        // Seamless edge wrapping (preserve relative offset instead of jumping to center)
        const wrapIfAtEdges = () => {
            const scrollPos = gallery.scrollLeft;
            const maxScroll = trackWidth * (totalCopies - 1);
            const threshold = 10;

            // Too far right → shift left by one track width
            if (scrollPos >= maxScroll - threshold) {
                gallery.scrollLeft = scrollPos - trackWidth;
                return;
            }
            // Too far left → shift right by one track width
            if (scrollPos <= threshold) {
                gallery.scrollLeft = scrollPos + trackWidth;
            }
        };

        // Hover pause (desktop only)
        if (isDesktop) {
            gallery.addEventListener('mouseenter', () => {
                isPaused = true;
            });
            gallery.addEventListener('mouseleave', () => {
                isPaused = false;
            });
            // Start autoscroll
            scroll();
        }

        // Pause autoscroll during user interaction and resume after idle
        const pauseForInteraction = (resumeDelay = 400) => {
            isPaused = true;
            clearTimeout(interactionTimeout);
            interactionTimeout = setTimeout(() => {
                isPaused = false;
            }, resumeDelay);
        };

        // Treat common interaction sources as user intent
        gallery.addEventListener('wheel', (e) => {
            if (e.deltaX < 0) autoDirection = -1;
            else if (e.deltaX > 0) autoDirection = 1;
            pauseForInteraction(800);
        }, { passive: true });
        gallery.addEventListener('touchstart', () => pauseForInteraction(), { passive: true });
        gallery.addEventListener('touchmove', () => pauseForInteraction(800), { passive: true });
        gallery.addEventListener('pointerdown', () => pauseForInteraction());
        gallery.addEventListener('pointermove', () => pauseForInteraction(800));
        gallery.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') { autoDirection = -1; pauseForInteraction(800); }
            else if (e.key === 'ArrowRight') { autoDirection = 1; pauseForInteraction(800); }
        });

        // Handle manual scroll with debounced edge wrap
        gallery.addEventListener('scroll', () => {
            const current = gallery.scrollLeft;
            const delta = current - lastScrollLeft;
            if (delta < 0) autoDirection = -1;
            else if (delta > 0) autoDirection = 1;
            lastScrollLeft = current;
            pauseForInteraction(600);
            clearTimeout(edgeDebounceTimeout);
            edgeDebounceTimeout = setTimeout(wrapIfAtEdges, 50);
        });

        // Cleanup
        window.addEventListener('beforeunload', () => {
            if (animationId) cancelAnimationFrame(animationId);
            clearTimeout(interactionTimeout);
            clearTimeout(edgeDebounceTimeout);
        });
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
