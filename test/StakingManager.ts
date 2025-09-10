import { expect } from "chai"
import { ethers, upgrades } from "hardhat"
import { StakingManager, MockMorphoVault, ERC20Token } from "../typechain-types"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"

describe("StakingManager", function () {
    let stakingManager: StakingManager
    let token: ERC20Token
    let vault: MockMorphoVault
    let owner: HardhatEthersSigner
    let user1: HardhatEthersSigner
    let user2: HardhatEthersSigner

    const INITIAL_BALANCE = ethers.parseEther("10000")
    const STAKE_AMOUNT = ethers.parseUnits("1000", 6) // Assuming token has 6 decimals
    // ERC4626 shares use 18 decimals (6 + 12 offset), so we need to convert
    const EXPECTED_SHARES = ethers.parseUnits("1000", 18) // 1000 tokens = 1000 * 10^18 shares

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners()

        // Deploy mock token
        const ERC20TokenFactory = await ethers.getContractFactory("ERC20Token")
        token = await ERC20TokenFactory.deploy("Test Token", "TEST")
        await token.waitForDeployment()

        // Deploy mock vault
        const MockMorphoVaultFactory = await ethers.getContractFactory("MockMorphoVault")
        vault = await MockMorphoVaultFactory.deploy(await token.getAddress())
        await vault.waitForDeployment()

        // Deploy upgradeable StakingManager
        const StakingManagerFactory = await ethers.getContractFactory("StakingManager")
        stakingManager = (await upgrades.deployProxy(
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
    })

    describe("Initialization", function () {
        it("Should initialize correctly", async function () {
            expect(await stakingManager.name()).to.equal("Staking Manager Token")
            expect(await stakingManager.symbol()).to.equal("SMT")
            expect(await stakingManager.owner()).to.equal(owner.address)
            expect(await stakingManager.stakingVault()).to.equal(await vault.getAddress())
            expect(await stakingManager.token()).to.equal(await token.getAddress())
            expect(await stakingManager.inputFeeRate()).to.equal(0)
            expect(await stakingManager.outputFeeRate()).to.equal(0)
        })

        it("Should not allow reinitialization", async function () {
            await expect(
                stakingManager.initialize(
                    await vault.getAddress(),
                    "New Name",
                    "NEW",
                    owner.address
                )
            ).to.be.revertedWithCustomError(stakingManager, "InvalidInitialization")
        })

        it("Should return correct version", async function () {
            expect(await stakingManager.version()).to.equal("1.0.0")
        })
    })

    describe("Staking and Unstaking", function () {
        it("Should allow staking with no fees", async function () {
            await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT)

            await expect(stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address))
                .to.emit(stakingManager, "Deposit")
                .withArgs(user1.address, user1.address, STAKE_AMOUNT, EXPECTED_SHARES)
                // Deposit(caller, receiver, assets, shares)

            expect(await stakingManager.balanceOf(user1.address)).to.equal(EXPECTED_SHARES)
            expect(await stakingManager.totalUserAssets(user1.address)).to.equal(EXPECTED_SHARES)
        })

        it("Should allow unstaking with no fees", async function () {
            // First stake
            await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT)
            await stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address)

            await expect(stakingManager.connect(user1).withdraw(STAKE_AMOUNT, user1.address, user1.address))
                .to.emit(stakingManager, "Withdraw")
                .withArgs(user1.address, user1.address, user1.address, STAKE_AMOUNT, EXPECTED_SHARES)
            // emit Withdraw(caller, receiver, owner, assets, shares)
            expect(await stakingManager.balanceOf(user1.address)).to.equal(0)
            expect(await token.balanceOf(user1.address)).to.equal(INITIAL_BALANCE)
        })
    })

    describe("Upgradeability", function () {
        it("Should allow owner to upgrade", async function () {
            const StakingManagerFactory = await ethers.getContractFactory("StakingManager")
            
            // Upgrade the contract
            const upgraded = await upgrades.upgradeProxy(
                await stakingManager.getAddress(),
                StakingManagerFactory
            )

            expect(await upgraded.owner()).to.equal(owner.address)
        })

        it("Should not allow non-owner to upgrade", async function () {
            const StakingManagerFactory = await ethers.getContractFactory("StakingManager")
            
            // Try to upgrade from non-owner account
            await expect(
                upgrades.upgradeProxy(
                    await stakingManager.getAddress(),
                    StakingManagerFactory.connect(user1)
                )
            ).to.be.reverted
        })
    })

    describe("Pause Functionality", function () {
        beforeEach(async function () {
            // Approve tokens for testing
            await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT)
        })

        it("Should allow owner to pause and unpause", async function () {
            // Initially not paused
            expect(await stakingManager.paused()).to.be.false

            // Owner should be able to pause
            await expect(stakingManager.pause())
                .to.emit(stakingManager, "Paused")
                .withArgs(owner.address)

            expect(await stakingManager.paused()).to.be.true

            // Owner should be able to unpause
            await expect(stakingManager.unpause())
                .to.emit(stakingManager, "Unpaused")
                .withArgs(owner.address)

            expect(await stakingManager.paused()).to.be.false
        })

        it("Should not allow non-owner to pause or unpause", async function () {
            await expect(
                stakingManager.connect(user1).pause()
            ).to.be.revertedWithCustomError(stakingManager, "OwnableUnauthorizedAccount")

            await expect(
                stakingManager.connect(user1).unpause()
            ).to.be.revertedWithCustomError(stakingManager, "OwnableUnauthorizedAccount")
        })

        it("Should prevent staking when paused", async function () {
            // Pause the contract
            await stakingManager.pause()

            // Staking should be reverted
            await expect(
                stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address)
            ).to.be.revertedWithCustomError(stakingManager, "EnforcedPause")
        })

        it("Should prevent unstaking when paused", async function () {
            // First stake when not paused
            await stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address)
            const userShares = await stakingManager.balanceOf(user1.address)

            // Pause the contract
            await stakingManager.pause()

            // Unstaking should be reverted
            await expect(
                stakingManager.connect(user1).withdraw(userShares, user1.address, user1.address)
            ).to.be.revertedWithCustomError(stakingManager, "EnforcedPause")
        })

        it("Should allow staking and unstaking after unpause", async function () {
            // Pause and then unpause
            await stakingManager.pause()
            await stakingManager.unpause()

            // Should be able to stake
            await expect(stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address))
                .to.not.be.reverted

            const userShares = await stakingManager.balanceOf(user1.address)
            expect(userShares).to.be.gt(0)

            // Should be able to unstake
            await expect(stakingManager.connect(user1).withdraw(STAKE_AMOUNT, user1.address, user1.address)).to.not.be.reverted
        })
     })
})
