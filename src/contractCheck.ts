import axios from 'axios';
import { ethers } from 'ethers';

// Configuration
const CONTRACT_ADDRESS = '0xfB597d6Fa6C08f5434e6eCf69114497343aE13Dd';
const RPC_URLS = [
    'https://api.roninchain.com/rpc',
    'https://api.roninchain.com/eth',
    'https://api-gateway.skymavis.com/rpc'
];

// Interface for method result
interface MethodResult {
    name: string;
    success: boolean;
    result?: string;
    error?: string;
}

// Interface for contract info
interface ContractInfo {
    address: string;
    isContract: boolean;
    bytecodeSize: number;
    balance: number;
    transactionCount: number;
}

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
    for (const url of RPC_URLS) {
        try {
            console.log(`Testing RPC endpoint: ${url}`);
            const blockNumber = await callRPC(url, 'eth_blockNumber', []);
            console.log(`Success! Current block number: ${parseInt(blockNumber, 16)}`);
            return url;
        } catch (error) {
            console.log(`Failed to connect to ${url}: ${(error as Error).message}`);
        }
    }
    throw new Error('Could not connect to any Ronin RPC endpoint');
}

/**
 * Check if address is a contract
 */
async function isContract(rpcUrl: string, address: string): Promise<boolean> {
    const code = await callRPC(rpcUrl, 'eth_getCode', [address, 'latest']);
    return code !== '0x';
}

/**
 * Get basic contract information
 */
async function getContractInfo(rpcUrl: string, address: string): Promise<ContractInfo> {
    // Get bytecode
    const code = await callRPC(rpcUrl, 'eth_getCode', [address, 'latest']);
    
    // Get balance
    const balance = await callRPC(rpcUrl, 'eth_getBalance', [address, 'latest']);
    const balanceInEth = parseInt(balance, 16) / 1e18;
    
    // Get transaction count
    const txCount = await callRPC(rpcUrl, 'eth_getTransactionCount', [address, 'latest']);
    
    return {
        address,
        isContract: code !== '0x',
        bytecodeSize: (code.length - 2) / 2,
        balance: balanceInEth,
        transactionCount: parseInt(txCount, 16)
    };
}

/**
 * Try calling a contract method
 */
async function tryContractMethod(rpcUrl: string, address: string, methodName: string, selector: string): Promise<MethodResult> {
    try {
        const result = await callRPC(rpcUrl, 'eth_call', [{
            to: address,
            data: selector
        }, 'latest']);
        
        return {
            name: methodName,
            success: true,
            result
        };
    } catch (error) {
        return {
            name: methodName,
            success: false,
            error: (error as Error).message
        };
    }
}

/**
 * Try to decode the result based on common return types
 */
function tryDecodeResult(result: string): string {
    if (!result || result === '0x') return 'Empty result';
    
    try {
        // Try to decode as uint256
        if (result.length === 66) {
            const decoded = ethers.BigNumber.from(result);
            return `Number: ${decoded.toString()}`;
        }
        
        // Try to decode as address
        if (result.length === 66 && result.substring(0, 26) === '0x000000000000000000000000') {
            const address = '0x' + result.substring(26);
            return `Address: ${address}`;
        }
        
        // Try to decode as string (more complex, simplified here)
        return `Hex: ${result}`;
    } catch (error) {
        return `Raw: ${result}`;
    }
}

/**
 * Main function
 */
async function main() {
    try {
        console.log('=== Ronin Contract Explorer ===');
        console.log(`Checking contract: ${CONTRACT_ADDRESS}`);
        
        // Find a working RPC URL
        const rpcUrl = await findWorkingRpcUrl();
        console.log(`Using RPC endpoint: ${rpcUrl}`);
        
        // Check if address is a contract
        const contractCheck = await isContract(rpcUrl, CONTRACT_ADDRESS);
        if (!contractCheck) {
            console.log(`ERROR: ${CONTRACT_ADDRESS} is not a contract`);
            return;
        }
        
        // Get basic contract info
        console.log('\n=== Basic Contract Info ===');
        const info = await getContractInfo(rpcUrl, CONTRACT_ADDRESS);
        console.log(`Contract: ${info.address}`);
        console.log(`Bytecode Size: ${info.bytecodeSize} bytes`);
        console.log(`Balance: ${info.balance} RON`);
        console.log(`Transaction Count: ${info.transactionCount}`);

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
            'getStakedTokens(address)': '0x171e631c',
            
            // Custom function selectors - you can add more here
            'totalStaked()': '0x817b1cd2',
            'getStakingInfo()': '0x8f0cb5de',
            'stakingEnabled()': '0x0cefb5de',
            'getStakingBalance(address)': '0x14afd79e'
        };
        
        // Try calling common methods
        console.log('\n=== Testing Contract Methods ===');
        const results: MethodResult[] = [];
        
        for (const [methodName, selector] of Object.entries(FUNCTION_SELECTORS)) {
            console.log(`Trying ${methodName}...`);
            const result = await tryContractMethod(rpcUrl, CONTRACT_ADDRESS, methodName, selector);
            results.push(result);
            
            if (result.success) {
                const decoded = tryDecodeResult(result.result!);
                console.log(`✅ Success: ${decoded}`);
            } else {
                console.log(`❌ Failed: ${result.error}`);
            }
        }
        
        // Show summary of working methods
        console.log('\n=== Summary of Working Methods ===');
        const workingMethods = results.filter(r => r.success);
        
        if (workingMethods.length === 0) {
            console.log('No working methods found.');
        } else {
            workingMethods.forEach(method => {
                const decoded = tryDecodeResult(method.result!);
                console.log(`${method.name} - ${decoded}`);
            });
        }
        
    } catch (error) {
        console.error(`ERROR: ${(error as Error).message}`);
    }
}

// Run the main function
main();
