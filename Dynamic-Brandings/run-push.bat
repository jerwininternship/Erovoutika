@echo off
set DATABASE_URL=postgresql://postgres.rsgmsdgydwbqyxzyasdf:xmaKBdb9q6vyTjMP@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
set NODE_TLS_REJECT_UNAUTHORIZED=0
npx drizzle-kit push --force
