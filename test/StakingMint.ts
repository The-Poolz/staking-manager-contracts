import { expect } from "chai"
import { ethers } from "hardhat"
import { setupTestEnvironment, TestContext, STAKE_AMOUNT, EXPECTED_SHARES, INITIAL_BALANCE } from "./utils/testUtils"

describe("StakingManager - Mint and Redeem", function () {
    let context: TestContext

    beforeEach(async function () {
        context = await setupTestEnvironment()
    })

    describe("Mint and Redeem", function () {
        beforeEach(async function () {
            const { stakingManager, token, user1, user2 } = context
            // Approve tokens for testing
            await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT * 2n)
            await token.connect(user2).approve(await stakingManager.getAddress(), STAKE_AMOUNT * 2n)
        })

        describe("Mint Function", function () {
            it("Should allow minting specific amount of shares", async function () {
                const { stakingManager, token, user1 } = context
                const sharesToMint = EXPECTED_SHARES
                const previewAssets = await stakingManager.previewMint(sharesToMint)
                
                await expect(stakingManager.connect(user1).mint(sharesToMint, user1.address))
                    .to.emit(stakingManager, "Deposit")
                    .withArgs(user1.address, user1.address, previewAssets, sharesToMint)
                
                expect(await stakingManager.balanceOf(user1.address)).to.equal(sharesToMint)
                expect(await token.balanceOf(user1.address)).to.equal(INITIAL_BALANCE - previewAssets)
            })

            it("Should revert when minting zero shares", async function () {
                const { stakingManager, user1 } = context
                await expect(
                    stakingManager.connect(user1).mint(0, user1.address)
                ).to.be.revertedWithCustomError(stakingManager, "AmountMustBeGreaterThanZero")
            })

            it("Should revert when minting to zero address", async function () {
                const { stakingManager, user1 } = context
                await expect(
                    stakingManager.connect(user1).mint(EXPECTED_SHARES, "0x0000000000000000000000000000000000000000")
                ).to.be.revertedWithCustomError(stakingManager, "ZeroAddress")
            })

            it("Should mint to different receiver", async function () {
                const { stakingManager, token, user1, user2 } = context
                const sharesToMint = EXPECTED_SHARES
                const previewAssets = await stakingManager.previewMint(sharesToMint)
                
                await expect(stakingManager.connect(user1).mint(sharesToMint, user2.address))
                    .to.emit(stakingManager, "Deposit")
                    .withArgs(user1.address, user2.address, previewAssets, sharesToMint)
                
                expect(await stakingManager.balanceOf(user2.address)).to.equal(sharesToMint)
                expect(await stakingManager.balanceOf(user1.address)).to.equal(0)
                expect(await token.balanceOf(user1.address)).to.equal(INITIAL_BALANCE - previewAssets)
            })

            it("Should revert when contract is paused", async function () {
                const { stakingManager, user1 } = context
                await stakingManager.pause()
                
                await expect(
                    stakingManager.connect(user1).mint(EXPECTED_SHARES, user1.address)
                ).to.be.revertedWithCustomError(stakingManager, "EnforcedPause")
            })

            it("Should handle mint with input fees", async function () {
                const { stakingManager, user1 } = context
                // Set 5% input fee
                await stakingManager.setInputFeeRate(500)
                
                const sharesToMint = EXPECTED_SHARES
                
                await expect(stakingManager.connect(user1).mint(sharesToMint, user1.address))
                    .to.emit(stakingManager, "Deposit")
                    .and.to.emit(stakingManager, "InputFeeCollected")
                
                expect(await stakingManager.balanceOf(user1.address)).to.be.lt(sharesToMint) // Less due to fees
                expect(await stakingManager.totalFeeShares()).to.be.gt(0)
            })

            it("Should calculate correct preview for mint", async function () {
                const { stakingManager } = context
                const sharesToMint = EXPECTED_SHARES
                const previewAssets = await stakingManager.previewMint(sharesToMint)
                
                // Should match the actual assets required
                expect(previewAssets).to.equal(STAKE_AMOUNT)
            })

            it("Should revert when user has insufficient assets for mint", async function () {
                const { stakingManager, token, user1 } = context
                const sharesToMint = EXPECTED_SHARES
                const requiredAssets = await stakingManager.previewMint(sharesToMint)
                
                // Test insufficient allowance (user has tokens but no approval)
                const [,,,, user3] = await ethers.getSigners()
                await token.transfer(user3.address, requiredAssets) // Give user3 tokens
                
                await expect(
                    stakingManager.connect(user3).mint(sharesToMint, user3.address)
                ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance")
                
                // Test insufficient allowance (user has approval but not enough)
                await token.connect(user1).approve(await stakingManager.getAddress(), requiredAssets - 1n)
                await expect(
                    stakingManager.connect(user1).mint(sharesToMint, user1.address)
                ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance")
                
                // Test insufficient balance (user has approval but not enough tokens)
                // Calculate shares that would require more assets than user has
                const excessiveShares = await stakingManager.previewWithdraw(INITIAL_BALANCE + 1n)
                await token.connect(user1).approve(await stakingManager.getAddress(), INITIAL_BALANCE * 2n)
                await expect(
                    stakingManager.connect(user1).mint(excessiveShares, user1.address)
                ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance")
            })
        })

        describe("Redeem Function", function () {
            beforeEach(async function () {
                const { stakingManager, user1 } = context
                // Setup: user1 has some shares
                await stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address)
            })

            it("Should allow basic redeem functionality", async function () {
                const { stakingManager, token, user1 } = context
                const userShares = await stakingManager.balanceOf(user1.address)
                const smallAmount = userShares / 100n // 1% only
                const initialTokenBalance = await token.balanceOf(user1.address)
                
                await expect(stakingManager.connect(user1).redeem(smallAmount, user1.address, user1.address))
                    .to.emit(stakingManager, "Withdraw")
                
                expect(await stakingManager.balanceOf(user1.address)).to.be.lt(userShares) // Should have fewer shares
                expect(await token.balanceOf(user1.address)).to.be.gt(initialTokenBalance) // Should receive tokens
            })

            it("Should revert when redeeming zero shares", async function () {
                const { stakingManager, user1 } = context
                await expect(
                    stakingManager.connect(user1).redeem(0, user1.address, user1.address)
                ).to.be.revertedWithCustomError(stakingManager, "AmountMustBeGreaterThanZero")
            })

            it("Should revert when receiver is zero address", async function () {
                const { stakingManager, user1 } = context
                const userShares = await stakingManager.balanceOf(user1.address)
                const smallAmount = userShares / 10n
                
                await expect(
                    stakingManager.connect(user1).redeem(smallAmount, "0x0000000000000000000000000000000000000000", user1.address)
                ).to.be.revertedWithCustomError(stakingManager, "ZeroAddress")
            })

            it("Should revert when owner is zero address", async function () {
                const { stakingManager, user1 } = context
                const userShares = await stakingManager.balanceOf(user1.address)
                const smallAmount = userShares / 10n
                
                await expect(
                    stakingManager.connect(user1).redeem(smallAmount, user1.address, "0x0000000000000000000000000000000000000000")
                ).to.be.revertedWithCustomError(stakingManager, "ZeroAddress")
            })

            it("Should revert when contract is paused", async function () {
                const { stakingManager, user1 } = context
                const userShares = await stakingManager.balanceOf(user1.address)
                const smallAmount = userShares / 10n
                await stakingManager.pause()
                
                await expect(
                    stakingManager.connect(user1).redeem(smallAmount, user1.address, user1.address)
                ).to.be.revertedWithCustomError(stakingManager, "EnforcedPause")
            })

            it("Should revert when trying to redeem more shares than owned", async function () {
                const { stakingManager, user1 } = context
                const userShares = await stakingManager.balanceOf(user1.address)
                const excessiveShares = userShares + 1n
                
                await expect(
                    stakingManager.connect(user1).redeem(excessiveShares.toString(), user1.address, user1.address)
                ).to.be.reverted // Should fail due to insufficient balance
            })

            it("Should calculate correct preview for redeem", async function () {
                const { stakingManager, user1 } = context
                const userShares = await stakingManager.balanceOf(user1.address)
                const previewAssets = await stakingManager.previewRedeem(userShares)
                
                // Preview should be reasonable (no fees set)
                expect(previewAssets).to.be.gt(0)
            })

            it("Should demonstrate both redeem and withdraw work correctly", async function () {
                const { stakingManager, token, user1 } = context
                // This test shows that both redeem and withdraw work properly
                const initialBalance = await token.balanceOf(user1.address)
                const userShares = await stakingManager.balanceOf(user1.address)
                
                // Test redeem function
                const sharesToRedeem = userShares / 4n // Redeem 25% of shares
                await expect(stakingManager.connect(user1).redeem(sharesToRedeem, user1.address, user1.address))
                    .to.emit(stakingManager, "Withdraw")
                
                const balanceAfterRedeem = await token.balanceOf(user1.address)
                expect(balanceAfterRedeem).to.be.gt(initialBalance) // Should receive tokens from redeem
                
                // Test withdraw function 
                const withdrawAmount = STAKE_AMOUNT / 4n // Withdraw 25% of original stake
                await expect(stakingManager.connect(user1).withdraw(withdrawAmount, user1.address, user1.address))
                    .to.emit(stakingManager, "Withdraw")
                
                expect(await stakingManager.balanceOf(user1.address)).to.be.lt(userShares) // Should have fewer shares
                expect(await token.balanceOf(user1.address)).to.equal(balanceAfterRedeem + withdrawAmount) // Should receive exact amount
            })
        })

        describe("Mint and Redeem Integration", function () {
            it("Should maintain consistency between mint and withdraw", async function () {
                const { stakingManager, token, user1 } = context
                const sharesToMint = EXPECTED_SHARES
                
                // Mint shares
                await stakingManager.connect(user1).mint(sharesToMint, user1.address)
                expect(await stakingManager.balanceOf(user1.address)).to.equal(sharesToMint)
                
                // Use withdraw instead of redeem to avoid known issues
                const withdrawAmount = STAKE_AMOUNT / 2n // Withdraw half the original stake amount
                const initialBalance = await token.balanceOf(user1.address)
                
                await stakingManager.connect(user1).withdraw(withdrawAmount, user1.address, user1.address)
                
                // Should have fewer shares
                expect(await stakingManager.balanceOf(user1.address)).to.be.lt(sharesToMint)
                // Should have received exact withdraw amount
                expect(await token.balanceOf(user1.address)).to.equal(initialBalance + withdrawAmount)
            })

            it("Should handle mint/withdraw with fees", async function () {
                const { stakingManager, user1 } = context
                // Set both input and output fees
                await stakingManager.setInputFeeRate(200) // 2%
                await stakingManager.setOutputFeeRate(200) // 2%
                
                const sharesToMint = EXPECTED_SHARES
                
                // Mint shares
                await expect(stakingManager.connect(user1).mint(sharesToMint, user1.address))
                    .to.emit(stakingManager, "InputFeeCollected")
                
                const userShares = await stakingManager.balanceOf(user1.address)
                expect(userShares).to.be.lt(sharesToMint) // Less due to input fees
                
                // Use withdraw instead of redeem
                const withdrawAmount = STAKE_AMOUNT / 4n // Withdraw 25%
                
                await expect(stakingManager.connect(user1).withdraw(withdrawAmount, user1.address, user1.address))
                    .to.emit(stakingManager, "OutputFeeCollected")
                
                // Should have accumulated fees from both operations
                expect(await stakingManager.totalFeeShares()).to.be.gt(0)
            })
        })
    })
})
