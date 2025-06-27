import { ethers } from "hardhat"
import * as hre from "hardhat"

async function main() {
    const vaultAddress = process.env.VAULT_ADDRESS || "0xd63070114470f685b75B74D60EEc7c1113d33a3D"
    const name = process.env.STAKING_MANAGER_NAME || "StakingManager"
    const symbol = process.env.STAKING_MANAGER_SYMBOL || "SMGR"

    const StakingManager = await ethers.getContractFactory("StakingManager")
    const stakingManager = await StakingManager.deploy(vaultAddress, name, symbol)

    console.log("StakingManager deployed to:", await stakingManager.getAddress())

    // Verify the contract on scan if the API key is provided
    if (process.env.ETHERSCAN_API_KEY) {
        await hre.run("verify:verify", {
            address: await stakingManager.getAddress(),
            constructorArguments: [vaultAddress, name, symbol],
        })
    }
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
