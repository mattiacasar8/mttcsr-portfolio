# mttcsr.com - File Structure

```
mttcsr-portfolio/
├── index.html
├── css/
│   ├── reset.css
│   └── style.css
├── js/
│   ├── main.js
│   └── canvas/
│       └── background.js
├── assets/
│   ├── images/
│   └── videos/
└── README.md
```

## Setup Instructions

1. **Clone/Create repo**
```bash
mkdir mttcsr-portfolio && cd mttcsr-portfolio
git init
```

2. **Create folder structure**
```bash
mkdir -p css js/canvas assets/images assets/videos
```

3. **Add files** (see artifacts below)

4. **Test locally**
```bash
# Use any local server, e.g.:
python -m http.server 8000
# or
npx serve
```

5. **Push to GitHub**
```bash
git add .
git commit -m "Initial structure"
git push
```

## File Purposes

- **reset.css**: Browser normalization
- **style.css**: All styles (variables, layout, components)
- **js/main.js**: Initialization and coordination
- **js/canvas/background.js**: Interactive canvas logic

## Adding New Sections

To add a project/reel section:

1. Add HTML in `index.html`:
```html
<section class="content-section">
    <div class="section-container">
        <h2>Section Title</h2>
        <p class="section-description">Description text</p>
        <div class="section-media">
            <!-- video or image -->
        </div>
    </div>
</section>
```

2. Style is already handled by `components/section.css`

3. Sections will stack vertically on scroll