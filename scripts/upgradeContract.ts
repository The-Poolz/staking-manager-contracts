import { ethers, upgrades } from "hardhat"
import { StakingManager } from "../typechain-types"

async function main() {
    console.log("Upgrading StakingManager...")

    // Get the deployer account
    const [deployer] = await ethers.getSigners()
    console.log("Upgrading contract with account:", deployer.address)

    // Retrieve the proxy address from environment variables or command-line arguments
    const PROXY_ADDRESS = process.env.PROXY_ADDRESS || process.argv[2]
    if (!PROXY_ADDRESS) {
        throw new Error("Proxy address not provided. Set the PROXY_ADDRESS environment variable or pass it as a command-line argument.")
    }

    // Get the current implementation
    const currentImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS)
    console.log("Current implementation:", currentImpl)

    // Deploy the new implementation
    console.log("Deploying new implementation...")
    const StakingManagerV2Factory = await ethers.getContractFactory("StakingManager")
    
    const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, StakingManagerV2Factory)
    await upgraded.waitForDeployment()

    const newImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS)
    console.log("New implementation:", newImpl)

    // Verify the upgrade
    const stakingManager = StakingManagerV2Factory.attach(PROXY_ADDRESS) as StakingManager
    console.log("Contract name:", await stakingManager.name())
    console.log("Contract owner:", await stakingManager.owner())

    console.log("Upgrade completed successfully!")
}

main()
    .then(() => {
        console.log("Upgrade process finished")
        process.exit(0)
    })
    .catch((error) => {
        console.error("Upgrade failed:", error)
        process.exit(1)
    })
