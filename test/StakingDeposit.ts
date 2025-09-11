import { expect } from "chai"
import { ethers } from "hardhat"
import { setupTestEnvironment, TestContext, STAKE_AMOUNT, EXPECTED_SHARES, INITIAL_BALANCE } from "./utils/testUtils"

describe("StakingManager - Deposit and Withdraw", function () {
    let context: TestContext

    beforeEach(async function () {
        context = await setupTestEnvironment()
    })

    describe("Staking and Unstaking", function () {
        it("Should allow staking with no fees", async function () {
            const { stakingManager, token, user1 } = context
            await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT)

            await expect(stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address))
                .to.emit(stakingManager, "Deposit")
                .withArgs(user1.address, user1.address, STAKE_AMOUNT, EXPECTED_SHARES)
                // Deposit(caller, receiver, assets, shares)

            expect(await stakingManager.balanceOf(user1.address)).to.equal(EXPECTED_SHARES)
            expect(await stakingManager.totalUserAssets(user1.address)).to.equal(EXPECTED_SHARES)
        })

        it("Should allow unstaking with no fees", async function () {
            const { stakingManager, token, user1 } = context
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

        it("Should revert when user has insufficient assets for deposit", async function () {
            const { stakingManager, token, user1 } = context
            // Test insufficient allowance (user has tokens but no approval)
            const [,,, user3] = await ethers.getSigners()
            await token.transfer(user3.address, STAKE_AMOUNT) // Give user3 some tokens
            
            await expect(
                stakingManager.connect(user3).deposit(STAKE_AMOUNT, user3.address)
            ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance")
            
            // Test insufficient allowance (user has approval but not enough)
            await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT - 1n)
            await expect(
                stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address)
            ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance")
            
            // Test insufficient balance (user has approval but not enough tokens)
            await token.connect(user1).approve(await stakingManager.getAddress(), INITIAL_BALANCE + 1n)
            await expect(
                stakingManager.connect(user1).deposit(INITIAL_BALANCE + 1n, user1.address)
            ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance")
        })

        it("Should revert when trying to withdraw more assets than owned", async function () {
            const { stakingManager, token, user1 } = context
            // First stake some amount
            await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT)
            await stakingManager.connect(user1).deposit(STAKE_AMOUNT / 2n, user1.address) // Deposit half
            
            // Try to withdraw more than was deposited
            await expect(
                stakingManager.connect(user1).withdraw(STAKE_AMOUNT, user1.address, user1.address)
            ).to.be.reverted // Should fail due to insufficient shares to cover withdrawal
        })
    })
})
