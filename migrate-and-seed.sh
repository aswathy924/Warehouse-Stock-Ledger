#!/usr/bin/env bash
set -e

echo "=== Running Database Migrations ==="
cd backend
alembic upgrade head

echo "=== Seeding Warehouse Data ==="
python seed.py "$@"

echo "=== Migration and Seeding Complete ==="
