import { ethers } from "hardhat"

/**
 * Example script demonstrating the dual fee system
 * 
 * This script shows how to:
 * 1. Deploy the StakingManager with dual fee capability
 * 2. Set different input and output fee rates
 * 3. Stake tokens with input fees
 * 4. Unstake tokens with output fees
 * 5. Withdraw accumulated fees
 */
async function main() {
    console.log("🚀 Dual Fee System Example")
    console.log("=" + "=".repeat(50))

    // Get signers
    const [deployer, user] = await ethers.getSigners()
    console.log("📝 Deployer:", deployer.address)
    console.log("👤 User:", user.address)

    // Deploy mock token and vault
    console.log("\n📦 Deploying contracts...")
    const Token = await ethers.getContractFactory("ERC20Token")
    const token = await Token.deploy("Test Token", "TTK")
    
    const Vault = await ethers.getContractFactory("MockMorphoVault")
    const vault = await Vault.deploy(await token.getAddress())
    
    const StakingManager = await ethers.getContractFactory("StakingManager")
    const stakingManager = await StakingManager.deploy(
        await vault.getAddress(),
        "Staking Shares",
        "STK"
    )

    console.log("🎯 Token:", await token.getAddress())
    console.log("🏦 Vault:", await vault.getAddress())
    console.log("📊 StakingManager:", await stakingManager.getAddress())

    // Give user some tokens
    const initialAmount = ethers.parseEther("1000")
    await token.transfer(user.address, initialAmount)
    console.log(`💰 Transferred ${ethers.formatEther(initialAmount)} tokens to user`)

    // Set dual fee rates
    const inputFeeRate = 200  // 2% on stake
    const outputFeeRate = 300 // 3% on unstake
    
    console.log("\n⚙️  Setting fee rates...")
    await stakingManager.setInputFeeRate(inputFeeRate)
    await stakingManager.setOutputFeeRate(outputFeeRate)
    
    console.log(`📈 Input fee rate: ${inputFeeRate / 100}% (applied when staking)`)
    console.log(`📉 Output fee rate: ${outputFeeRate / 100}% (applied when unstaking)`)

    // Stake tokens
    const stakeAmount = ethers.parseEther("100")
    console.log(`\n🔐 Staking ${ethers.formatEther(stakeAmount)} tokens...`)
    
    await token.connect(user).approve(await stakingManager.getAddress(), stakeAmount)
    await stakingManager.connect(user).stake(stakeAmount)
    
    const expectedInputFee = (stakeAmount * BigInt(inputFeeRate)) / 10000n
    const netStaked = stakeAmount - expectedInputFee
    
    console.log(`💸 Input fee collected: ${ethers.formatEther(expectedInputFee)} tokens`)
    console.log(`✅ Net amount staked: ${ethers.formatEther(netStaked)} tokens`)
    
    const userShares = await stakingManager.balanceOf(user.address)
    console.log(`🎫 User received: ${ethers.formatEther(userShares)} shares`)

    // Check accumulated fees
    let accumulatedFees = await stakingManager.accumulatedFees()
    console.log(`💼 Total accumulated fees: ${ethers.formatEther(accumulatedFees)} tokens`)

    // Unstake tokens
    console.log(`\n🔓 Unstaking ${ethers.formatEther(userShares)} shares...`)
    
    const userTokensBefore = await token.balanceOf(user.address)
    await stakingManager.connect(user).unstake(userShares)
    const userTokensAfter = await token.balanceOf(user.address)
    
    const tokensReceived = userTokensAfter - userTokensBefore
    console.log(`💰 User received: ${ethers.formatEther(tokensReceived)} tokens`)
    
    // Check final accumulated fees
    const finalAccumulatedFees = await stakingManager.accumulatedFees()
    const outputFeeCollected = finalAccumulatedFees - accumulatedFees
    console.log(`💸 Output fee collected: ${ethers.formatEther(outputFeeCollected)} tokens`)
    console.log(`💼 Total accumulated fees: ${ethers.formatEther(finalAccumulatedFees)} tokens`)

    // Withdraw fees
    console.log(`\n💰 Withdrawing accumulated fees...`)
    const deployerTokensBefore = await token.balanceOf(deployer.address)
    await stakingManager.withdrawFees(deployer.address)
    const deployerTokensAfter = await token.balanceOf(deployer.address)
    
    const feesWithdrawn = deployerTokensAfter - deployerTokensBefore
    console.log(`✅ Fees withdrawn: ${ethers.formatEther(feesWithdrawn)} tokens`)

    // Summary
    console.log("\n📊 SUMMARY")
    console.log("=" + "=".repeat(30))
    console.log(`💵 Original stake amount: ${ethers.formatEther(stakeAmount)} tokens`)
    console.log(`📈 Input fee (${inputFeeRate / 100}%): ${ethers.formatEther(expectedInputFee)} tokens`)
    console.log(`📉 Output fee (${outputFeeRate / 100}%): ${ethers.formatEther(outputFeeCollected)} tokens`)
    console.log(`🏦 Total fees collected: ${ethers.formatEther(feesWithdrawn)} tokens`)
    console.log(`👤 User net result: ${ethers.formatEther(tokensReceived)} tokens (${ethers.formatEther(stakeAmount - tokensReceived)} tokens in fees)`)
    
    const totalFeePercentage = ((stakeAmount - tokensReceived) * 10000n) / stakeAmount
    console.log(`📊 Effective total fee rate: ${Number(totalFeePercentage) / 100}%`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
