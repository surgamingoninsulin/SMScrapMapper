#!/bin/bash

echo "Checking for Node.js..."
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed!"
    echo "Opening Node.js download page..."
    
    # Try to open the URL based on the OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        open https://www.nodejs.org
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        xdg-open https://www.nodejs.org 2>/dev/null || sensible-browser https://www.nodejs.org 2>/dev/null || echo "Please visit https://www.nodejs.org to install Node.js"
    else
        echo "Please visit https://www.nodejs.org to install Node.js"
    fi
    
    exit 1
fi

echo "Node.js is installed!"
node --version

echo ""
echo "Checking for package.json..."
if [ ! -f "package.json" ]; then
    echo "Creating package.json..."
    cat > package.json << 'EOF'
{
  "name": "sm-overview-map",
  "version": "1.0.0",
  "description": "Scrap Mechanic Overview Map",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
EOF
    echo "package.json created!"
fi

echo ""
echo "Checking for node_modules..."
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "Failed to install dependencies!"
        exit 1
    fi
else
    echo "Dependencies already installed."
fi

echo ""
echo "Starting server..."
echo "Server will be available at http://localhost:8080"
echo "Press Ctrl+C to stop the server"
echo ""
node index.js

