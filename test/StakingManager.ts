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
    const STAKE_AMOUNT = ethers.parseEther("1000")

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
    })

    describe("Staking and Unstaking", function () {
        it("Should allow staking with no fees", async function () {
            await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT)
            
            await expect(stakingManager.connect(user1).stake(STAKE_AMOUNT))
                .to.emit(stakingManager, "Stake")
                .withArgs(user1.address, STAKE_AMOUNT, STAKE_AMOUNT)

            expect(await stakingManager.balanceOf(user1.address)).to.equal(STAKE_AMOUNT)
            expect(await stakingManager.totalUserAssets(user1.address)).to.equal(STAKE_AMOUNT)
        })

        it("Should allow unstaking with no fees", async function () {
            // First stake
            await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT)
            await stakingManager.connect(user1).stake(STAKE_AMOUNT)

            // Then unstake
            const shares = await stakingManager.balanceOf(user1.address)
            await expect(stakingManager.connect(user1).unstake(shares))
                .to.emit(stakingManager, "Unstake")
                .withArgs(user1.address, shares, STAKE_AMOUNT)

            expect(await stakingManager.balanceOf(user1.address)).to.equal(0)
            expect(await token.balanceOf(user1.address)).to.equal(INITIAL_BALANCE)
        })
    })

    describe("Fee Management", function () {
        it("Should allow owner to set input fee rate", async function () {
            const newFeeRate = 100 // 1%
            
            await expect(stakingManager.connect(owner).setInputFeeRate(newFeeRate))
                .to.emit(stakingManager, "InputFeeRateUpdated")
                .withArgs(0, newFeeRate)

            expect(await stakingManager.inputFeeRate()).to.equal(newFeeRate)
        })

        it("Should allow owner to set output fee rate", async function () {
            const newFeeRate = 200 // 2%
            
            await expect(stakingManager.connect(owner).setOutputFeeRate(newFeeRate))
                .to.emit(stakingManager, "OutputFeeRateUpdated")
                .withArgs(0, newFeeRate)

            expect(await stakingManager.outputFeeRate()).to.equal(newFeeRate)
        })

        it("Should collect input fees on staking", async function () {
            // Set 1% input fee
            await stakingManager.connect(owner).setInputFeeRate(100)

            await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT)
            
            const expectedFee = STAKE_AMOUNT * 100n / 10000n
            const expectedNetAmount = STAKE_AMOUNT - expectedFee

            await expect(stakingManager.connect(user1).stake(STAKE_AMOUNT))
                .to.emit(stakingManager, "InputFeeCollected")
                .withArgs(expectedFee)

            expect(await stakingManager.accumulatedFees()).to.equal(expectedFee)
            expect(await stakingManager.balanceOf(user1.address)).to.equal(expectedNetAmount)
        })

        it("Should collect output fees on unstaking", async function () {
            // First stake with no fees
            await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT)
            await stakingManager.connect(user1).stake(STAKE_AMOUNT)

            // Set 2% output fee
            await stakingManager.connect(owner).setOutputFeeRate(200)

            const shares = await stakingManager.balanceOf(user1.address)
            const expectedFee = STAKE_AMOUNT * 200n / 10000n
            const expectedNetAmount = STAKE_AMOUNT - expectedFee

            await expect(stakingManager.connect(user1).unstake(shares))
                .to.emit(stakingManager, "OutputFeeCollected")
                .withArgs(expectedFee)

            expect(await stakingManager.accumulatedFees()).to.equal(expectedFee)
            expect(await token.balanceOf(user1.address)).to.equal(INITIAL_BALANCE - STAKE_AMOUNT + expectedNetAmount)
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

    describe("Access Control", function () {
        it("Should only allow owner to set fee rates", async function () {
            await expect(
                stakingManager.connect(user1).setInputFeeRate(100)
            ).to.be.revertedWithCustomError(stakingManager, "OwnableUnauthorizedAccount")

            await expect(
                stakingManager.connect(user1).setOutputFeeRate(100)
            ).to.be.revertedWithCustomError(stakingManager, "OwnableUnauthorizedAccount")
        })

        it("Should only allow owner to withdraw fees", async function () {
            await expect(
                stakingManager.connect(user1).withdrawFees(user1.address)
            ).to.be.revertedWithCustomError(stakingManager, "OwnableUnauthorizedAccount")
        })
    })
})
