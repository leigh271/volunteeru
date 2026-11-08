#!/bin/bash
set -e
cd "$(dirname "$0")"
if command -v node >/dev/null 2>&1; then
  volunteeru_node="$(command -v node)"
elif [ -x "$PWD/.tools/node/bin/node" ]; then
  volunteeru_node="$PWD/.tools/node/bin/node"
else
  echo "Install Node.js 22 or newer from https://nodejs.org, then run this file again."
  read -r -p "Press Return to close." answer
  exit 1
fi
export PATH="$(dirname "$volunteeru_node"):$PATH"
if [ ! -d node_modules ]; then npm ci; fi
npm run server &
volunteeru_api_pid=$!
trap 'kill "$volunteeru_api_pid" 2>/dev/null || true' EXIT INT TERM
printf '\nOpen http://127.0.0.1:5173/?view=nonprofit&demo=herwell\nKeep this terminal open while presenting. Press Control-C to stop.\n\n'
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
