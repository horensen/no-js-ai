#!/bin/bash

# No-JS AI Chat - Enhanced Docker Setup Script
# This script helps you set up and run the No-JS AI Chat application using Docker

set -euo pipefail

echo "🚀 No-JS AI Chat - Enhanced Docker Setup v2.0"
echo "=============================================="

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m' # No Color

# Script configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly DATA_DIR="${SCRIPT_DIR}/docker-data"
readonly BACKUP_DIR="${SCRIPT_DIR}/backups"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_success() {
    echo -e "${CYAN}[SUCCESS]${NC} $1"
}

print_debug() {
    echo -e "${PURPLE}[DEBUG]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        print_status "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi

    # Check if Docker is running
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi

    # Check available disk space (at least 2GB)
    local available_space
    available_space=$(df "$SCRIPT_DIR" | tail -1 | awk '{print $4}')
    if [ "$available_space" -lt 2097152 ]; then
        print_warning "Low disk space detected. Ensure you have at least 2GB available."
    fi

    # Determine docker compose command
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        COMPOSE_CMD="docker compose"
    fi

    print_success "Using: $COMPOSE_CMD"
}

# Setup environment and directories
setup_environment() {
    print_status "Setting up environment..."

    # Create data directories
    mkdir -p "$DATA_DIR"/{mongodb,mongodb-config,logs,redis}
    mkdir -p "$BACKUP_DIR"

    # Set proper permissions
    chmod -R 755 "$DATA_DIR"
    chmod -R 755 "$BACKUP_DIR"

    # Check if docker.env exists, if not copy from example
    if [ ! -f "docker.env" ]; then
        if [ -f "docker.env.example" ]; then
            print_status "Creating docker.env from docker.env.example"
            cp docker.env.example docker.env
            print_warning "Please edit docker.env to customize your configuration"
            print_warning "Especially change the SESSION_SECRET and all passwords!"
            print_warning "Generate secure passwords with: openssl rand -base64 32"
        else
            print_error "docker.env.example not found!"
            exit 1
        fi
    else
        print_success "docker.env already exists"
    fi

    # Validate critical environment variables
    if grep -q "changeme" docker.env || grep -q "your-super-secret" docker.env; then
        print_warning "Default passwords detected in docker.env"
        print_warning "Please change all default passwords before production use!"
    fi
}

# Function to start the application
start_app() {
    local profile="${1:-default}"

    print_status "Starting No-JS AI Chat application with profile: $profile"

    case "$profile" in
        "dev"|"development")
            COMPOSE_PROFILES="--profile dev"
            ;;
        "enhanced"|"production")
            COMPOSE_PROFILES="--profile enhanced"
            ;;
        *)
            COMPOSE_PROFILES=""
            ;;
    esac

    # Pull latest images
    print_status "Pulling latest Docker images..."
    $COMPOSE_CMD $COMPOSE_PROFILES pull

    # Build the application
    print_status "Building the application..."
    $COMPOSE_CMD $COMPOSE_PROFILES build --no-cache

    # Start the services
    print_status "Starting services..."
    $COMPOSE_CMD $COMPOSE_PROFILES up -d

    # Wait for services to be healthy
    print_status "Waiting for services to be ready..."
    local retries=0
    local max_retries=30

    while [ $retries -lt $max_retries ]; do
        if $COMPOSE_CMD ps | grep -q "healthy\|Up"; then
            break
        fi
        sleep 5
        ((retries++))
        echo -n "."
    done
    echo ""

    # Check service health
    print_status "Checking service status..."
    $COMPOSE_CMD ps

    if $COMPOSE_CMD ps | grep -q "healthy\|Up"; then
        print_success "✅ Application started successfully!"
        echo ""
        print_status "🌐 Access your application at: http://localhost:3000"
        print_status "📊 Health check: http://localhost:3000/health"

        if [[ "$profile" == "dev" || "$profile" == "development" ]]; then
            print_status "🗄️  Database admin (development): http://localhost:8081"
        fi

        if [[ "$profile" == "enhanced" || "$profile" == "production" ]]; then
            print_status "🔄 Redis cache enabled on port 6379"
        fi

        echo ""
        print_status "Useful commands:"
        print_status "  View logs: $0 logs"
        print_status "  Stop: $0 stop"
        print_status "  Monitor: $0 monitor"
    else
        print_warning "Some services may still be starting up"
        print_status "Check status with: $0 status"
    fi
}

# Function to stop the application
stop_app() {
    print_status "Stopping No-JS AI Chat application..."
    $COMPOSE_CMD down
    print_success "✅ Application stopped"
}

# Function to show logs
show_logs() {
    local service="${1:-backend}"
    print_status "Showing $service logs (Ctrl+C to exit)..."
    $COMPOSE_CMD logs -f "$service"
}

