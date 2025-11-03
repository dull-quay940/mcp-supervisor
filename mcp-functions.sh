#!/bin/bash
#
# MCP Supervisor Functions
# Source this file to get convenient shell functions
# Usage: source mcp-functions.sh
#

MCP_URL="http://localhost:3001"

# Run an agent and return session ID
mcp_run() {
    local agent_id=$1
    local params=$2
    
    local response=$(curl -s -X POST ${MCP_URL}/run-agent \
        -H "Content-Type: application/json" \
        -d "{\"agentId\":\"${agent_id}\",\"params\":${params}}")
    
    echo "$response" | jq -r '.sessionId // empty'
}

# Wait for agent to complete and return result
mcp_run_wait() {
    local agent_id=$1
    local params=$2
    local max_wait=${3:-60}  # Default 60 seconds
    
    local session_id=$(mcp_run "$agent_id" "$params")
    
    if [ -z "$session_id" ]; then
        echo "Error: Failed to start agent" >&2
        return 1
    fi
    
    echo "Started agent: $session_id" >&2
    
    local elapsed=0
    while [ $elapsed -lt $max_wait ]; do
        local status=$(curl -s ${MCP_URL}/agents/${session_id}/status | jq -r '.state')
        
        if [ "$status" == "completed" ]; then
            curl -s ${MCP_URL}/agents/${session_id}/status | jq '.result'
            return 0
        elif [ "$status" == "failed" ] || [ "$status" == "error" ]; then
            echo "Error: Agent failed" >&2
            curl -s ${MCP_URL}/agents/${session_id}/status | jq '.error' >&2
            return 1
        fi
        
        sleep 1
        elapsed=$((elapsed + 1))
    done
    
    echo "Error: Timeout waiting for agent" >&2
    return 1
}

# Quick health check
mcp_health() {
    curl -s ${MCP_URL}/health | jq .
}

# System health check
mcp_check_system() {
    mcp_run_wait "health-checker" '{"checks":["all"]}'
}

# Make API call
mcp_api_call() {
    local url=$1
    local method=${2:-GET}
    mcp_run_wait "api-caller" "{\"url\":\"${url}\",\"method\":\"${method}\"}" 30
}

# Analyze logs
mcp_analyze_logs() {
    local log_path=${1:-"/root/Zpanel/agents/mcp-supervisor/logs/actions.log"}
    local operation=${2:-"analyze"}
    mcp_run_wait "log-analyzer" "{\"logPath\":\"${log_path}\",\"operation\":\"${operation}\"}" 30
}

# File operations
mcp_copy_file() {
    local source=$1
    local destination=$2
    mcp_run_wait "file-processor" "{\"operation\":\"copy\",\"source\":\"${source}\",\"destination\":\"${destination}\"}" 30
}

mcp_organize_files() {
    local directory=$1
    local organize_by=${2:-"extension"}
    mcp_run_wait "file-processor" "{\"operation\":\"organize\",\"directory\":\"${directory}\",\"organizeBy\":\"${organize_by}\"}" 30
}

# Data transformation
mcp_transform_data() {
    local input_path=$1
    local output_path=$2
    local input_format=$3
    local output_format=$4
    mcp_run_wait "data-transformer" "{\"inputPath\":\"${input_path}\",\"outputPath\":\"${output_path}\",\"inputFormat\":\"${input_format}\",\"outputFormat\":\"${output_format}\"}" 30
}

# Backup operations
mcp_create_backup() {
    local source_path=$1
    local backup_dir=$2
    local compress=${3:-true}
    mcp_run_wait "backup-manager" "{\"operation\":\"create\",\"sourcePath\":\"${source_path}\",\"backupDir\":\"${backup_dir}\",\"compress\":${compress}}" 60
}

mcp_list_backups() {
    local backup_dir=$1
    mcp_run_wait "backup-manager" "{\"operation\":\"list\",\"backupDir\":\"${backup_dir}\"}" 30
}

# List active agents
mcp_active() {
    curl -s ${MCP_URL}/agents/active | jq '.agents[] | {agentId, state, runtime}'
}

# View logs
mcp_logs() {
    local lines=${1:-50}
    curl -s "${MCP_URL}/logs/recent?lines=${lines}"
}

# Get agent status
mcp_status() {
    local session_id=$1
    curl -s ${MCP_URL}/agents/${session_id}/status | jq .
}

echo "MCP Supervisor functions loaded!"
echo "Available functions:"
echo "  mcp_health               - Check supervisor health"
echo "  mcp_check_system         - Run system health check"
echo "  mcp_api_call <url>       - Make HTTP request"
echo "  mcp_analyze_logs [path]  - Analyze log files"
echo "  mcp_copy_file <src> <dst> - Copy file"
echo "  mcp_organize_files <dir> - Organize files"
echo "  mcp_transform_data <in> <out> <from> <to> - Convert data"
echo "  mcp_create_backup <src> <dir> - Create backup"
echo "  mcp_active               - List active agents"
echo "  mcp_logs [lines]         - View recent logs"
echo "  mcp_status <session>     - Get agent status"

