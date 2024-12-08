#!/bin/bash

# Load environment variables
source ../.env

# Create database and enable PostGIS
psql -U postgres << EOF
CREATE DATABASE $POSTGRES_DB;
\c $POSTGRES_DB
CREATE EXTENSION IF NOT EXISTS postgis;
EOF

# Create user and grant privileges
psql -U postgres << EOF
CREATE USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE $POSTGRES_DB TO $POSTGRES_USER;
EOF

# Run schema
psql -U postgres -d $POSTGRES_DB -f ../src/db/schema.sql

echo "Database initialization complete!"