# Function to restart the application
restart_app() {
    print_status "Restarting No-JS AI Chat application..."
    $COMPOSE_CMD restart
    print_success "✅ Application restarted"
}

# Function to monitor services
monitor_services() {
    print_status "Monitoring services (Ctrl+C to exit)..."
    while true; do
        clear
        echo "🔍 Service Status - $(date)"
        echo "========================"
        $COMPOSE_CMD ps
        echo ""
        echo "💾 Resource Usage:"
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
        echo ""
        echo "Press Ctrl+C to exit monitoring..."
        sleep 10
    done
}

# Function to backup data
backup_data() {
    local timestamp
    timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="$BACKUP_DIR/backup_$timestamp.tar.gz"

    print_status "Creating backup..."

    # Stop services temporarily for consistent backup
    print_status "Stopping services for backup..."
    $COMPOSE_CMD stop

    # Create backup
    print_status "Creating archive..."
    tar -czf "$backup_file" -C "$DATA_DIR" .

    # Restart services
    print_status "Restarting services..."
    $COMPOSE_CMD start

    print_success "✅ Backup created: $backup_file"

    # Cleanup old backups (keep last 5)
    print_status "Cleaning up old backups..."
    find "$BACKUP_DIR" -name "backup_*.tar.gz" -type f | sort -r | tail -n +6 | xargs -r rm
}

# Function to restore data
restore_data() {
    local backup_file="$1"

    if [ -z "$backup_file" ]; then
        print_error "Please specify backup file to restore"
        print_status "Available backups:"
        ls -la "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null || print_warning "No backups found"
        return 1
    fi

    if [ ! -f "$backup_file" ]; then
        print_error "Backup file not found: $backup_file"
        return 1
    fi

    print_warning "This will replace all current data!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Restore cancelled"
        return 0
    fi

    # Stop services
    print_status "Stopping services..."
    $COMPOSE_CMD down

    # Remove current data
    print_status "Removing current data..."
    rm -rf "$DATA_DIR"/*

    # Restore from backup
    print_status "Restoring from backup..."
    tar -xzf "$backup_file" -C "$DATA_DIR"

    # Start services
    print_status "Starting services..."
    start_app

    print_success "✅ Data restored from: $backup_file"
}

# Function to clean up (remove containers and volumes)
clean_app() {
    print_warning "This will remove all containers, volumes, and data!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Cleaning up..."
        $COMPOSE_CMD down -v --remove-orphans
        docker system prune -f
        rm -rf "$DATA_DIR"
        print_success "✅ Cleanup completed"
    else
        print_status "Cleanup cancelled"
    fi
}

# Function to show help
show_help() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  start [profile]  Start the application (profiles: dev, enhanced)"
    echo "  stop            Stop the application"
    echo "  restart         Restart the application"
    echo "  logs [service]  Show application logs (default: backend)"
    echo "  status          Show service status"
    echo "  monitor         Monitor services in real-time"
    echo "  backup          Create data backup"
    echo "  restore <file>  Restore from backup"
    echo "  update          Update images and restart"
    echo "  clean           Remove all containers and volumes"
    echo "  help            Show this help message"
    echo ""
    echo "Profiles:"
    echo "  default         Basic setup (backend + mongodb)"
    echo "  dev             Development setup (+ mongo-express)"
    echo "  enhanced        Production setup (+ redis cache)"
    echo ""
    echo "Examples:"
    echo "  $0 start dev     # Start with development tools"
    echo "  $0 logs mongodb  # View MongoDB logs"
    echo "  $0 backup        # Create backup"
    echo "  $0 monitor       # Monitor services"
}

# Function to update application
update_app() {
    print_status "Updating No-JS AI Chat application..."

    # Pull latest images
    print_status "Pulling latest images..."
    $COMPOSE_CMD pull

    # Rebuild containers
    print_status "Rebuilding containers..."
    $COMPOSE_CMD build --no-cache

    # Restart with zero downtime
    print_status "Restarting services..."
    $COMPOSE_CMD up -d

    print_success "✅ Application updated"
}

# Main script logic
main() {
    # Always check prerequisites
    check_prerequisites
    setup_environment

    # Parse command line arguments
    case "${1:-start}" in
        start)
            start_app "${2:-default}"
            ;;
        dev)
            start_app "dev"
            ;;
        enhanced|production)
            start_app "enhanced"
            ;;
        stop)
            stop_app
            ;;
        restart)
            restart_app
            ;;
        logs)
            show_logs "${2:-backend}"
            ;;
        status)
            print_status "Service status:"
            $COMPOSE_CMD ps
            echo ""
            print_status "Resource usage:"
            docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
            ;;
        monitor)
            monitor_services
            ;;
        backup)
            backup_data
            ;;
        restore)
            restore_data "$2"
            ;;
        update)
            update_app
            ;;
        clean)
            clean_app
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"