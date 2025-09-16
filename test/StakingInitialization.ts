import { expect } from "chai"
import { setupTestEnvironment, TestContext } from "./utils/testUtils"

describe("StakingManager - Initialization", function () {
    let context: TestContext

    beforeEach(async function () {
        context = await setupTestEnvironment()
    })

    describe("Initialization", function () {
        it("Should initialize correctly", async function () {
            const { stakingManager, owner, vault, token } = context
            expect(await stakingManager.name()).to.equal("Staking Manager Token")
            expect(await stakingManager.symbol()).to.equal("SMT")
            expect(await stakingManager.owner()).to.equal(owner.address)
            expect(await stakingManager.stakingVault()).to.equal(await vault.getAddress())
            expect(await stakingManager.asset()).to.equal(await token.getAddress())
            expect(await stakingManager.inputFeeRate()).to.equal(0)
            expect(await stakingManager.outputFeeRate()).to.equal(0)
        })

        it("Should not allow reinitialization", async function () {
            const { stakingManager, owner, vault } = context
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
            const { stakingManager } = context
            expect(await stakingManager.version()).to.equal("1.0.0")
        })
    })
})
