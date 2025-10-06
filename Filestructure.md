# File Structure

```
mttcsr-portfolio/
│
├── index.html                 # Main HTML structure
│
├── css/
│   ├── reset.css             # CSS reset
│   └── style.css             # Main stylesheet
│
├── js/
│   ├── main.js               # Main initialization
│   ├── projects.js           # File-based CMS loader
│   └── canvas/
│       └── background.js     # Reaction-diffusion background
│
├── assets/
│   ├── projects/             # Project folders (file-based CMS)
│   │   ├── 01-terna-vr/
│   │   │   ├── info.txt      # #Title + description
│   │   │   ├── 01-media.jpg  # Numbered media files
│   │   │   ├── 02-media.mp4
│   │   │   └── ...
│   │   │
│   │   ├── 02-eni-agri/
│   │   │   └── ...
│   │   │
│   │   └── 03-chora/
│   │       └── ...
│   │
│   └── reel/                 # Reel media (numbered files)
│       ├── 01-video.mp4
│       ├── 02-still.jpg
│       └── ...
│
└── README.md                 # Documentation

```

## File Naming Conventions

### Project Folders
- Format: `XX-project-name/` (e.g., `01-terna-vr/`)
- Number prefix determines display order
- Use lowercase and hyphens

### Media Files
- Format: `XX-filename.ext` (e.g., `01-hero.jpg`)
- Number prefix determines order within gallery
- Supported: `.jpg`, `.jpeg`, `.png`, `.gif`, `.mp4`, `.webm`

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
   - Add numbered media files
   - Add section in `index.html` with `data-project-folder="04-new-project"`

2. **New Reel Media**:
   - Add numbered files to `assets/reel/`
   - Automatically loads on page refresh

## How It Works

The site uses a file-based CMS approach:
- `projects.js` reads directory contents at runtime
- Parses `info.txt` for project metadata
- Populates galleries with media files in order
- Implements autoscroll behavior (desktop) and swipe (mobile)

No build step required - just add files and reload.
