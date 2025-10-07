#!/bin/bash

# WebSocket MCP Proxy Server Setup Script

echo "🚀 Setting up WebSocket MCP Proxy Server..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create a simple test configuration if config.yaml doesn't exist
if [ ! -f "config.yaml" ]; then
    echo "📝 Creating default configuration..."
    cp examples/simple-config.yaml config.yaml
    echo "✅ Created config.yaml from simple example"
    echo "💡 Edit config.yaml to customize your MCP servers"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "To start the server:"
echo "  npm start"
echo ""
echo "To start in development mode:"
echo "  npm run dev"
echo ""
echo "To test the client:"
echo "  node examples/client-example.js"
echo ""
echo "📖 See README.md for detailed documentation"
