// Projects loader and gallery autoscroll
class ProjectLoader {
    constructor() {
        this.projects = document.querySelectorAll('.project-section[data-project-folder]');
        this.scrollSpeed = 0.5; // pixels per frame
        this.isHovering = new Map();
        this.isUserScrolling = new Map();
        this.scrollTimeouts = new Map();
        this.originalWidths = new Map();
        this.activeVideos = new Set();
        this.maxActiveVideos = 4;
        this.videoObserver = null;
        
        this.init();
    }
    
    async init() {
        // Setup video intersection observer FIRST so we can safely observe videos as we add them
        this.setupVideoObserver();
        
        // Load all projects
        for (const section of this.projects) {
            const folder = section.dataset.projectFolder;
            await this.loadProject(section, folder);
        }
        
        // Start autoscroll for all galleries
        this.startAutoscroll();

        // Notify that the site is ready (initial galleries prepared)
        window.dispatchEvent(new Event('site:ready'));
    }
    
    setupVideoObserver() {
        // Observer to play/pause videos based on visibility
        this.videoObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const video = entry.target;
                
                if (entry.isIntersecting) {
                    // Video is visible, try to play if under limit
                    if (this.activeVideos.size < this.maxActiveVideos) {
                        video.play().catch(e => console.log('Video play prevented:', e));
                        this.activeVideos.add(video);
                    }
                } else {
                    // Video is not visible, pause it
                    video.pause();
                    this.activeVideos.delete(video);
                }
            });
        }, {
            root: null,
            rootMargin: '50px',
            threshold: 0.1
        });

        // Observe any videos that might already be in the DOM
        document.querySelectorAll('.project-gallery video').forEach(video => {
            try {
                this.videoObserver.observe(video);
            } catch (e) {
                // noop
            }
        });
    }
    
    async loadProject(section, folder) {
        try {
            // Try to read info.txt using fetch
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
            
            // Load media files - try common filenames
            await this.loadGalleryMedia(gallery, folder);
            
        } catch (error) {
            console.error(`Error loading project ${folder}:`, error);
            this.createDummyGallery(section.querySelector('.project-gallery'));
        }
    }
    
    async loadGalleryMedia(gallery, folder) {
        // Only look for converted formats: webp (images) and webm (videos)
        const mediaExtensions = ['webp', 'webm'];
        const prefixes = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];
        
        let foundMedia = false;
        
        // Try to load numbered media files
        for (const prefix of prefixes) {
            for (const ext of mediaExtensions) {
                const filename = `${prefix}-media.${ext}`;
                const path = `assets/projects/${folder}/${filename}`;
                
                try {
                    const response = await fetch(path, { method: 'HEAD' });
                    if (response.ok) {
                        this.addMediaToGallery(gallery, path, ext);
                        foundMedia = true;
                    }
                } catch (e) {
                    // File doesn't exist, continue
                }
            }
        }
        
        if (!foundMedia) {
            console.log(`No media files found for ${folder}, creating dummy content`);
            this.createDummyGallery(gallery);
        } else {
            // Clone items for infinite scroll
            this.setupInfiniteScroll(gallery);
        }
    }
    
    addMediaToGallery(gallery, path, ext) {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        
        const isVideo = ['mp4', 'webm'].includes(ext.toLowerCase());
        
        if (isVideo) {
            const video = document.createElement('video');
            video.src = path;
            video.muted = true;
            video.setAttribute('muted', '');
            video.loop = true;
            video.playsInline = true;
            video.volume = 0;
            // Don't autoplay - let observer handle it
            item.appendChild(video);
            
            // Observe this video
            if (this.videoObserver) {
                try {
                    this.videoObserver.observe(video);
                } catch (e) {
                    // noop
                }
            }
        } else {
            const img = document.createElement('img');
            img.src = path;
            img.alt = '';
            item.appendChild(img);
        }
        
        gallery.appendChild(item);
    }
    
    createDummyGallery(gallery) {
        // Create dummy content for demonstration
        const dummyCount = 5;
        const colors = ['#1a1a1a', '#2a2a2a', '#3a3a3a', '#2a2a2a', '#1a1a1a'];
        
        for (let i = 0; i < dummyCount; i++) {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            
            const placeholder = document.createElement('div');
            placeholder.style.cssText = `
                width: 60vw;
                height: 100%;
                background: ${colors[i]};
                display: flex;
                align-items: center;
                justify-content: center;
                color: rgba(255,255,255,0.3);
                font-family: var(--font-sans);
                font-size: 0.875rem;
            `;
            placeholder.textContent = `Media ${i + 1}`;
            
            item.appendChild(placeholder);
            gallery.appendChild(item);
        }
        
        // Setup infinite scroll even for dummy content
        this.setupInfiniteScroll(gallery);
    }
    
    setupInfiniteScroll(gallery) {
        // Get original items
        const items = Array.from(gallery.querySelectorAll('.gallery-item'));
        
        // Calculate original content width (before cloning)
        let originalWidth = 0;
        items.forEach(item => {
            originalWidth += item.offsetWidth;
        });
        
        // Add gap spacing between items
        const gap = 16; // matches CSS --space-16
        originalWidth += gap * (items.length - 1);
        
        // Store original width for this gallery
        this.originalWidths.set(gallery, originalWidth);
        
        // Clone items multiple times for seamless infinite scroll
        // Reduced from 10 to 4 for better performance
        for (let i = 0; i < 4; i++) {
            items.forEach(item => {
                const clone = item.cloneNode(true);
                
                // Observe cloned videos too
                const video = clone.querySelector('video');
                if (video) {
                    video.muted = true;
                    video.setAttribute('muted', '');
                    video.volume = 0;
                    if (this.videoObserver) {
                        try {
                            this.videoObserver.observe(video);
                        } catch (e) {
                            // noop
                        }
                    }
                }
                
                gallery.appendChild(clone);
            });
        }
        
        // Initialize user scrolling state
        this.isUserScrolling.set(gallery, false);
        
        // Detect manual scrolling
        gallery.addEventListener('wheel', () => {
            this.isUserScrolling.set(gallery, true);
            this.resetUserScrollingFlag(gallery);
        }, { passive: true });
        
        gallery.addEventListener('touchmove', () => {
            this.isUserScrolling.set(gallery, true);
            this.resetUserScrollingFlag(gallery);
        }, { passive: true });
        
        gallery.addEventListener('mousedown', () => {
            this.isUserScrolling.set(gallery, true);
        });
        
        gallery.addEventListener('mouseup', () => {
            this.resetUserScrollingFlag(gallery);
        });
    }
    
    resetUserScrollingFlag(gallery) {
        // Clear existing timeout
        if (this.scrollTimeouts.has(gallery)) {
            clearTimeout(this.scrollTimeouts.get(gallery));
        }
        
        // Set new timeout to reset flag after user stops scrolling
        const timeout = setTimeout(() => {
            this.isUserScrolling.set(gallery, false);
        }, 150);
        
        this.scrollTimeouts.set(gallery, timeout);
    }
    
    parseInfo(content) {
        const lines = content.split('\n').filter(l => l.trim());
        let title = 'Project Title';
        let description = '';
        
        if (lines.length > 0) {
            // First line with # is title
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
    
    startAutoscroll() {
        const galleries = document.querySelectorAll('.project-gallery');
        
        galleries.forEach(gallery => {
            // Initialize hover state
            this.isHovering.set(gallery, false);
            
            // Add hover listeners
            gallery.addEventListener('mouseenter', () => {
                this.isHovering.set(gallery, true);
            });
            
            gallery.addEventListener('mouseleave', () => {
                this.isHovering.set(gallery, false);
            });
            
            // Check if touch device
            const isTouchDevice = 'ontouchstart' in window;
            
            if (!isTouchDevice) {
                // Desktop: autoscroll with infinite loop
                const originalWidth = this.originalWidths.get(gallery);
                
                const scroll = () => {
                    // Only autoscroll if not hovering and user is not manually scrolling
                    if (!this.isHovering.get(gallery) && !this.isUserScrolling.get(gallery)) {
                        gallery.scrollLeft += this.scrollSpeed;
                        
                        // Reset seamlessly when reaching original width
                        if (gallery.scrollLeft >= originalWidth) {
                            gallery.scrollLeft = 0;
                        }
                    }
                    
                    requestAnimationFrame(scroll);
                };
                scroll();
            }
        });
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
