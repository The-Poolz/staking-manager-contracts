import { ethers, upgrades } from "hardhat"
import { StakingManager, MockMorphoVault, ERC20Token } from "../typechain-types"

async function main() {
    console.log("Deploying StakingManager with proxy pattern...")

    // Get the deployer account
    const [deployer] = await ethers.getSigners()
    console.log("Deploying contracts with account:", deployer.address)

    // Deploy mock token for testing
    console.log("Deploying mock ERC20 token...")
    const ERC20TokenFactory = await ethers.getContractFactory("ERC20Token")
    const token = (await ERC20TokenFactory.deploy(
        "Test Token",
        "TEST"
    )) as ERC20Token
    await token.waitForDeployment()
    console.log("Mock ERC20 token deployed to:", await token.getAddress())

    // Deploy mock vault
    console.log("Deploying mock Morpho vault...")
    const MockMorphoVaultFactory = await ethers.getContractFactory("MockMorphoVault")
    const vault = (await MockMorphoVaultFactory.deploy(
        await token.getAddress()
    )) as MockMorphoVault
    await vault.waitForDeployment()
    console.log("Mock Morpho vault deployed to:", await vault.getAddress())

    // Deploy the upgradeable StakingManager
    console.log("Deploying upgradeable StakingManager...")
    const StakingManagerFactory = await ethers.getContractFactory("StakingManager")
    
    const stakingManager = (await upgrades.deployProxy(
        StakingManagerFactory,
        [
            await vault.getAddress(), // _stakingVault
            "Staking Manager Token", // name
            "SMT", // symbol
            deployer.address // owner
        ],
        {
            initializer: 'initialize',
            kind: 'uups'
        }
    )) as unknown as StakingManager

    await stakingManager.waitForDeployment()
    const stakingManagerAddress = await stakingManager.getAddress()

    console.log("StakingManager proxy deployed to:", stakingManagerAddress)
    console.log("Implementation address:", await upgrades.erc1967.getImplementationAddress(stakingManagerAddress))
    console.log("Admin address:", await upgrades.erc1967.getAdminAddress(stakingManagerAddress))

    // Verify the deployment
    console.log("\nVerifying deployment...")
    console.log("StakingManager name:", await stakingManager.name())
    console.log("StakingManager symbol:", await stakingManager.symbol())
    console.log("StakingManager owner:", await stakingManager.owner())
    console.log("StakingManager vault:", await stakingManager.stakingVault())
    console.log("StakingManager token:", await stakingManager.asset())

    // Set up some initial tokens for testing
    console.log("\nSetting up test environment...")
    const testAmount = ethers.parseEther("10000")
    await token.transfer(deployer.address, testAmount)
    console.log(`Transferred ${ethers.formatEther(testAmount)} tokens to deployer`)

    return {
        token: await token.getAddress(),
        vault: await vault.getAddress(),
        stakingManager: stakingManagerAddress
    }
}

main()
    .then((contracts) => {
        console.log("\n=== Deployment Summary ===")
        console.log("Token:", contracts.token)
        console.log("Vault:", contracts.vault)
        console.log("StakingManager Proxy:", contracts.stakingManager)
        console.log("==========================")
        process.exit(0)
    })
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
