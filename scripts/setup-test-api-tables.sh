#!/bin/bash

# Script to help set up Test API tables in Supabase

echo "🔧 Test API Tables Setup Helper"
echo "================================"
echo ""
echo "This script will help you create the Test API tables in Supabase."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please make sure you're in the project root."
    exit 1
fi

# Extract Supabase URL from .env
SUPABASE_URL=$(grep VITE_SUPABASE_URL .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")

if [ -z "$SUPABASE_URL" ]; then
    echo "❌ Could not find VITE_SUPABASE_URL in .env"
    exit 1
fi

# Extract project ref from URL (format: https://xxxxx.supabase.co)
PROJECT_REF=$(echo $SUPABASE_URL | sed -E 's|https://([^.]+)\.supabase\.co.*|\1|')

if [ -z "$PROJECT_REF" ]; then
    echo "⚠️  Could not extract project ref from URL"
    PROJECT_REF="your-project-ref"
fi

echo "📋 Supabase Project: $PROJECT_REF"
echo ""
echo "To create the tables:"
echo ""
echo "Option 1: Use Supabase Dashboard (Recommended)"
echo "-----------------------------------------------"
echo "1. Open: https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
echo "2. Copy the SQL from: supabase/sql/create_test_api_tables.sql"
echo "3. Paste and click 'Run'"
echo ""
echo "Option 2: Copy SQL directly"
echo "---------------------------"
echo "The SQL file is located at: supabase/sql/create_test_api_tables.sql"
echo ""
echo "Press Enter to open the SQL file..."
read

# Try to open the SQL file
if command -v open &> /dev/null; then
    open supabase/sql/create_test_api_tables.sql
elif command -v xdg-open &> /dev/null; then
    xdg-open supabase/sql/create_test_api_tables.sql
else
    echo "Showing SQL file contents:"
    echo ""
    cat supabase/sql/create_test_api_tables.sql
fi

echo ""
echo "After running the SQL, verify with:"
echo "  node scripts/check-test-api-gw.mjs"

