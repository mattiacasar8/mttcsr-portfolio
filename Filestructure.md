# File Structure

```
mttcsr-portfolio/
│
├── index.html                 # Main HTML structure
├── favicon.svg               # Site favicon
├── og-image.jpg              # Open Graph image
│
├── css/
│   ├── reset.css             # CSS reset
│   └── style.css             # Main stylesheet
│
├── js/
│   ├── main.js               # Main initialization
│   ├── projects.js           # File-based CMS loader
│   ├── loader.js             # Loading functionality
│   ├── viewport.js           # Viewport utilities
│   └── canvas/
│       └── background.js     # Reaction-diffusion background
│
├── assets/
│   ├── images/               # General images (empty)
│   ├── videos/               # General videos (empty)
│   └── projects/             # Project folders (file-based CMS)
│       ├── 01-intelligence-on-demand/
│       │   ├── info.txt      # #Title + description
│       │   ├── 01-media.webp # Numbered media files
│       │   ├── 02-media.webp
│       │   ├── ...
│       │   └── 10-media.webp
│       │
│       ├── 02-reel/
│       │   ├── info.txt
│       │   ├── 01-media.webm
│       │   ├── 02-media.webp
│       │   ├── ...
│       │   └── 05-media.webm
│       │
│       └── 03-off-track/
│           ├── info.txt
│           ├── 01-media.webp
│           ├── 02-media.webp
│           ├── ...
│           └── 06-media.webp
│
├── scripts/                  # Build/deployment scripts (empty)
├── Filestructure.md          # This documentation file
└── README.md                 # Project documentation

```

## File Naming Conventions

### Project Folders
- Format: `XX-project-name/` (e.g., `01-intelligence-on-demand/`)
- Number prefix determines display order
- Use lowercase and hyphens

### Media Files
- Format: `XX-media.ext` (e.g., `01-media.webp`)
- Number prefix determines order within gallery
- Supported: `.webp`, `.webm`, `.jpg`, `.jpeg`, `.png`, `.gif`, `.mp4`

### Info Files
- Filename: `info.txt`
- Format:
  ```
  #Project Title
  Project description...
  
  Optional second paragraph.
  ```

## Adding New Content

1. **New Project**:
   - Create folder: `assets/projects/04-new-project/`
   - Add `info.txt`
   - Add numbered media files (e.g., `01-media.webp`, `02-media.webm`)
   - Add section in `index.html` with `data-project-folder="04-new-project"`

2. **Adding Media to Existing Projects**:
   - Add numbered files to the project folder
   - Files automatically load on page refresh

## How It Works

The site uses a file-based CMS approach:
- `projects.js` reads directory contents at runtime
- Parses `info.txt` for project metadata
- Populates galleries with media files in order
- Implements autoscroll behavior (desktop) and swipe (mobile)

No build step required - just add files and reload.
