import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { ethers } from "hardhat"

async function main() {
    const [owner]: SignerWithAddress[] = await ethers.getSigners()

    const loanTokenAddress = "0xd28C672a4ADABeb0c0aEC4cA08906ECF5BD0A489"
    const loanTokenAbi = [
        "function balanceOf(address account) external view returns (uint256)",
        "function approve(address spender, uint256 amount) external returns (bool)",
    ]
    const loanToken = new ethers.Contract(loanTokenAddress, loanTokenAbi, owner)

    const stakingManagerAddress = "0x78d72a86032d7fe3ef77fd1e8a87be96aba14505"
    const stakingManagerAbi = ["function stake(uint256 assets) external", "function unstake(uint256 shares) external"]

    const stakingManager = new ethers.Contract(stakingManagerAddress, stakingManagerAbi, owner)

    const stakeAmount = BigInt("100000000000000000000000")

    // ERC20 balance before staking
    const balanceBefore = await loanToken.balanceOf(await owner.getAddress())
    console.log("Balance before staking:", balanceBefore)
    // approve
    const approveTx = await loanToken.approve(stakingManagerAddress, stakeAmount.toString())
    await approveTx.wait()
    console.log("Approved:", stakeAmount, "tokens for staking")
    const stakeTx = await stakingManager.stake(stakeAmount)
    await stakeTx.wait()
    console.log("Staked:", stakeAmount, "tokens")

    await new Promise((r) => setTimeout(r, 10_000))
    const shareBalance = await stakingManager.balanceOf(await owner.getAddress())
    const unstakeTx = await stakingManager.unstake(shareBalance)
    await unstakeTx.wait()

    // ERC20 balance after unstaking
    const balanceAfter = await loanToken.balanceOf(await owner.getAddress())
    console.log("Balance after unstaking:", balanceAfter)
}

main().catch(console.error)
