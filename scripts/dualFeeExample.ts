import { ethers, upgrades } from "hardhat"
import { StakingManager, MockMorphoVault, ERC20Token } from "../typechain-types"

async function main() {
    console.log("=== Upgradeable StakingManager Dual Fee Example ===\n")

    // Get signers
    const [deployer, user1, feeRecipient] = await ethers.getSigners()
    console.log("Deployer:", deployer.address)
    console.log("User1:", user1.address)
    console.log("Fee Recipient:", feeRecipient.address)

    // Deploy contracts
    console.log("\n📦 Deploying contracts...")
    
    // Deploy token
    const ERC20TokenFactory = await ethers.getContractFactory("ERC20Token")
    const token = await ERC20TokenFactory.deploy("Test Token", "TEST") as ERC20Token
    await token.waitForDeployment()
    
    // Deploy vault
    const MockMorphoVaultFactory = await ethers.getContractFactory("MockMorphoVault")
    const vault = await MockMorphoVaultFactory.deploy(await token.getAddress()) as MockMorphoVault
    await vault.waitForDeployment()
    
    // Deploy upgradeable StakingManager
    const StakingManagerFactory = await ethers.getContractFactory("StakingManager")
    const stakingManager = (await upgrades.deployProxy(
        StakingManagerFactory,
        [
            await vault.getAddress(),
            "Staking Manager Token",
            "SMT",
            deployer.address
        ],
        {
            initializer: 'initialize',
            kind: 'uups'
        }
    )) as unknown as StakingManager

    console.log("✅ All contracts deployed!")
    console.log("Token:", await token.getAddress())
    console.log("Vault:", await vault.getAddress())
    console.log("StakingManager Proxy:", await stakingManager.getAddress())

    // Setup: Transfer tokens to user1
    const initialTokens = ethers.parseEther("10000")
    await token.transfer(user1.address, initialTokens)
    console.log(`\n💰 Transferred ${ethers.formatEther(initialTokens)} tokens to user1`)

    // Configure dual fees: 1% input fee, 2% output fee
    console.log("\n⚙️  Configuring dual fee system...")
    const inputFeeRate = 100 // 1% (100 basis points)
    const outputFeeRate = 200 // 2% (200 basis points)
    
    await stakingManager.setInputFeeRate(inputFeeRate)
    await stakingManager.setOutputFeeRate(outputFeeRate)
    
    console.log(`Input fee rate set to: ${inputFeeRate / 100}%`)
    console.log(`Output fee rate set to: ${outputFeeRate / 100}%`)

    // Example 1: Stake with input fee
    console.log("\n🔥 Example 1: Staking with input fee")
    const stakeAmount = ethers.parseEther("1000")
    const expectedInputFee = stakeAmount * BigInt(inputFeeRate) / 10000n
    const expectedNetStake = stakeAmount - expectedInputFee
    
    console.log(`Stake amount: ${ethers.formatEther(stakeAmount)} tokens`)
    console.log(`Expected input fee: ${ethers.formatEther(expectedInputFee)} tokens`)
    console.log(`Expected net stake: ${ethers.formatEther(expectedNetStake)} tokens`)
    
    // Approve and stake
    await token.connect(user1).approve(await stakingManager.getAddress(), stakeAmount)
    await stakingManager.connect(user1).stake(stakeAmount)
    
    const userShares = await stakingManager.balanceOf(user1.address)
    const accumulatedFees = await stakingManager.accumulatedFees()
    
    console.log(`✅ Staked! User received: ${ethers.formatEther(userShares)} shares`)
    console.log(`📊 Accumulated fees: ${ethers.formatEther(accumulatedFees)} tokens`)

    // Example 2: Unstake with output fee
    console.log("\n🔄 Example 2: Unstaking with output fee")
    const unstakeShares = userShares / 2n // Unstake half
    const assetsFromShares = await stakingManager.totalUserAssets(user1.address) / 2n
    const expectedOutputFee = assetsFromShares * BigInt(outputFeeRate) / 10000n
    const expectedNetUnstake = assetsFromShares - expectedOutputFee
    
    console.log(`Unstake shares: ${ethers.formatEther(unstakeShares)} shares`)
    console.log(`Assets from shares: ${ethers.formatEther(assetsFromShares)} tokens`)
    console.log(`Expected output fee: ${ethers.formatEther(expectedOutputFee)} tokens`)
    console.log(`Expected net unstake: ${ethers.formatEther(expectedNetUnstake)} tokens`)
    
    const balanceBefore = await token.balanceOf(user1.address)
    await stakingManager.connect(user1).unstake(unstakeShares)
    const balanceAfter = await token.balanceOf(user1.address)
    const actualReceived = balanceAfter - balanceBefore
    
    const totalFeesAfterUnstake = await stakingManager.accumulatedFees()
    
    console.log(`✅ Unstaked! User received: ${ethers.formatEther(actualReceived)} tokens`)
    console.log(`📊 Total accumulated fees: ${ethers.formatEther(totalFeesAfterUnstake)} tokens`)

    // Example 3: Withdraw accumulated fees
    console.log("\n💸 Example 3: Withdrawing accumulated fees")
    console.log(`Fees to withdraw: ${ethers.formatEther(totalFeesAfterUnstake)} tokens`)
    
    const recipientBalanceBefore = await token.balanceOf(feeRecipient.address)
    await stakingManager.withdrawFees(feeRecipient.address)
    const recipientBalanceAfter = await token.balanceOf(feeRecipient.address)
    const feesWithdrawn = recipientBalanceAfter - recipientBalanceBefore
    
    console.log(`✅ Fees withdrawn! Recipient received: ${ethers.formatEther(feesWithdrawn)} tokens`)
    console.log(`📊 Remaining accumulated fees: ${ethers.formatEther(await stakingManager.accumulatedFees())} tokens`)

    // Example 4: Demonstrate upgrade capability
    console.log("\n🔄 Example 4: Demonstrating upgrade capability")
    console.log(`Current implementation:`, await upgrades.erc1967.getImplementationAddress(await stakingManager.getAddress()))
    
    // Simulate upgrade (deploy new implementation)
    const upgraded = await upgrades.upgradeProxy(
        await stakingManager.getAddress(),
        StakingManagerFactory
    )
    
    console.log(`✅ Contract upgraded!`)
    console.log(`New implementation:`, await upgrades.erc1967.getImplementationAddress(await stakingManager.getAddress()))
    console.log(`Data preserved - User shares: ${ethers.formatEther(await upgraded.balanceOf(user1.address))}`)

    // Final status
    console.log("\n📈 Final Status Summary:")
    console.log(`User1 token balance: ${ethers.formatEther(await token.balanceOf(user1.address))} tokens`)
    console.log(`User1 staking shares: ${ethers.formatEther(await stakingManager.balanceOf(user1.address))} shares`)
    console.log(`User1 staked assets: ${ethers.formatEther(await stakingManager.totalUserAssets(user1.address))} tokens`)
    console.log(`Fee recipient balance: ${ethers.formatEther(await token.balanceOf(feeRecipient.address))} tokens`)
    console.log(`Contract total assets: ${ethers.formatEther(await stakingManager.totalAssets())} tokens`)
    
    console.log("\n🎉 Upgradeable StakingManager dual fee example completed!")
}

main()
    .then(() => {
        console.log("\n✨ Example finished successfully")
        process.exit(0)
    })
    .catch((error) => {
        console.error("❌ Example failed:", error)
        process.exit(1)
    })
