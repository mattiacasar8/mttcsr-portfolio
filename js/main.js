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
    
    // Hide scroll indicator on scroll
    const scrollIndicator = document.querySelector('.scroll-indicator');
    if (scrollIndicator) {
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                scrollIndicator.classList.add('hidden');
            } else {
                scrollIndicator.classList.remove('hidden');
            }
        });
    }
    
    console.log('mttcsr.com — initialized');
});
