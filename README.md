# Ronin Staking Explorer

A TypeScript/JavaScript application to explore staking contracts on the Ronin blockchain. This project allows you to:

1. Check if a contract exists and retrieve basic information
2. Identify which functions the contract supports
3. Call contract functions and view results

All built with pure TypeScript/JavaScript - no Web3.js or Ethers.js dependencies required on the frontend!

## Features

- Built with TypeScript for type safety
- Server-side contract interaction with the Ronin blockchain
- Automatic detection of working contract functions
- User-friendly UI to explore contract capabilities
- Custom function calling interface

## Quick Start

### Option 1: Run the Contract Check Script

This is the simplest option that doesn't require running a web server:

```bash
# Install dependencies
npm install

# Run the contract checker script
npm run check
```

This script will:
1. Find a working Ronin RPC endpoint
2. Check your contract's basic information
3. Try calling common functions to see what works
4. Show a summary of working methods

### Option 2: Run the Web Application

To run the full web application with an interactive UI:

```bash
# Install dependencies
npm install

# Build the TypeScript code
npm run build

# Start the server
npm start
```

Then open your browser to [http://localhost:3000](http://localhost:3000)

## How It Works

### Backend (TypeScript)

The application uses a TypeScript/Node.js backend that:

1. Tries multiple Ronin RPC endpoints to find one that works
2. Makes direct JSON-RPC calls to the blockchain
3. Handles function signature calculations and parameter encoding
4. Provides a REST API for the frontend to consume

### Frontend (JavaScript)

The web interface provides a user-friendly way to:

1. See basic information about the contract
2. View which functions are available on the contract
3. Call custom functions with parameters
4. See the results in a readable format

## Contract Analysis

When analyzing the contract at `0xfB597d6Fa6C08f5434e6eCf69114497343aE13Dd`, the application will:

1. Try many common function signatures to see what the contract supports
2. Decode function results when possible
3. Show you exactly what functions you can use to interact with the contract

## Troubleshooting

If you encounter connection issues:

1. Network Connection: Ensure you have internet access
2. Firewall/Corporate Network: Some networks block blockchain connections
3. RPC Endpoints: The application tries multiple Ronin RPC endpoints, but you can add more in the configuration if needed

## Technical Details

This project uses:

- **TypeScript**: For type safety and better code organization
- **Express**: For the web server
- **Axios**: For HTTP requests to the Ronin blockchain
- **ethers.js**: For utility functions (mainly used server-side)

## License

MIT
