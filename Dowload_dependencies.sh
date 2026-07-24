#!/bin/bash

set -e
set -o pipefail

trap 'echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${RED}❌ Setup failed at line $LINENO!${NC}"; echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; exit 1' ERR

# ============ COLORS ============
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly CYAN='\033[0;36m'
readonly WHITE='\033[1;37m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

# ============ CONFIG ============
readonly POSTGRES_VERSION=15

# ============ STATE ============
INSTALL_PG=false
DB_NAME=""
DB_USER=""
DB_PASS=""

# ============ FUNCTIONS ============

print_banner() {
    clear
    echo -e "${YELLOW}"
    echo "╔══════════════════════════════════════════════════════╗"
    echo "║                                                      ║"
    echo "║   🐝  HoneyORM Project Setup                         ║"
    echo "║                                                      ║"
    echo "╚══════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${WHITE}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# ============ MAIN ============

main() {
    print_banner

    # ---------- PostgreSQL ----------
    echo -e "${YELLOW}Install PostgreSQL? (y/n)${NC}"
    read -r install_pg

    if [ "$install_pg" = "y" ] || [ "$install_pg" = "Y" ]; then
        INSTALL_PG=true
        
        if ! command -v psql &> /dev/null; then
            print_info "Installing PostgreSQL..."
            sudo apt update -qq
            sudo apt install postgresql postgresql-contrib -y
            
            sudo systemctl start postgresql
            sudo systemctl enable postgresql
            
            print_success "PostgreSQL installed"
        else
            print_success "PostgreSQL already installed"
        fi

        echo -e "${YELLOW}Create database and user? (y/n)${NC}"
        read -r create_db

        if [ "$create_db" = "y" ] || [ "$create_db" = "Y" ]; then
            echo -e "${YELLOW}Database name:${NC}"
            read -r DB_NAME
            
            echo -e "${YELLOW}Username:${NC}"
            read -r DB_USER
            
            echo -e "${YELLOW}Password:${NC}"
            read -r -s DB_PASS
            echo ""

            sudo -u postgres psql <<EOF
CREATE DATABASE $DB_NAME;
CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
EOF

            cat > backend/.env <<EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
EOF
            chmod 600 backend/.env
            print_success "Database created and .env configured"
        fi
    else
        print_info "Skipping PostgreSQL. Using SQLite."
        
        cat > backend/.env <<EOF
DB_TYPE=sqlite
DB_PATH=./db.sqlite
EOF
        print_success "Configured for SQLite"
    fi

    # ---------- Dependencies ----------
    print_section "Installing Dependencies"

    cd frontend
    npm install
    print_success "Frontend dependencies installed"
    cd ..

    cd backend
    npm install
    print_success "Backend dependencies installed"
    cd ..

    # ---------- Done ----------
    echo ""
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}  Setup Complete!${NC}"
    echo -e "${GREEN}================================${NC}"
    echo ""
    
    if [ "$INSTALL_PG" = true ]; then
        echo -e "Database: ${GREEN}PostgreSQL${NC} — ${DB_NAME}"
    else
        echo -e "Database: ${GREEN}SQLite${NC} — backend/db.sqlite"
    fi
    
    echo ""
    echo -e "Start backend:  ${YELLOW}cd backend && node server.js${NC}"
    echo -e "Start frontend: ${YELLOW}cd frontend && npm run dev${NC}"
    echo ""
}

main