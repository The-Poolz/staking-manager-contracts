import { expect } from "chai"
import { setupTestEnvironment, TestContext, STAKE_AMOUNT } from "./utils/testUtils"

describe("StakingManager - Pause Functionality", function () {
    let context: TestContext

    beforeEach(async function () {
        context = await setupTestEnvironment()
    })

    describe("Pause Functionality", function () {
        beforeEach(async function () {
            const { stakingManager, token, user1 } = context
            // Approve tokens for testing
            await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT)
        })

        it("Should allow owner to pause and unpause", async function () {
            const { stakingManager, owner } = context
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
            const { stakingManager, user1 } = context
            await expect(
                stakingManager.connect(user1).pause()
            ).to.be.revertedWithCustomError(stakingManager, "OwnableUnauthorizedAccount")

            await expect(
                stakingManager.connect(user1).unpause()
            ).to.be.revertedWithCustomError(stakingManager, "OwnableUnauthorizedAccount")
        })

        it("Should prevent staking when paused", async function () {
            const { stakingManager, user1 } = context
            // Pause the contract
            await stakingManager.pause()

            // Staking should be reverted
            await expect(
                stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address)
            ).to.be.revertedWithCustomError(stakingManager, "EnforcedPause")
        })

        it("Should prevent unstaking when paused", async function () {
            const { stakingManager, user1 } = context
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
            const { stakingManager, user1 } = context
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
