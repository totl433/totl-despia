#!/bin/bash
# Push GW38 season-end banner fix to GitHub (run from your Mac Terminal / Cursor terminal).
set -euo pipefail
cd "$(dirname "$0")/.."
unset GIT_HTTP_PROXY GIT_HTTPS_PROXY http_proxy https_proxy HTTP_PROXY HTTPS_PROXY

echo "Pushing main..."
git push origin main

echo "Pushing Staging..."
git checkout Staging
git pull --rebase origin Staging
git push origin Staging

echo "Pushing despia..."
git checkout despia
git pull --rebase origin despia
git push origin despia

git checkout main
echo "Done. Netlify should auto-deploy shortly."
