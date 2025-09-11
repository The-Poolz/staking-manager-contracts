import { expect } from "chai"
import { ethers, upgrades } from "hardhat"
import { setupTestEnvironment, TestContext } from "./utils/testUtils"

describe("StakingManager - Upgradeability", function () {
    let context: TestContext

    beforeEach(async function () {
        context = await setupTestEnvironment()
    })

    describe("Upgradeability", function () {
        it("Should allow owner to upgrade", async function () {
            const { stakingManager, owner } = context
            const StakingManagerFactory = await ethers.getContractFactory("StakingManager")
            
            // Upgrade the contract
            const upgraded = await upgrades.upgradeProxy(
                await stakingManager.getAddress(),
                StakingManagerFactory
            )

            expect(await upgraded.owner()).to.equal(owner.address)
        })

        it("Should not allow non-owner to upgrade", async function () {
            const { stakingManager, user1 } = context
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
})
