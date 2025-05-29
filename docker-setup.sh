#!/bin/bash

# No-JS AI Chat - Docker Setup Script
# This script helps you set up and run the No-JS AI Chat application using Docker

set -e

echo "🚀 No-JS AI Chat - Docker Setup"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    print_status "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

# Determine docker compose command
COMPOSE_CMD="docker compose"
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
fi

print_status "Using: $COMPOSE_CMD"

# Check if docker.env exists, if not copy from example
if [ ! -f "docker.env" ]; then
    if [ -f "docker.env.example" ]; then
        print_status "Creating docker.env from docker.env.example"
        cp docker.env.example docker.env
        print_warning "Please edit docker.env to customize your configuration"
        print_warning "Especially change the SESSION_SECRET and MongoDB passwords!"
    else
        print_error "docker.env.example not found!"
        exit 1
    fi
else
    print_status "docker.env already exists"
fi

# Function to start the application
start_app() {
    print_status "Starting No-JS AI Chat application..."

    # Pull latest images
    print_status "Pulling latest Docker images..."
    $COMPOSE_CMD pull

    # Build the application
    print_status "Building the application..."
    $COMPOSE_CMD build

    # Start the services
    print_status "Starting services..."
    $COMPOSE_CMD up -d

    # Wait for services to be healthy
    print_status "Waiting for services to be ready..."
    sleep 10

    # Check service health
    if $COMPOSE_CMD ps | grep -q "healthy"; then
        print_status "✅ Application started successfully!"
        echo ""
        print_status "🌐 Access your application at: http://localhost:3000"
        print_status "📊 Health check: http://localhost:3000/health"
        print_status "🗄️  Database admin (development): http://localhost:8081"
        echo ""
        print_status "To view logs: $COMPOSE_CMD logs -f backend"
        print_status "To stop: $COMPOSE_CMD down"
    else
        print_warning "Services may still be starting up. Check status with: $COMPOSE_CMD ps"
    fi
}

# Function to stop the application
stop_app() {
    print_status "Stopping No-JS AI Chat application..."
    $COMPOSE_CMD down
    print_status "✅ Application stopped"
}

# Function to show logs
show_logs() {
    print_status "Showing application logs (Ctrl+C to exit)..."
    $COMPOSE_CMD logs -f backend
}

# Function to restart the application
restart_app() {
    print_status "Restarting No-JS AI Chat application..."
    $COMPOSE_CMD restart
    print_status "✅ Application restarted"
}

# Function to clean up (remove containers and volumes)
clean_app() {
    print_warning "This will remove all containers and data volumes!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Cleaning up..."
        $COMPOSE_CMD down -v --remove-orphans
        docker system prune -f
        print_status "✅ Cleanup completed"
    else
        print_status "Cleanup cancelled"
    fi
}

# Function to show help
show_help() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start     Start the application (default)"
    echo "  stop      Stop the application"
    echo "  restart   Restart the application"
    echo "  logs      Show application logs"
    echo "  status    Show service status"
    echo "  clean     Remove all containers and volumes"
    echo "  dev       Start with development profile (includes MongoDB Express)"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start    # Start the application"
    echo "  $0 logs     # View logs"
    echo "  $0 clean    # Clean up everything"
}

# Parse command line arguments
case "${1:-start}" in
    start)
        start_app
        ;;
    stop)
        stop_app
        ;;
    restart)
        restart_app
        ;;
    logs)
        show_logs
        ;;
    status)
        print_status "Service status:"
        $COMPOSE_CMD ps
        ;;
    dev)
        print_status "Starting with development profile (includes database admin)..."
        $COMPOSE_CMD --profile dev up -d
        print_status "✅ Development environment started!"
        print_status "🗄️  Database admin: http://localhost:8081"
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