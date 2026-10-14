/**
 * Su Squares Updates
 * (c) Su & William Entriken, released under MIT license
 *
 * eth_getLogs helpers.
 *
 * The configured provider rejects a call when `toBlock - fromBlock` exceeds
 * 10000 ("range N exceeds limit of 10000"). Windows below stay on that limit.
 */

import chalk from "chalk";

// Largest `toBlock - fromBlock` the provider accepts.
export const MAX_LOG_BLOCK_SPAN = 10000;

// Blocks left behind head so a reorg is not committed.
export const SETTLE_BLOCKS = 10;

export async function settledBlockNumber(provider) {
    return await provider.getBlockNumber() - SETTLE_BLOCKS;
}

/**
 * Inclusive windows [start, end] covering fromBlock..toBlock.
 * Each window has `end - start <= MAX_LOG_BLOCK_SPAN`, with no gaps or overlap.
 * Returns [] when fromBlock is past toBlock.
 */
export function logWindows(fromBlock, toBlock) {
    const windows = [];
    if (fromBlock > toBlock) {
        return windows;
    }

    let start = fromBlock;
    while (start <= toBlock) {
        const end = Math.min(start + MAX_LOG_BLOCK_SPAN, toBlock);
        windows.push([start, end]);
        if (end === toBlock) {
            break;
        }
        start = end + 1;
    }
    return windows;
}

function isRateLimit(error) {
    const parts = [error.code, error.error?.code, error.shortMessage, error.message, error.error?.message];
    if (Array.isArray(error.value)) {
        for (const item of error.value) {
            parts.push(item?.code, item?.message);
        }
    }
    const text = parts.filter(part => part !== undefined && part !== null).join(" ");
    return text.includes("-32005") || text.includes("Too Many Requests");
}

export async function withRetry(fn, description) {
    const MAX_RETRIES = 8;
    const INITIAL_DELAY_MS = 2000;
    let retryCount = 0;
    let lastError;

    while (retryCount < MAX_RETRIES) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (isRateLimit(error) && retryCount < MAX_RETRIES - 1) {
                const delayMs = INITIAL_DELAY_MS * Math.pow(2, retryCount);
                console.log(chalk.yellow(`  [${description}] Rate limited, retrying in ${delayMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES})...`));
                await new Promise(resolve => setTimeout(resolve, delayMs));
                retryCount++;
            } else {
                throw error;
            }
        }
    }
    throw lastError;
}

/**
 * queryFilter across logWindows. Events come back in ascending window order.
 */
export async function queryFilterChunked(contract, filter, fromBlock, toBlock) {
    const windows = logWindows(fromBlock, toBlock);
    const events = [];
    for (let index = 0; index < windows.length; index++) {
        const [start, end] = windows[index];
        if (windows.length > 1) {
            console.log(`eth_getLogs ${start}..${end} (${index + 1}/${windows.length})`);
        }
        const chunk = await withRetry(
            () => contract.queryFilter(filter, start, end),
            `eth_getLogs ${start}..${end}`,
        );
        events.push(...chunk);
    }
    return events;
}
