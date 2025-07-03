import { ethers } from "ethers"

// ABI for the IRM contract with named tuple components
const irmAbi = [
    `function borrowRateView(
    (
      address loanToken,
      address collateralToken,
      address oracle,
      address irm,
      uint256 lltv
    ) marketParams,
    (
      uint128 totalSupplyAssets,
      uint128 totalSupplyShares,
      uint128 totalBorrowAssets,
      uint128 totalBorrowShares,
      uint128 lastUpdate,
      uint128 fee
    ) market
  ) view returns (uint256)`,
]

const provider = new ethers.JsonRpcProvider("https://1rpc.io/sepolia")

const irmAddress = "0x8C5dDCD3F601c91D1BF51c8ec26066010ACAbA7c"
const irm = new ethers.Contract(irmAddress, irmAbi, provider)

const marketParams = {
    loanToken: "0xd28C672a4ADABeb0c0aEC4cA08906ECF5BD0A489",
    collateralToken: "0x2244499e3385c5135BA90237833f325797aBcf01",
    oracle: "0x81985E90308FDF4556c6DD63DFdAa3FD3c0D651E",
    irm: irmAddress,
    lltv: 915000000000000000n,
}

const market = {
    totalSupplyAssets: 5000000000074794501690n,
    totalSupplyShares: 5000000000000033976565248992n,
    totalBorrowAssets: 2000900174982697949369n,
    totalBorrowShares: 2000564541399163124730581708n,
    lastUpdate: 1750341876n,
    fee: 0n,
}

/**
 * Calculate borrow APY using the exponential formula: exp(rate * seconds) - 1
 */
function calculateBorrowRate(ratePerSecond: string, seconds: number): number {
    // Convert rate to a number with 18 decimal precision
    const rate = Number(ratePerSecond) / 1e18

    // Calculate exp(rate * seconds) - 1
    const result = Math.exp(rate * seconds) - 1

    return result
}

/**
 * Calculate supply APY based on borrow APY, utilization, and fee
 * Formula: supplyAPY = borrowAPY * utilization * (1 - fee)
 *
 * @param borrowAPY The calculated borrow APY as a decimal (e.g., 0.0489 for 4.89%)
 * @param utilization The utilization rate as a decimal (e.g., 0.8 for 80%)
 * @param fee The fee rate in Wei (18 decimals, e.g., "0" for no fee)
 * @returns The supply APY as a decimal (e.g., 0.0416 for 4.16%)
 */
function calculateSupplyAPY(borrowAPY: number, utilization: number, fee: string): number {
    // Convert fee from Wei to decimal (1e18 denominator)
    const feeRate = Number(fee) / 1e18

    // Calculate supply APY using the formula: borrowAPY * utilization * (1 - fee)
    return borrowAPY * utilization * (1 - feeRate)
}

// Estimates user earnings over a time period using compound interest
function estimateEarnings(amount: number, apy: number, days: number): number {
    const rate = apy
    const years = days / 365
    return amount * (Math.pow(1 + rate, years) - 1)
}

// Calculate earnings over a given number of seconds
function calculateEarningsPerSeconds(amount: number, ratePerSecond: string, seconds: number): number {
    const rate = Number(ratePerSecond) / 1e18
    const earnings = amount * (Math.exp(rate * seconds) - 1)
    return earnings
}

async function main() {
    const ratePerSecond = await irm.borrowRateView(marketParams, market)
    console.log("Rate per second (Wei):", ratePerSecond.toString())

    const secondsInYear = 31_536_000
    const utilization = Number(market.totalBorrowAssets) / Number(market.totalSupplyAssets)
    const fee = market.fee.toString()

    const borrowAPY = calculateBorrowRate(ratePerSecond, secondsInYear)
    const supplyAPY = calculateSupplyAPY(borrowAPY, utilization, fee)

    console.log(`Borrow APY: ${(borrowAPY * 100).toFixed(2)}%`)
    console.log(
        `Supply APY: ${(supplyAPY * 100).toFixed(2)}% at ${(utilization * 100).toFixed(0)}% utilization with ${
            (Number(fee) / 1e18) * 100
        }% fee`
    )

    const userStakeRaw = BigInt("100000000000000000000000") // 100000 * 1e18

    // if need days to calculate earnings, uncomment the following lines
    //const daysStaked = 1
    //const estimatedEarnings = estimateEarnings(Number(userStakeRaw) / 1e18, supplyAPY, daysStaked)

    const secondsToCalculate = 10 // 10 seconds

    const estimatedEarnings = calculateEarningsPerSeconds(
        Number(userStakeRaw) / 1e18,
        ratePerSecond.toString(),
        secondsToCalculate
    )

    console.log(
        `Estimated earnings for staking ${userStakeRaw} tokens over ${secondsToCalculate} seconds: ≈ ${estimatedEarnings.toFixed(
            10
        )} tokens`
    )
}

main().catch(console.error)
