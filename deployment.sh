#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-default}"
APP_LABEL="${APP_LABEL:-nodered}"
DEPLOYMENT_NAME="${DEPLOYMENT_NAME:-nodered}"

# Récupérer le pod courant
get_pod() {
  kubectl get pods -n "$NAMESPACE" -l "app=${APP_LABEL}" \
    -o jsonpath='{.items[0].metadata.name}'
}

echo "🔎 Looking for Node-RED pod in namespace '$NAMESPACE'..."
POD_NAME="$(get_pod || true)"
if [[ -z "${POD_NAME:-}" ]]; then
  echo "❌ No Node-RED pod found (label app=${APP_LABEL})"
  exit 1
fi
echo "➡️  Using pod: $POD_NAME"

echo "🔨 Building project..."
npm run build

echo "📦 Creating package..."
npm pack
PACKAGE_FILE="$(ls -t node-red-contrib-ts-*.tgz | head -n 1)"
if [[ -z "${PACKAGE_FILE:-}" ]]; then
  echo "❌ No package file found"
  exit 1
fi
echo "📤 Uploading $PACKAGE_FILE to pod..."
kubectl cp "$PACKAGE_FILE" "$NAMESPACE/$POD_NAME:/data/"

echo "🔄 Installing package in Node-RED userDir (/data)..."
kubectl exec -n "$NAMESPACE" "$POD_NAME" -- npm install "/data/$PACKAGE_FILE" --prefix /data --save

echo "🧹 Cleaning up remote package..."
kubectl exec -n "$NAMESPACE" "$POD_NAME" -- rm -f "/data/$PACKAGE_FILE"

echo "♻️  Restarting Deployment '$DEPLOYMENT_NAME'..."
kubectl rollout restart deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE"

echo "⏳ Waiting for rollout to complete..."
kubectl rollout status deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" --timeout=120s

# Re-récupérer le nouveau pod (nom change après rollout)
POD_NAME="$(get_pod)"
echo "✅ New pod ready: $POD_NAME"

echo "🔎 Checking that the node is installed..."
kubectl exec -n "$NAMESPACE" "$POD_NAME" -- npm list --prefix /data node-red-contrib-ts || true

echo "✅ Test deployment completed!"
