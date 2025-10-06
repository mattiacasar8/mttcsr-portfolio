#!/usr/bin/env bash

# Convert images in assets/projects to .webp (max height 1080)
# and videos in assets/projects to VP9 .webm (max height 1080).
#
# Requirements: ffmpeg >= 4.1
# Usage: ./scripts/convert_media.sh [--dry-run] [--archive]

set -euo pipefail
IFS=$'\n\t'

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECTS_DIR="$ROOT_DIR/assets/projects"
DRY_RUN="false"
ARCHIVE="false"

# Parse flags
for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN="true"
      ;;
    --archive)
      ARCHIVE="true"
      ;;
    *)
      ;;
  esac
done

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Error: ffmpeg not found. Please install ffmpeg first." >&2
  exit 1
fi

shopt -s nocaseglob nullglob

IMAGE_EXTS=(jpg jpeg png)
# Treat only common source video formats (GIF considered video)
VIDEO_EXTS=(mp4 mov avi mkv m4v webm gif)

log() { echo "[convert] $*"; }

relpath() {
  # $1 absolute path -> relative to ROOT_DIR if possible
  case "$1" in
    "$ROOT_DIR"/*) printf '%s' "${1#"$ROOT_DIR/"}" ;;
    *) printf '%s' "$1" ;;
  esac
}

is_newer_or_missing() {
  # $1 input, $2 output
  [[ ! -f "$2" ]] && return 0
  [[ "$1" -nt "$2" ]] && return 0
  return 1
}

move_if_converted() {
  # $1 input, $2 output
  local input="$1"
  local output="$2"
  local old_dir
  old_dir="$(dirname "$input")/_old"
  if [[ -f "$output" && -f "$input" ]]; then
    mkdir -p "$old_dir"
    mv -f "$input" "$old_dir/"
    log "moved original -> ${old_dir#"$ROOT_DIR/"}/$(basename "$input")"
  fi
}

process_image() {
  local input="$1"
  local output="${input%.*}.webp"
  local old_dir="$(dirname "$input")/_old"
  local ext
  ext=$(printf '%s' "${input##*.}" | tr '[:upper:]' '[:lower:]')
  if ! is_newer_or_missing "$input" "$output"; then
    log "skip up-to-date image => webp: ${output#"$ROOT_DIR/"}"
    return
  fi
  log "image => webp: $(relpath "$input") -> $(relpath "$output")"
  if [[ "$DRY_RUN" == "true" ]]; then
    return
  fi
  # Static image to webp
  ffmpeg -y -nostdin -v error \
    -i "$input" \
    -vf "scale=-2:1080:force_original_aspect_ratio=decrease" \
    -c:v libwebp -lossless 0 -q:v 80 \
    "$output"

  # Move original to _old after successful conversion
  if [[ "$ARCHIVE" == "true" ]]; then
    mkdir -p "$old_dir"
    mv -f "$input" "$old_dir/"
  fi
}

process_video() {
  local input="$1"
  local output="${input%.*}.webm"
  local old_dir="$(dirname "$input")/_old"
  if ! is_newer_or_missing "$input" "$output"; then
    log "skip up-to-date video => webm: ${output#"$ROOT_DIR/"}"
    return
  fi
  log "video => webm: $(relpath "$input") -> $(relpath "$output")"
  if [[ "$DRY_RUN" == "true" ]]; then
    return
  fi
  # Video to VP9 webm, cap height 1080
  ffmpeg -y -nostdin -v error \
    -i "$input" -an \
    -vf "scale=-2:1080:force_original_aspect_ratio=decrease" \
    -c:v libvpx-vp9 -b:v 0 -crf 32 -pix_fmt yuv420p \
    -row-mt 1 -deadline good -cpu-used 4 \
    "$output"

  # Move original to _old after successful conversion
  if [[ "$ARCHIVE" == "true" ]]; then
    mkdir -p "$old_dir"
    mv -f "$input" "$old_dir/"
  fi
}

convert_all() {
  local path
  find "$PROJECTS_DIR" -type d -name "_old" -prune -o -type f -print0 | while IFS= read -r -d '' path; do
    # Decide by extension (portable to macOS)
    local filename="${path##*/}"
    local ext="${filename##*.}"
    local lower_ext
    lower_ext=$(printf '%s' "$ext" | tr '[:upper:]' '[:lower:]')
    local is_image="false"
    local is_video="false"
    for e in "${IMAGE_EXTS[@]}"; do [[ "$lower_ext" == "$e" ]] && is_image="true"; done
    for e in "${VIDEO_EXTS[@]}"; do [[ "$lower_ext" == "$e" ]] && is_video="true"; done

    # Skip already generated outputs for images (.webp) and videos (.webm) only
    # We still allow .webm inputs that are source videos (from user)
    if [[ "$is_image" == "false" && "$is_video" == "false" ]]; then
      continue
    fi

    if [[ "$is_image" == "true" ]]; then
      process_image "$path"
    elif [[ "$is_video" == "true" ]]; then
      process_video "$path"
    fi
  done
}

convert_all
log "done"


