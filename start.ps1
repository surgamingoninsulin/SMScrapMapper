# PowerShell script to start the local server
Write-Host "Checking for Node.js..." -ForegroundColor Cyan

# Check if Node.js is installed
try {
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Node.js not found"
    }
    Write-Host "Node.js is installed! Version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Node.js is not installed!" -ForegroundColor Red
    Write-Host "Opening Node.js download page..." -ForegroundColor Yellow
    Start-Process "https://www.nodejs.org"
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Check for package.json
if (-not (Test-Path "package.json")) {
    Write-Host "Creating package.json..." -ForegroundColor Yellow
    $packageJson = @{
        name = "sm-overview-map"
        version = "1.0.0"
        description = "Scrap Mechanic Overview Map"
        main = "index.js"
        scripts = @{
            start = "node index.js"
        }
        dependencies = @{
            express = "^4.18.2"
        }
    } | ConvertTo-Json -Depth 10
    
    $packageJson | Out-File -FilePath "package.json" -Encoding UTF8
    Write-Host "package.json created!" -ForegroundColor Green
}

Write-Host ""

# Check for node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install dependencies!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
} else {
    Write-Host "Dependencies already installed." -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting server..." -ForegroundColor Cyan
Write-Host "Server will be available at http://localhost:8080" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

node index.js

