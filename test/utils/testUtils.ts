import { ethers, upgrades } from "hardhat"
import { StakingManager, MockMorphoVault, ERC20Token } from "../../typechain-types"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"

export interface TestContext {
    stakingManager: StakingManager
    token: ERC20Token
    vault: MockMorphoVault
    owner: HardhatEthersSigner
    user1: HardhatEthersSigner
    user2: HardhatEthersSigner
}

export const INITIAL_BALANCE = ethers.parseEther("10000")
export const STAKE_AMOUNT = ethers.parseUnits("1000", 6) // Assuming token has 6 decimals
// ERC4626 shares use 18 decimals (6 + 12 offset), so we need to convert
export const EXPECTED_SHARES = ethers.parseUnits("1000", 18) // 1000 tokens = 1000 * 10^18 shares

export async function setupTestEnvironment(): Promise<TestContext> {
    const [owner, user1, user2] = await ethers.getSigners()

    // Deploy mock token
    const ERC20TokenFactory = await ethers.getContractFactory("ERC20Token")
    const token = await ERC20TokenFactory.deploy("Test Token", "TEST")
    await token.waitForDeployment()

    // Deploy mock vault
    const MockMorphoVaultFactory = await ethers.getContractFactory("MockMorphoVault")
    const vault = await MockMorphoVaultFactory.deploy(await token.getAddress())
    await vault.waitForDeployment()

    // Deploy upgradeable StakingManager
    const StakingManagerFactory = await ethers.getContractFactory("StakingManager")
    const stakingManager = (await upgrades.deployProxy(
        StakingManagerFactory,
        [
            await vault.getAddress(),
            "Staking Manager Token",
            "SMT",
            owner.address
        ],
        {
            initializer: 'initialize',
            kind: 'uups'
        }
    )) as unknown as StakingManager

    // Transfer tokens to users for testing
    await token.transfer(user1.address, INITIAL_BALANCE)
    await token.transfer(user2.address, INITIAL_BALANCE)

    return {
        stakingManager,
        token,
        vault,
        owner,
        user1,
        user2
    }
}
