# mttcsr.com

Personal portfolio website for Mattia Casarotto - Multimedia Designer

## Structure

```
mttcsr-portfolio/
├── index.html              # Main HTML
├── css/
│   ├── reset.css          # Browser normalization
│   └── style.css          # All styles (variables, layout, components)
├── js/
│   ├── main.js            # Main initialization
│   └── canvas/
│       └── background.js  # Interactive particle canvas
├── assets/
│   ├── images/            # Images
│   └── videos/            # Videos (reel, etc.)
└── README.md
```

## Setup

1. Clone repository
2. Open `index.html` in browser or use local server:
   ```bash
   python -m http.server 8000
   # or
   npx serve
   ```

## Adding New Sections

To add a new content section (e.g., Reel or Project):

1. Open `index.html`
2. Uncomment or add before closing `</body>`:

```html
<section class="content-section">
    <div class="section-container">
        <h2>Section Title</h2>
        <p class="section-description">Brief description of the section</p>
        <div class="section-media">
            <video controls>
                <source src="assets/videos/your-video.mp4" type="video/mp4">
            </video>
            <!-- or for images: -->
            <!-- <img src="assets/images/your-image.jpg" alt="Description"> -->
        </div>
    </div>
</section>
```

Styling is handled automatically by `css/components/section.css`.

## Customization

Edit design tokens at the top of `css/style.css`:
- Colors
- Spacing
- Typography
- Layout constraints

## Canvas Background

The interactive particle field in `js/canvas/background.js`:
- Particles move with subtle drift
- Mouse repulsion effect
- Connections between nearby particles

To modify behavior, edit the `ParticleField` class parameters.

## Deploy

Push to GitHub and connect to Cloudflare Pages for automatic deployment.

---

© 2025 Mattia Casarotto