// Main initialization
document.addEventListener('DOMContentLoaded', () => {
    // Smooth scroll for future internal links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Future: Add smooth scroll indicators, lazy loading, etc.
    console.log('mttcsr.com — initialized');
});