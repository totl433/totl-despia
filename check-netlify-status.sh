#!/bin/bash

# Script to check Netlify build status and recent deployments
# Usage: ./check-netlify-status.sh

echo "=== Netlify Build Status Checker ==="
echo ""
echo "1. Check Netlify Dashboard:"
echo "   https://app.netlify.com/sites/YOUR_SITE_NAME/deploys"
echo ""
echo "2. Check GitHub repository:"
echo "   https://github.com/sotbjof/totl-web"
echo ""
echo "3. Check for branch protection rules:"
echo "   https://github.com/sotbjof/totl-web/settings/branches"
echo ""
echo "4. Verify latest commits are pushed:"
echo ""

cd "$(dirname "$0")"
git log --oneline -5

echo ""
echo "5. Check if Netlify is connected to the correct repo:"
echo "   - Go to Netlify Dashboard → Site Settings → Build & deploy"
echo "   - Verify: Repository = sotbjof/totl-web"
echo "   - Verify: Branch = staging"
echo "   - Verify: Publish directory = dist"
echo ""
echo "6. Common issues to check:"
echo "   - Build command failing (check build logs)"
echo "   - Missing environment variables"
echo "   - TypeScript compilation errors"
echo "   - Function deployment errors"
echo "   - Build timeout (> 15 minutes)"
echo ""
echo "7. To manually trigger a deploy:"
echo "   - Netlify Dashboard → Deploys → Trigger deploy"
echo "   - Or: netlify deploy --prod (after linking)"
echo ""

