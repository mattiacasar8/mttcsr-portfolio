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
│   ├── projects.js        # File-based CMS and gallery autoscroll
│   └── canvas/
│       └── background.js  # Interactive particle canvas
├── assets/
│   ├── projects/          # Project folders
│   │   ├── 01-project-name/
│   │   │   ├── info.txt   # Title and description
│   │   │   ├── 01-media.jpg
│   │   │   ├── 02-media.mp4
│   │   │   └── ...
│   │   └── ...
│   └── reel/              # Reel media files
│       ├── 01-video.mp4
│       ├── 02-still.jpg
│       └── ...
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

## Adding New Projects

The site uses a file-based CMS. To add a new project:

### 1. Create Project Folder

Create a new folder in `assets/projects/` with the format `XX-project-name`:
```
assets/projects/04-new-project/
```

The number prefix (01, 02, 03...) determines the display order.

### 2. Add Project Info

Create `info.txt` in the project folder:
```
#Project Title
Project description goes here. You can add multiple paragraphs.

This is a second paragraph if needed.
```

The first line starting with `#` becomes the title. Everything else is the description.

### 3. Add Media Files

Add images and videos with numbered prefixes:
```
01-hero.jpg
02-detail.mp4
03-closeup.png
04-animation.gif
```

Supported formats:
- Images: `.jpg`, `.jpeg`, `.png`, `.gif`
- Videos: `.mp4`, `.webm`

Files are displayed in alphabetical order (hence the number prefixes).

### 4. Update HTML

Add a new section in `index.html` before the CTA section:
```html
<section class="project-section" data-project-folder="04-new-project">
    <div class="project-container">
        <h3 class="project-title">Loading...</h3>
        <div class="project-gallery"></div>
        <p class="project-description">Loading project details...</p>
    </div>
</section>
```

The `data-project-folder` attribute must match your folder name.

## Adding Reel Media

Add media files directly to `assets/reel/`:
```
assets/reel/
├── 01-main-video.mp4
├── 02-still-frame.jpg
├── 03-experiment.gif
└── ...
```

The reel section will automatically populate from these files.

## Gallery Behavior

- **Desktop**: Horizontal autoscroll (pauses on hover)
- **Mobile**: Manual swipe/scroll
- **Media**: Maintains aspect ratio, fixed height (~65vh)
- Videos autoplay, loop, and are muted

## Customization

Edit design tokens at the top of `css/style.css`:
- Colors
- Spacing
- Typography
- Layout constraints

## Canvas Background

The interactive reaction-diffusion field in `js/canvas/background.js`:
- Renders as ASCII art
- Mouse/touch interactive (draw to add chemicals)
- Gray-Scott algorithm parameters can be modified

## Deploy

Push to GitHub and connect to Cloudflare Pages for automatic deployment.

---

© 2025 Mattia Casarotto
