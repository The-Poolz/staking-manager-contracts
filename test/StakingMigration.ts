import { expect } from "chai"
import { ethers } from "hardhat"
import { setupTestEnvironment, TestContext, STAKE_AMOUNT } from "./utils/testUtils"
import { MockMorphoVault } from "../typechain-types"

describe("StakingManager - Migration", function () {
    let context: TestContext
    let newVault: MockMorphoVault
    let differentAssetVault: MockMorphoVault
    let differentToken: any

    beforeEach(async function () {
        context = await setupTestEnvironment()
        const { stakingManager, token, owner, user1 } = context

        // Create a new vault with the same asset for migration testing
        const MockMorphoVaultFactory = await ethers.getContractFactory("MockMorphoVault")
        newVault = await MockMorphoVaultFactory.deploy(await token.getAddress())
        await newVault.waitForDeployment()

        // Create a different token and vault for negative testing
        const ERC20TokenFactory = await ethers.getContractFactory("ERC20Token")
        differentToken = await ERC20TokenFactory.deploy("Different Token", "DIFF")
        await differentToken.waitForDeployment()

        differentAssetVault = await MockMorphoVaultFactory.deploy(await differentToken.getAddress())
        await differentAssetVault.waitForDeployment()

        // Setup some initial stake for migration tests
        await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT)
        await stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address)
    })

    describe("getMigrationInfo Function", function () {
        it("Should return correct migration info when vault has assets", async function () {
            const { stakingManager, vault } = context
            const migrationInfo = await stakingManager.getMigrationInfo(await newVault.getAddress())
            
            // Current assets should match what the current vault reports
            expect(migrationInfo.currentAssets).to.equal(await vault.previewRedeem(migrationInfo.currentShares))
            expect(migrationInfo.currentShares).to.equal(STAKE_AMOUNT)
            expect(migrationInfo.projectedShares).to.be.gt(0)
            expect(migrationInfo.projectedAssets).to.equal(STAKE_AMOUNT)
        })

        it("Should return zero values when vault has no assets", async function () {
            const { stakingManager, vault, user1, token } = context
            // Withdraw all assets first
            const userShares = await stakingManager.balanceOf(user1.address)
            const assetsToWithdraw = await stakingManager.previewRedeem(userShares)
            await stakingManager.connect(user1).withdraw(assetsToWithdraw, user1.address, user1.address)
            const migrationInfo = await stakingManager.getMigrationInfo(await newVault.getAddress())

            expect(migrationInfo.currentShares).to.equal(0)
            expect(migrationInfo.currentAssets).to.equal(0)
            expect(migrationInfo.projectedShares).to.equal(0)
            expect(migrationInfo.projectedAssets).to.equal(0)
        })

        it("Should calculate projected values correctly for new vault", async function () {
            const { stakingManager } = context
            const migrationInfo = await stakingManager.getMigrationInfo(await newVault.getAddress())
            // Verify the projected values match what the new vault would provide
            const expectedProjectedShares = await newVault.previewDeposit(migrationInfo.currentAssets)
            const expectedProjectedAssets = await newVault.previewRedeem(expectedProjectedShares)
            
            expect(migrationInfo.projectedShares).to.equal(expectedProjectedShares)
            expect(migrationInfo.projectedAssets).to.equal(expectedProjectedAssets)
        })
    })

    describe("migrateVault Function", function () {
        it("Should successfully migrate to a new vault with same asset", async function () {
            const { stakingManager, vault } = context
            // Get initial state
            const initialMigrationInfo = await stakingManager.getMigrationInfo(await newVault.getAddress())
            // Perform migration
            await expect(stakingManager.migrateVault(await newVault.getAddress()))
                .to.emit(stakingManager, "VaultMigrationCompleted")
                .withArgs(
                    await vault.getAddress(),
                    await newVault.getAddress(),
                    initialMigrationInfo.currentAssets,
                    initialMigrationInfo.projectedShares
                )
            // Verify migration results
            expect(await vault.balanceOf(await stakingManager.getAddress())).to.equal(0)
            expect(await newVault.balanceOf(await stakingManager.getAddress())).to.equal(initialMigrationInfo.projectedShares)
        })

        it("Should revert when migrating to vault with different asset", async function () {
            const { stakingManager } = context
            await expect(
                stakingManager.migrateVault(await differentAssetVault.getAddress())
            ).to.be.revertedWithCustomError(stakingManager, "DifferentVaultAsset")
        })

        it("Should revert when migrating to the same vault", async function () {
            const { stakingManager, vault } = context
            
            await expect(
                stakingManager.migrateVault(await vault.getAddress())
            ).to.be.revertedWithCustomError(stakingManager, "SameVaultAsset")
        })

        it("Should revert when trying to migrate with no assets", async function () {
            const { stakingManager, vault, user1 } = context
            // Withdraw all assets first
            const userShares = await stakingManager.balanceOf(user1.address)
            const assetsToWithdraw = await stakingManager.previewRedeem(userShares)
            await stakingManager.connect(user1).withdraw(assetsToWithdraw, user1.address, user1.address)
            await expect(
                stakingManager.migrateVault(await newVault.getAddress())
            ).to.be.revertedWithCustomError(stakingManager, "NoAssetsToMigrate")
        })

        it("Should revert when migrating to zero address", async function () {
            const { stakingManager } = context
            await expect(
                stakingManager.migrateVault("0x0000000000000000000000000000000000000000")
            ).to.be.revertedWithCustomError(stakingManager, "ZeroAddress")
        })

        it("Should only allow owner to migrate vault", async function () {
            const { stakingManager, user1 } = context
            
            await expect(
                stakingManager.connect(user1).migrateVault(await newVault.getAddress())
            ).to.be.revertedWithCustomError(stakingManager, "OwnableUnauthorizedAccount")
        })

        it("Should preserve user shares during migration", async function () {
            const { stakingManager, user1, user2, token } = context
            
            // Add another user with different stake amount
            const stakeAmount2 = STAKE_AMOUNT / 2n
            await token.connect(user2).approve(await stakingManager.getAddress(), stakeAmount2)
            await stakingManager.connect(user2).deposit(stakeAmount2, user2.address)
            
            // Record user shares before migration
            const user1SharesBefore = await stakingManager.balanceOf(user1.address)
            const user2SharesBefore = await stakingManager.balanceOf(user2.address)
            const totalSupplyBefore = await stakingManager.totalSupply()
            
            // Perform migration
            await stakingManager.migrateVault(await newVault.getAddress())
            // Verify user shares are preserved
            expect(await stakingManager.balanceOf(user1.address)).to.equal(user1SharesBefore)
            expect(await stakingManager.balanceOf(user2.address)).to.equal(user2SharesBefore)
            expect(await stakingManager.totalSupply()).to.equal(totalSupplyBefore)
        })

        it("Should allow normal operations after migration", async function () {
            const { stakingManager, user1, user2, token } = context
            // Perform migration
            await stakingManager.migrateVault(await newVault.getAddress())
            // Test deposit after migration
            const depositAmount = STAKE_AMOUNT / 4n
            await token.connect(user2).approve(await stakingManager.getAddress(), depositAmount)
            await expect(stakingManager.connect(user2).deposit(depositAmount, user2.address))
                .to.emit(stakingManager, "Deposit")
            // Test withdrawal after migration
            const withdrawAmount = STAKE_AMOUNT / 4n
            await expect(stakingManager.connect(user1).withdraw(withdrawAmount, user1.address, user1.address))
                .to.emit(stakingManager, "Withdraw")
        })

        it("Should handle migration with fees correctly", async function () {
            const { stakingManager, vault } = context
            // Set some fees
            await stakingManager.setInputFeeRate(100) // 1%
            await stakingManager.setOutputFeeRate(150) // 1.5%
            // Get initial fee shares
            const initialFeeShares = await stakingManager.totalFeeShares()
            // Perform migration
            await stakingManager.migrateVault(await newVault.getAddress())
            // Fee shares should be preserved
            expect(await stakingManager.totalFeeShares()).to.equal(initialFeeShares)
            // Should be able to withdraw fee shares from new vault
            if (initialFeeShares > 0) {
                const { owner } = context
                await expect(stakingManager.withdrawFeeShares(owner.address, initialFeeShares))
                    .to.emit(stakingManager, "FeeSharesWithdrawn")
            }
        })
    })

    describe("Migration Edge Cases", function () {
        it("Should handle migration when vaults have different exchange rates", async function () {
            const { stakingManager, token } = context
            
            // Create a vault and perform a direct deposit to it to create different exchange rate
            const specialVault = await ethers.deployContract("MockMorphoVault", [await token.getAddress()])
            
            // Create different exchange rate by depositing to the special vault directly
            await token.approve(await specialVault.getAddress(), ethers.parseUnits("500", 6))
            await specialVault.deposit(ethers.parseUnits("500", 6), await stakingManager.getAddress())
                        
            await expect(stakingManager.migrateVault(await specialVault.getAddress()))
                .to.emit(stakingManager, "VaultMigrationCompleted")
            
            // Verify the migration completed with potentially different share amounts
            const finalBalance = await specialVault.balanceOf(await stakingManager.getAddress())
            expect(finalBalance).to.be.gt(0)
        })
    })
})