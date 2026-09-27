#!/bin/bash
# Avvia il Content Tool di mttcsr.com (doppio clic su Mac, oppure ./start-tool.sh)
cd "$(dirname "$0")" || exit 1

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm non trovato. Installalo con: npm install -g pnpm"
  exit 1
fi

echo "Controllo dipendenze..."
pnpm install --silent || exit 1

PORT="${CONTENT_TOOL_PORT:-3030}"
(sleep 1.5 && open "http://localhost:${PORT}/tool.html") &

echo "Premi CTRL+C per chiudere il tool."
pnpm content-tool
