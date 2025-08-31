#!/usr/bin/env bash
set -euo pipefail

NODE_RED_DIR="${HOME}/.node-red"
echo "➡️  Using Node-RED directory: $NODE_RED_DIR"

[[ ! -d "$NODE_RED_DIR" ]] && mkdir -p "$NODE_RED_DIR"

echo "🔨 Building project..."
npm run build

echo "📦 Creating package..."
npm pack
PACKAGE_FILE="$(ls -t node-red-contrib-ts-*.tgz | head -n 1)"
if [[ -z "${PACKAGE_FILE:-}" ]]; then
  echo "❌ No package file found"
  exit 1
fi

echo "📤 Installing $PACKAGE_FILE to local Node-RED..."
npm install "$PACKAGE_FILE" --prefix "$NODE_RED_DIR" --save

echo "🧹 Cleaning up local package..."
rm -f "$PACKAGE_FILE"

# Kill Node-RED if running
pids=$(pgrep -f "node-red" || true)
if [[ -n "$pids" ]]; then
  echo "🛑 Stopping Node-RED..."
  kill $pids || true
  sleep 2
  remaining=$(pgrep -f "node-red" || true)
  [[ -n "$remaining" ]] && kill -9 $remaining || true
fi

# Start Node-RED
echo "🚀 Starting Node-RED..."
nohup npx node-red > /dev/null 2>&1 &

# Wait for Node-RED to start
for i in {1..30}; do
  if curl -s http://localhost:1880 > /dev/null 2>&1; then
    echo "✅ Node-RED is running at http://localhost:1880"
    exit 0
  fi
  sleep 1
done

echo "⚠️  Node-RED may not have started properly"