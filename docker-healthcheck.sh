#!/bin/bash

# Docker Health Check Script for No-JS AI Chat
# This script performs comprehensive health checks for the application

set -euo pipefail

# Configuration
readonly HEALTH_URL="http://localhost:3000/health"
readonly MAX_RETRIES=3
readonly RETRY_DELAY=2
readonly TIMEOUT=10

# Function to check HTTP endpoint
check_http_endpoint() {
    local url="$1"
    local retries=0

    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -f -s --max-time $TIMEOUT "$url" > /dev/null 2>&1; then
            return 0
        fi
        retries=$((retries + 1))
        if [ $retries -lt $MAX_RETRIES ]; then
            sleep $RETRY_DELAY
        fi
    done

    return 1
}

# Function to check database connectivity
check_database() {
    if [ -n "${MONGODB_URI:-}" ]; then
        # Try to connect to MongoDB
        local mongo_check
        mongo_check=$(node -e "
            const { MongoClient } = require('mongodb');
            const client = new MongoClient('${MONGODB_URI}');
            client.connect()
                .then(() => client.db().admin().ping())
                .then(() => { console.log('OK'); process.exit(0); })
                .catch(() => process.exit(1))
                .finally(() => client.close());
        " 2>/dev/null)

        if [ "$mongo_check" = "OK" ]; then
            return 0
        fi
    fi

    return 1
}

# Function to check memory usage
check_memory() {
    local mem_usage
    mem_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')

    # Warning if memory usage > 90%
    if [ "$mem_usage" -gt 90 ]; then
        echo "WARNING: High memory usage: ${mem_usage}%" >&2
        return 1
    fi

    return 0
}

# Function to check disk space
check_disk() {
    local disk_usage
    disk_usage=$(df /app | tail -1 | awk '{print $5}' | sed 's/%//')

    # Warning if disk usage > 90%
    if [ "$disk_usage" -gt 90 ]; then
        echo "WARNING: High disk usage: ${disk_usage}%" >&2
        return 1
    fi

    return 0
}

# Main health check function
main() {
    local exit_code=0

    # Check HTTP endpoint
    if ! check_http_endpoint "$HEALTH_URL"; then
        echo "ERROR: Health endpoint not responding" >&2
        exit_code=1
    fi

    # Check database connectivity
    if ! check_database; then
        echo "WARNING: Database connectivity issue" >&2
        # Don't fail health check for database issues in development
        if [ "${NODE_ENV:-}" = "production" ]; then
            exit_code=1
        fi
    fi

    # Check system resources
    check_memory || true
    check_disk || true

    if [ $exit_code -eq 0 ]; then
        echo "Health check passed"
    else
        echo "Health check failed"
    fi

    exit $exit_code
}

# Run health check
main "$@"