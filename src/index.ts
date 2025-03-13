import express from 'express';
import cors from 'cors';
import path from 'path';
import { ethers } from 'ethers';
import axios from 'axios';

// Setup Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Configuration
const CONTRACT_ADDRESS = '0xfB597d6Fa6C08f5434e6eCf69114497343aE13Dd';
const RPC_URLS = [
    'https://api.roninchain.com/rpc',
    'https://api.roninchain.com/eth',
    'https://api-gateway.skymavis.com/rpc'
];

// Store the working RPC URL
let workingRpcUrl: string | null = null;

/**
 * Make a JSON-RPC call to the blockchain
 */
async function callRPC(rpcUrl: string, method: string, params: any[]): Promise<any> {
    try {
        const response = await axios.post(rpcUrl, {
            jsonrpc: '2.0',
            id: Date.now(),
            method,
            params
        });
        
        if (response.data.error) {
            throw new Error(`RPC Error: ${response.data.error.message || JSON.stringify(response.data.error)}`);
        }
        
        return response.data.result;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(`HTTP Error: ${error.response.status} - ${error.response.statusText}`);
        }
        throw error;
    }
}

/**
 * Find a working RPC URL from the list
 */
async function findWorkingRpcUrl(): Promise<string> {
    // If we already have a working URL, use it
    if (workingRpcUrl) {
        try {
            await callRPC(workingRpcUrl, 'eth_blockNumber', []);
            return workingRpcUrl;
        } catch (error) {
            console.log(`Previously working RPC URL ${workingRpcUrl} is no longer working`);
            workingRpcUrl = null;
        }
    }

    // Try each URL in the list
    for (const url of RPC_URLS) {
        try {
            console.log(`Testing RPC endpoint: ${url}`);
            const blockNumber = await callRPC(url, 'eth_blockNumber', []);
            console.log(`Success! Current block number: ${parseInt(blockNumber, 16)}`);
            workingRpcUrl = url;
            return url;
        } catch (error) {
            console.log(`Failed to connect to ${url}: ${(error as Error).message}`);
        }
    }
    throw new Error('Could not connect to any Ronin RPC endpoint');
}

// Define routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/contract/info', async (req, res) => {
    try {
        const rpcUrl = await findWorkingRpcUrl();
        
        // Get bytecode
        const code = await callRPC(rpcUrl, 'eth_getCode', [CONTRACT_ADDRESS, 'latest']);
        
        // Get balance
        const balance = await callRPC(rpcUrl, 'eth_getBalance', [CONTRACT_ADDRESS, 'latest']);
        const balanceInEth = parseInt(balance, 16) / 1e18;
        
        // Get transaction count
        const txCount = await callRPC(rpcUrl, 'eth_getTransactionCount', [CONTRACT_ADDRESS, 'latest']);
        
        res.json({
            address: CONTRACT_ADDRESS,
            isContract: code !== '0x',
            bytecodeSize: (code.length - 2) / 2,
            balance: balanceInEth,
            transactionCount: parseInt(txCount, 16)
        });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/contract/methods', async (req, res) => {
    try {
        const rpcUrl = await findWorkingRpcUrl();
        
        // Define common function selectors
        const FUNCTION_SELECTORS: Record<string, string> = {
            // Token standard functions
            'name()': '0x06fdde03',
            'symbol()': '0x95d89b41',
            'totalSupply()': '0x18160ddd',
            'decimals()': '0x313ce567',
            
            // Owner/admin functions
            'owner()': '0x8da5cb5b',
            'getOwner()': '0x893d20e8',
            'paused()': '0x5c975abb',
            
            // Staking functions
            'getTotalStakers()': '0x5ea4fa3f',
            'totalStakers()': '0x2a7401c8',
            'stakerCount()': '0x158626f7',
            'getStakers()': '0x43adbcef',
            'getAllStakers()': '0x4a393149',
            'getStakerList()': '0xf7793ad2',
            'totalStaked()': '0x817b1cd2',
            'getStakingInfo()': '0x8f0cb5de',
            'stakingEnabled()': '0x0cefb5de'
        };
        
        const results = [];
        
        for (const [methodName, selector] of Object.entries(FUNCTION_SELECTORS)) {
            try {
                const result = await callRPC(rpcUrl, 'eth_call', [{
                    to: CONTRACT_ADDRESS,
                    data: selector
                }, 'latest']);
                
                // Try to decode the result
                let decoded: any = result;
                try {
                    if (result && result !== '0x') {
                        if (result.length === 66) {
                            // Try to decode as uint256
                            decoded = ethers.BigNumber.from(result).toString();
                        } else if (result.startsWith('0x000000000000000000000000') && result.length === 66) {
                            // Try to decode as address
                            decoded = '0x' + result.substring(26);
                        }
                    }
                } catch (e) {
                    // Ignore decoding errors
                }
                
                results.push({
                    name: methodName,
                    success: true,
                    result,
                    decoded
                });
            } catch (error) {
                results.push({
                    name: methodName,
                    success: false,
                    error: (error as Error).message
                });
            }
        }
        
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/api/contract/call', async (req, res) => {
    try {
        const { method, params = [] } = req.body;
        
        if (!method) {
            return res.status(400).json({ error: 'Method is required' });
        }
        
        const rpcUrl = await findWorkingRpcUrl();
        
        // Calculate method selector
        const methodSelector = ethers.utils.id(method).substring(0, 10);
        
        // Build the call data
        let callData = methodSelector;
        
        // Add parameters to the call data (simplified)
        // This is a simplified version and doesn't handle all types of parameters
        if (params.length > 0) {
            // For address parameters
            if (method.includes('address') && params[0].startsWith('0x')) {
                callData += params[0].substring(2).padStart(64, '0');
            }
            // For uint parameters
            else if (method.includes('uint')) {
                const value = ethers.BigNumber.from(params[0]).toHexString().substring(2);
                callData += value.padStart(64, '0');
            }
        }
        
        const result = await callRPC(rpcUrl, 'eth_call', [{
            to: CONTRACT_ADDRESS,
            data: callData
        }, 'latest']);
        
        // Try to decode the result
        let decoded: any = result;
        try {
            if (result && result !== '0x') {
                if (result.length === 66) {
                    // Try to decode as uint256
                    decoded = ethers.BigNumber.from(result).toString();
                } else if (result.startsWith('0x000000000000000000000000') && result.length === 66) {
                    // Try to decode as address
                    decoded = '0x' + result.substring(26);
                }
            }
        } catch (e) {
            // Ignore decoding errors
        }
        
        res.json({
            method,
            result,
            decoded
        });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Open your browser at http://localhost:${PORT}`);
});
