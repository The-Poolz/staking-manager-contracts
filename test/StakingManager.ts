import { expect } from "chai"
import { ethers } from "hardhat"
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { ERC20Token, MockMorphoVault, StakingManager } from "../typechain-types"

describe("StakingManager", function () {
    const name = "StakingManager Token"
    const symbol = "SMT"

    async function deployFixture() {
        const [owner, user]: SignerWithAddress[] = await ethers.getSigners()

        const Token = await ethers.getContractFactory("ERC20Token")
        const token: ERC20Token = await Token.deploy("Test Token", "TTK")

        const Vault = await ethers.getContractFactory("MockMorphoVault")
        const vault: MockMorphoVault = await Vault.deploy(await token.getAddress())

        const Manager = await ethers.getContractFactory("StakingManager")
        const stakingManager: StakingManager = await Manager.deploy(await vault.getAddress(), name, symbol)

        await token.transfer(user.address, ethers.parseEther("10000"))

        return { owner, user, token, vault, stakingManager }
    }

    describe("Deployment", function () {
        let stakingManager: StakingManager

        beforeEach(async function () {
            ({ stakingManager } = await loadFixture(deployFixture))
        })

        it("should deploy the contract properly", async function () {
            expect(await stakingManager.getAddress()).to.be.properAddress
        })

        it("should revert on zero vault address", async function () {
            const StakingManager = await ethers.getContractFactory("StakingManager")

            await expect(StakingManager.deploy(ethers.ZeroAddress, name, symbol)).to.be.revertedWithCustomError(
                StakingManager,
                "ZeroAddress"
            )
        })

        it("should return correct vault token", async function () {
            const { stakingManager, vault } = await loadFixture(deployFixture)

            expect(await stakingManager.token()).to.equal(await vault.asset())
        })

        it("should return correct vault address", async function () {
            const { stakingManager, vault } = await loadFixture(deployFixture)

            expect(await stakingManager.stakingVault()).to.equal(await vault.getAddress())
        })

        it("should return correct token name and symbol", async function () {
            const { stakingManager } = await loadFixture(deployFixture)

            expect(await stakingManager.name()).to.equal(name)

            expect(await stakingManager.symbol()).to.equal(symbol)
        })
    })

    describe("Deposits", function () {
        let user: SignerWithAddress
        let token: ERC20Token
        let vault: MockMorphoVault
        let stakingManager: StakingManager

        beforeEach(async function () {
            ({ user, token, vault, stakingManager } = await loadFixture(deployFixture))

            await token.connect(user).approve(await stakingManager.getAddress(), ethers.parseEther("100"))
        })

        it("should stake tokens and mint shares", async function () {
            const amount = ethers.parseEther("10")

            await expect(stakingManager.connect(user).stake(amount))
                .to.emit(stakingManager, "Stake")
                .withArgs(user.address, amount, amount)

            expect(await stakingManager.balanceOf(user.address)).to.equal(amount)

            expect(await vault.balanceOf(await stakingManager.getAddress())).to.equal(amount)
        })

        it("should revert on staking zero", async function () {
            await expect(stakingManager.connect(user).stake(0)).to.be.revertedWithCustomError(
                stakingManager,
                "AmountMustBeGreaterThanZero"
            )
        })

        it("should update total user and contract assets", async function () {
            const amount = ethers.parseEther("10")

            await stakingManager.connect(user).stake(amount)

            expect(await stakingManager.totalUserAssets(user.address)).to.equal(amount)

            expect(await stakingManager.totalAssets()).to.equal(amount)
        })
    })

    describe("Withdrawals", function () {
        let user: SignerWithAddress
        let token: ERC20Token
        let stakingManager: StakingManager

        beforeEach(async function () {
            ({ user, token, stakingManager } = await loadFixture(deployFixture))
            const amount = ethers.parseEther("50")
            
            await token.connect(user).approve(await stakingManager.getAddress(), amount)
            await stakingManager.connect(user).stake(amount)
        })

        it("should unstake tokens and burn shares", async function () {
            const amount = ethers.parseEther("50")
            const userTokenBalanceBefore = await token.balanceOf(user.address)
            
            await expect(stakingManager.connect(user).unstake(amount))
                .to.emit(stakingManager, "Unstake")
                .withArgs(user.address, amount, amount)
            
            expect(await stakingManager.balanceOf(user.address)).to.equal(0n)
            expect(await token.balanceOf(user.address)).to.equal(userTokenBalanceBefore + amount)
        })

        it("should revert on unstaking zero", async function () {
            await expect(stakingManager.connect(user).unstake(0)).to.be.revertedWithCustomError(
                stakingManager,
                "AmountMustBeGreaterThanZero"
            )
        })

        it("should revert when unstaking more than owned", async function () {
            const excessiveAmount = ethers.parseEther("51")

            await expect(stakingManager.connect(user).unstake(excessiveAmount)).to.be.revertedWithCustomError(
                stakingManager,
                "InsufficientShares"
            )
        })
    })

    describe("Fee Management", function () {
        let owner: SignerWithAddress
        let user: SignerWithAddress
        let token: ERC20Token
        let stakingManager: StakingManager

        beforeEach(async function () {
            ({ owner, user, token, stakingManager } = await loadFixture(deployFixture))
        })

        it("should initialize with zero fee rates", async function () {
            expect(await stakingManager.inputFeeRate()).to.equal(0)
            expect(await stakingManager.outputFeeRate()).to.equal(0)
            expect(await stakingManager.accumulatedFees()).to.equal(0)
        })

        it("should allow owner to set input fee rate", async function () {
            const newInputFeeRate = 500 // 5%

            await expect(stakingManager.connect(owner).setInputFeeRate(newInputFeeRate))
                .to.emit(stakingManager, "InputFeeRateUpdated")
                .withArgs(0, newInputFeeRate)

            expect(await stakingManager.inputFeeRate()).to.equal(newInputFeeRate)
        })

        it("should allow owner to set output fee rate", async function () {
            const newOutputFeeRate = 300 // 3%

            await expect(stakingManager.connect(owner).setOutputFeeRate(newOutputFeeRate))
                .to.emit(stakingManager, "OutputFeeRateUpdated")
                .withArgs(0, newOutputFeeRate)

            expect(await stakingManager.outputFeeRate()).to.equal(newOutputFeeRate)
        })

        it("should revert when non-owner tries to set input fee rate", async function () {
            await expect(stakingManager.connect(user).setInputFeeRate(500))
                .to.be.revertedWithCustomError(stakingManager, "OwnableUnauthorizedAccount")
        })

        it("should revert when non-owner tries to set output fee rate", async function () {
            await expect(stakingManager.connect(user).setOutputFeeRate(300))
                .to.be.revertedWithCustomError(stakingManager, "OwnableUnauthorizedAccount")
        })

        it("should revert when setting input fee rate above maximum", async function () {
            const maxFeeRate = await stakingManager.MAX_FEE_RATE()
            const excessiveFeeRate = maxFeeRate + 1n

            await expect(stakingManager.connect(owner).setInputFeeRate(excessiveFeeRate))
                .to.be.revertedWithCustomError(stakingManager, "InvalidFeeRate")
        })

        it("should revert when setting output fee rate above maximum", async function () {
            const maxFeeRate = await stakingManager.MAX_FEE_RATE()
            const excessiveFeeRate = maxFeeRate + 1n

            await expect(stakingManager.connect(owner).setOutputFeeRate(excessiveFeeRate))
                .to.be.revertedWithCustomError(stakingManager, "InvalidFeeRate")
        })

        it("should collect input fees on staking", async function () {
            const inputFeeRate = 500 // 5%
            const stakeAmount = ethers.parseEther("100")
            const expectedFee = (stakeAmount * BigInt(inputFeeRate)) / 10000n
            const expectedNetAssets = stakeAmount - expectedFee

            await stakingManager.connect(owner).setInputFeeRate(inputFeeRate)
            await token.connect(user).approve(await stakingManager.getAddress(), stakeAmount)

            await expect(stakingManager.connect(user).stake(stakeAmount))
                .to.emit(stakingManager, "InputFeeCollected")
                .withArgs(expectedFee)

            expect(await stakingManager.accumulatedFees()).to.equal(expectedFee)
            expect(await stakingManager.balanceOf(user.address)).to.equal(expectedNetAssets)
        })

        it("should not collect fees when input fee rate is zero", async function () {
            const stakeAmount = ethers.parseEther("100")

            await token.connect(user).approve(await stakingManager.getAddress(), stakeAmount)
            await stakingManager.connect(user).stake(stakeAmount)

            expect(await stakingManager.accumulatedFees()).to.equal(0)
            expect(await stakingManager.balanceOf(user.address)).to.equal(stakeAmount)
        })

        it("should allow owner to withdraw fees", async function () {
            const inputFeeRate = 1000 // 10%
            const stakeAmount = ethers.parseEther("100")
            const expectedFee = (stakeAmount * BigInt(inputFeeRate)) / 10000n

            await stakingManager.connect(owner).setInputFeeRate(inputFeeRate)
            await token.connect(user).approve(await stakingManager.getAddress(), stakeAmount)
            await stakingManager.connect(user).stake(stakeAmount)

            const ownerBalanceBefore = await token.balanceOf(owner.address)

            await expect(stakingManager.connect(owner).withdrawFees(owner.address))
                .to.emit(stakingManager, "FeesWithdrawn")
                .withArgs(owner.address, expectedFee)

            expect(await stakingManager.accumulatedFees()).to.equal(0)
            expect(await token.balanceOf(owner.address)).to.equal(ownerBalanceBefore + expectedFee)
        })

        it("should revert when withdrawing fees to zero address", async function () {
            await expect(stakingManager.connect(owner).withdrawFees(ethers.ZeroAddress))
                .to.be.revertedWithCustomError(stakingManager, "ZeroAddress")
        })

        it("should revert when withdrawing with no accumulated fees", async function () {
            await expect(stakingManager.connect(owner).withdrawFees(owner.address))
                .to.be.revertedWithCustomError(stakingManager, "NoFeesToWithdraw")
        })

        it("should revert when non-owner tries to withdraw fees", async function () {
            await expect(stakingManager.connect(user).withdrawFees(user.address))
                .to.be.revertedWithCustomError(stakingManager, "OwnableUnauthorizedAccount")
        })

        it("should handle multiple stakes with input fee accumulation", async function () {
            const inputFeeRate = 250 // 2.5%
            const firstStake = ethers.parseEther("40")
            const secondStake = ethers.parseEther("60")
            const totalStaked = firstStake + secondStake
            const expectedTotalFee = (totalStaked * BigInt(inputFeeRate)) / 10000n

            await stakingManager.connect(owner).setInputFeeRate(inputFeeRate)
            await token.connect(user).approve(await stakingManager.getAddress(), totalStaked)

            await stakingManager.connect(user).stake(firstStake)
            await stakingManager.connect(user).stake(secondStake)

            expect(await stakingManager.accumulatedFees()).to.equal(expectedTotalFee)
        })

        it("should calculate correct net assets with maximum input fee rate", async function () {
            const maxFeeRate = await stakingManager.MAX_FEE_RATE() // 10%
            const stakeAmount = ethers.parseEther("1000")
            const expectedFee = (stakeAmount * maxFeeRate) / 10000n
            const expectedNetAssets = stakeAmount - expectedFee

            await stakingManager.connect(owner).setInputFeeRate(maxFeeRate)
            await token.connect(user).approve(await stakingManager.getAddress(), stakeAmount)
            await stakingManager.connect(user).stake(stakeAmount)

            expect(await stakingManager.accumulatedFees()).to.equal(expectedFee)
            expect(await stakingManager.balanceOf(user.address)).to.equal(expectedNetAssets)
        })

        it("should collect output fees on unstaking", async function () {
            const outputFeeRate = 300 // 3%
            const stakeAmount = ethers.parseEther("100")

            // First stake without any fees
            await token.connect(user).approve(await stakingManager.getAddress(), stakeAmount)
            await stakingManager.connect(user).stake(stakeAmount)

            // Set output fee rate
            await stakingManager.connect(owner).setOutputFeeRate(outputFeeRate)

            const userShares = await stakingManager.balanceOf(user.address)
            const userTokenBalanceBefore = await token.balanceOf(user.address)

            // Unstake and expect output fee to be collected
            await expect(stakingManager.connect(user).unstake(userShares))
                .to.emit(stakingManager, "OutputFeeCollected")

            // Check that some fee was collected
            expect(await stakingManager.accumulatedFees()).to.be.greaterThan(0)

            // User should receive less than the full amount due to output fee
            const userTokenBalanceAfter = await token.balanceOf(user.address)
            const receivedAmount = userTokenBalanceAfter - userTokenBalanceBefore
            expect(receivedAmount).to.be.lessThan(stakeAmount)
        })

        it("should handle both input and output fees", async function () {
            const inputFeeRate = 200 // 2%
            const outputFeeRate = 300 // 3%
            const stakeAmount = ethers.parseEther("100")

            // Set both fee rates
            await stakingManager.connect(owner).setInputFeeRate(inputFeeRate)
            await stakingManager.connect(owner).setOutputFeeRate(outputFeeRate)

            await token.connect(user).approve(await stakingManager.getAddress(), stakeAmount)

            // Stake with input fee
            await expect(stakingManager.connect(user).stake(stakeAmount))
                .to.emit(stakingManager, "InputFeeCollected")

            const feesAfterStake = await stakingManager.accumulatedFees()
            expect(feesAfterStake).to.be.greaterThan(0)

            const userShares = await stakingManager.balanceOf(user.address)

            // Unstake with output fee
            await expect(stakingManager.connect(user).unstake(userShares))
                .to.emit(stakingManager, "OutputFeeCollected")

            const feesAfterUnstake = await stakingManager.accumulatedFees()
            expect(feesAfterUnstake).to.be.greaterThan(feesAfterStake)
        })
    })
})
