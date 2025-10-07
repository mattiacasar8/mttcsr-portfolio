// Projects loader - simplified with CSS-based infinite scroll
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
            
            // Load media files
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
        
        // Create wrapper that will contain both tracks
        const wrapper = document.createElement('div');
        wrapper.className = 'gallery-wrapper';
        
        // Create first track
        const track = document.createElement('div');
        track.className = 'gallery-track';
        
        let foundMedia = false;
        
        // Try to load numbered media files
        for (const prefix of prefixes) {
            for (const ext of mediaExtensions) {
                const filename = `${prefix}-media.${ext}`;
                const path = `assets/projects/${folder}/${filename}`;
                
                try {
                    // Check if file exists AND has correct Content-Type
                    const response = await fetch(path, { method: 'HEAD' });
                    
                    if (response.ok) {
                        const contentType = response.headers.get('Content-Type') || '';
                        
                        // Verify the content type matches the file extension
                        const isValidWebp = ext === 'webp' && contentType.includes('image/webp');
                        const isValidWebm = ext === 'webm' && contentType.includes('video/webm');
                        
                        // Only add if content type is correct (not HTML fallback)
                        if (isValidWebp || isValidWebm) {
                            this.addMediaToTrack(track, path, ext);
                            foundMedia = true;
                        } else {
                            console.log(`Skipping ${filename}: wrong content type (${contentType})`);
                        }
                    }
                } catch (e) {
                    // File doesn't exist or network error, continue
                }
            }
        }
        
        if (!foundMedia) {
            console.log(`No media files found for ${folder}, creating dummy content`);
            this.createDummyTrack(track);
        }
        
        // Clone the track for seamless infinite loop
        const trackClone = track.cloneNode(true);
        
        // Start all videos in the clone too
        trackClone.querySelectorAll('video').forEach(v => {
            v.play().catch(() => {});
        });
        
        // Add both tracks to wrapper
        wrapper.appendChild(track);
        wrapper.appendChild(trackClone);
        
        // Add wrapper to gallery
        gallery.appendChild(wrapper);
    }
    
    addMediaToTrack(track, path, ext) {
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
            video.autoplay = true;
            video.volume = 0;
            item.appendChild(video);
            
            // Ensure it plays
            video.play().catch(() => {});
        } else {
            const img = document.createElement('img');
            img.src = path;
            img.alt = '';
            item.appendChild(img);
        }
        
        track.appendChild(item);
    }
    
    createDummyTrack(track) {
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
            track.appendChild(item);
        }
    }
    
    createDummyGallery(gallery) {
        const wrapper = document.createElement('div');
        wrapper.className = 'gallery-wrapper';
        
        const track = document.createElement('div');
        track.className = 'gallery-track';
        this.createDummyTrack(track);
        
        const trackClone = track.cloneNode(true);
        
        wrapper.appendChild(track);
        wrapper.appendChild(trackClone);
        
        gallery.appendChild(wrapper);
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
