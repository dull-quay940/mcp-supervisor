#!/bin/bash
#
# MCP Supervisor Helper Script
# Provides easy CLI access to the MCP Supervisor API
#

SUPERVISOR_URL="http://localhost:3001"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper function to run an agent
run_agent() {
    local agent_id=$1
    shift
    local params="$@"
    
    echo -e "${BLUE}Running agent: ${agent_id}${NC}"
    
    local response=$(curl -s -X POST ${SUPERVISOR_URL}/run-agent \
        -H "Content-Type: application/json" \
        -d "{\"agentId\":\"${agent_id}\",\"params\":${params}}")
    
    echo "$response" | jq .
    
    # Extract session ID for easy follow-up
    local session_id=$(echo "$response" | jq -r '.sessionId // empty')
    if [ ! -z "$session_id" ]; then
        echo -e "\n${GREEN}Session ID: ${session_id}${NC}"
        echo -e "Check status: ${YELLOW}./mcp-helper.sh status ${session_id}${NC}"
    fi
}

# Check agent status
check_status() {
    local session_id=$1
    echo -e "${BLUE}Checking status: ${session_id}${NC}"
    curl -s ${SUPERVISOR_URL}/agents/${session_id}/status | jq .
}

# List active agents
list_active() {
    echo -e "${BLUE}Active agents:${NC}"
    curl -s ${SUPERVISOR_URL}/agents/active | jq .
}

# Check health
check_health() {
    echo -e "${BLUE}System health:${NC}"
    curl -s ${SUPERVISOR_URL}/health | jq .
}

# List all available agents
list_agents() {
    echo -e "${BLUE}Available agents:${NC}"
    curl -s ${SUPERVISOR_URL}/registry | jq '.agents[] | {id, name, requiresAutonomy, capabilities}'
}

# View logs
view_logs() {
    local lines=${1:-50}
    echo -e "${BLUE}Recent logs (${lines} lines):${NC}"
    curl -s "${SUPERVISOR_URL}/logs/recent?lines=${lines}"
}

# Main command dispatcher
case "$1" in
    run)
        shift
        run_agent "$@"
        ;;
    status)
        check_status "$2"
        ;;
    active)
        list_active
        ;;
    health)
        check_health
        ;;
    list)
        list_agents
        ;;
    logs)
        view_logs "$2"
        ;;
    # Quick access commands for common agents
    health-check)
        echo "Running health checker..."
        run_agent "health-checker" '{"checks":["all"]}'
        ;;
    analyze-logs)
        echo "Analyzing supervisor logs..."
        run_agent "log-analyzer" '{"logPath":"/root/Zpanel/agents/mcp-supervisor/logs/actions.log","operation":"analyze"}'
        ;;
    api-call)
        if [ -z "$2" ]; then
            echo "Usage: $0 api-call <URL> [METHOD]"
            exit 1
        fi
        local url=$2
        local method=${3:-GET}
        run_agent "api-caller" "{\"url\":\"${url}\",\"method\":\"${method}\"}"
        ;;
    *)
        echo "MCP Supervisor Helper"
        echo ""
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  run <agent-id> <params>  - Run an agent with JSON params"
        echo "  status <session-id>      - Check agent status"
        echo "  active                   - List active agents"
        echo "  health                   - Check system health"
        echo "  list                     - List all available agents"
        echo "  logs [lines]             - View recent logs (default: 50)"
        echo ""
        echo "Quick Commands:"
        echo "  health-check             - Run system health check"
        echo "  analyze-logs             - Analyze supervisor logs"
        echo "  api-call <url> [method]  - Make API call (default: GET)"
        echo ""
        echo "Examples:"
        echo "  $0 health"
        echo "  $0 run example-task '{\"taskName\":\"test\",\"duration\":2000}'"
        echo "  $0 health-check"
        echo "  $0 api-call https://api.github.com/zen"
        echo "  $0 status abc-123-def-456"
        echo ""
        exit 1
        ;;
esac

