import { expect } from "chai"
import { ethers, upgrades } from "hardhat"
import { StakingManager, MockMorphoVault, ERC20Token } from "../typechain-types"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"

describe("StakingManager - Fee Management", function () {
    let stakingManager: StakingManager
    let token: ERC20Token
    let vault: MockMorphoVault
    let owner: HardhatEthersSigner
    let user1: HardhatEthersSigner
    let user2: HardhatEthersSigner

    const INITIAL_BALANCE = ethers.parseEther("10000")
    const STAKE_AMOUNT = ethers.parseUnits("1000", 6) // Assuming token has 6 decimals

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
            [await vault.getAddress(), "Staking Manager Token", "SMT", owner.address],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as unknown as StakingManager

        // Transfer tokens to users for testing
        await token.transfer(user1.address, INITIAL_BALANCE)
        await token.transfer(user2.address, INITIAL_BALANCE)
    })

    describe("Fee Management", function () {
        it("Should allow owner to set input fee rate", async function () {
            const newFeeRate = 500 // 5%
            const oldFeeRate = await stakingManager.inputFeeRate()

            await expect(stakingManager.setInputFeeRate(newFeeRate))
                .to.emit(stakingManager, "InputFeeRateUpdated")
                .withArgs(oldFeeRate, newFeeRate)

            expect(await stakingManager.inputFeeRate()).to.equal(newFeeRate)
        })

        it("Should allow owner to set output fee rate", async function () {
            const newFeeRate = 300 // 3%
            const oldFeeRate = await stakingManager.outputFeeRate()

            await expect(stakingManager.setOutputFeeRate(newFeeRate))
                .to.emit(stakingManager, "OutputFeeRateUpdated")
                .withArgs(oldFeeRate, newFeeRate)

            expect(await stakingManager.outputFeeRate()).to.equal(newFeeRate)
        })

        it("Should not allow non-owner to set input fee rate", async function () {
            await expect(stakingManager.connect(user1).setInputFeeRate(500)).to.be.revertedWithCustomError(
                stakingManager,
                "OwnableUnauthorizedAccount"
            )
        })

        it("Should not allow non-owner to set output fee rate", async function () {
            await expect(stakingManager.connect(user1).setOutputFeeRate(300)).to.be.revertedWithCustomError(
                stakingManager,
                "OwnableUnauthorizedAccount"
            )
        })

        it("Should not allow fee rate greater than maximum", async function () {
            // MAX_FEE_RATE is 1000 (10%)
            await expect(stakingManager.setInputFeeRate(1001)).to.be.revertedWithCustomError(
                stakingManager,
                "InvalidFeeRate"
            )

            await expect(stakingManager.setOutputFeeRate(1001)).to.be.revertedWithCustomError(
                stakingManager,
                "InvalidFeeRate"
            )
        })

        it("Should collect input fees correctly", async function () {
            const feeRate = 1000 // 10%
            await stakingManager.setInputFeeRate(feeRate)

            await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT)

            await expect(stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address)).to.emit(
                stakingManager,
                "InputFeeCollected"
            )

            expect(await stakingManager.totalFeeShares()).to.be.gt(0)
        })

        it("Should collect output fees correctly", async function () {
            // First stake without fees
            await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT)
            await stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address)

            // Set output fee
            const feeRate = 500 // 5%
            await stakingManager.setOutputFeeRate(feeRate)

            // Use withdraw instead of redeem to avoid the calculation complexity
            const withdrawAmount = (STAKE_AMOUNT * BigInt(95)) / BigInt(100) // Expect ~95% due to 5% fee

            await expect(stakingManager.connect(user1).withdraw(withdrawAmount, user1.address, user1.address)).to.emit(
                stakingManager,
                "OutputFeeCollected"
            )

            expect(await stakingManager.totalFeeShares()).to.be.gt(0)
        })

        it("Should allow owner to withdraw fee shares", async function () {
            // Set up fees and collect some
            await stakingManager.setInputFeeRate(1000) // 10%
            await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT)
            await stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address)

            const feeShares = await stakingManager.totalFeeShares()
            expect(feeShares).to.be.gt(0)

            const previewAssets = await stakingManager.totalFeeAssets()
            const ownerBalanceBefore = await token.balanceOf(owner.address)

            await expect(stakingManager.withdrawFeeShares(owner.address, feeShares))
                .to.emit(stakingManager, "FeeSharesWithdrawn")
                .withArgs(owner.address, feeShares, previewAssets)

            const ownerBalanceAfter = await token.balanceOf(owner.address)
            expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(previewAssets)
            expect(await stakingManager.totalFeeShares()).to.equal(0)
        })

        it("Should not allow non-owner to withdraw fee shares", async function () {
            // Set up some fees first
            await stakingManager.setInputFeeRate(1000) // 10%
            await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT)
            await stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address)

            const feeShares = await stakingManager.totalFeeShares()

            await expect(
                stakingManager.connect(user1).withdrawFeeShares(user1.address, feeShares)
            ).to.be.revertedWithCustomError(stakingManager, "OwnableUnauthorizedAccount")
        })

        it("Should return correct total fee assets", async function () {
            // Set up fees and collect some
            await stakingManager.setInputFeeRate(1000) // 10%
            await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT)
            await stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address)

            const feeShares = await stakingManager.totalFeeShares()
            const totalFeeAssets = await stakingManager.totalFeeAssets()

            expect(feeShares).to.be.gt(0)
            expect(totalFeeAssets).to.be.gt(0)

            // The assets should correspond to what vault would give for the fee shares
            const vaultPreview = await vault.previewRedeem(feeShares)
            expect(totalFeeAssets).to.equal(vaultPreview)
        })

        it("Should handle zero fee rates correctly", async function () {
            // Ensure fee rates start at zero
            expect(await stakingManager.inputFeeRate()).to.equal(0)
            expect(await stakingManager.outputFeeRate()).to.equal(0)

            await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT)

            // Should not collect any fees
            await stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address)
            expect(await stakingManager.totalFeeShares()).to.equal(0)

            // Unstake should also not collect fees - use withdraw instead of redeem
            await stakingManager.connect(user1).withdraw(STAKE_AMOUNT, user1.address, user1.address)
            expect(await stakingManager.totalFeeShares()).to.equal(0)
        })

        it("Should calculate fees correctly with different rates", async function () {
            const testCases = [
                { rate: 100, description: "1%" },
                { rate: 500, description: "5%" },
                { rate: 1000, description: "10% (max)" },
            ]

            for (const testCase of testCases) {
                // Reset the contract
                const StakingManagerFactory = await ethers.getContractFactory("StakingManager")
                stakingManager = (await upgrades.deployProxy(
                    StakingManagerFactory,
                    [await vault.getAddress(), "Staking Manager Token", "SMT", owner.address],
                    {
                        initializer: "initialize",
                        kind: "uups",
                    }
                )) as unknown as StakingManager

                await stakingManager.setInputFeeRate(testCase.rate)
                await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT)

                const balanceBefore = await stakingManager.totalFeeShares()
                await stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address)
                const balanceAfter = await stakingManager.totalFeeShares()

                expect(balanceAfter).to.be.gt(balanceBefore, `Fee collection failed for ${testCase.description}`)
            }
        })
    })

    it("Should only allow owner to set fee rates", async function () {
        // Owner should be able to set both
        await expect(stakingManager.setInputFeeRate(500)).to.not.be.reverted
        await expect(stakingManager.setOutputFeeRate(300)).to.not.be.reverted
    })

    it("Should only allow owner to withdraw fee shares", async function () {
        // Set up some fees
        await stakingManager.setInputFeeRate(1000)
        await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT)
        await stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address)

        const feeShares = await stakingManager.totalFeeShares()
        expect(feeShares).to.be.gt(0)
        // Owner should be able to withdraw
        await expect(stakingManager.withdrawFeeShares(owner.address, feeShares)).to.not.be.reverted
    })
})
