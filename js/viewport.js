// Stable viewport dimensions for mobile
// Calculates initial viewport and sets as CSS custom properties
// Prevents layout shift when mobile browser UI shows/hides

(function() {
    function setStableViewport() {
        // Get initial viewport dimensions
        const vh = window.innerHeight * 0.01;
        const vw = window.innerWidth * 0.01;
        
        // Set as CSS custom properties
        document.documentElement.style.setProperty('--vh', `${vh}px`);
        document.documentElement.style.setProperty('--vw', `${vw}px`);
        
        // Store initial height for canvas
        document.documentElement.style.setProperty('--initial-vh', `${vh}px`);
    }
    
    // Set on load
    setStableViewport();
    
    // Only update on significant resize (orientation change or desktop resize)
    let resizeTimeout;
    let lastWidth = window.innerWidth;
    
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        
        // Only recalculate if width changed significantly (orientation change or desktop)
        // This ignores mobile browser UI showing/hiding (only height changes)
        const currentWidth = window.innerWidth;
        const widthChanged = Math.abs(currentWidth - lastWidth) > 100;
        
        if (widthChanged) {
            resizeTimeout = setTimeout(() => {
                setStableViewport();
                lastWidth = currentWidth;
            }, 100);
        }
    }, { passive: true });
})();
