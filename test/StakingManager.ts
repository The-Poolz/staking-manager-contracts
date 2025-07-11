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

        await token.transfer(user.address, ethers.parseEther("100"))

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
            const beforeBalance = await stakingManager.balanceOf(user.address)
            await expect(stakingManager.connect(user).unstake(amount))
                .to.emit(stakingManager, "Unstake")
                .withArgs(user.address, amount, amount)
            expect(await stakingManager.balanceOf(user.address)).to.equal(0n)

            expect(await token.balanceOf(user.address)).to.equal(beforeBalance + amount)
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

        it("should initialize with zero fee rate", async function () {
            expect(await stakingManager.feeRate()).to.equal(0)
            expect(await stakingManager.accumulatedFees()).to.equal(0)
        })

        it("should allow owner to set fee rate", async function () {
            const newFeeRate = 500 // 5%

            await expect(stakingManager.connect(owner).setFeeRate(newFeeRate))
                .to.emit(stakingManager, "FeeRateUpdated")
                .withArgs(0, newFeeRate)

            expect(await stakingManager.feeRate()).to.equal(newFeeRate)
        })

        it("should revert when non-owner tries to set fee rate", async function () {
            await expect(stakingManager.connect(user).setFeeRate(500))
                .to.be.revertedWithCustomError(stakingManager, "OwnableUnauthorizedAccount")
        })

        it("should revert when setting fee rate above maximum", async function () {
            const maxFeeRate = await stakingManager.MAX_FEE_RATE()
            const excessiveFeeRate = maxFeeRate + 1n

            await expect(stakingManager.connect(owner).setFeeRate(excessiveFeeRate))
                .to.be.revertedWithCustomError(stakingManager, "InvalidFeeRate")
        })

        it("should collect fees on staking", async function () {
            const feeRate = 500 // 5%
            const stakeAmount = ethers.parseEther("100")
            const expectedFee = (stakeAmount * BigInt(feeRate)) / 10000n
            const expectedNetAssets = stakeAmount - expectedFee

            await stakingManager.connect(owner).setFeeRate(feeRate)
            await token.connect(user).approve(await stakingManager.getAddress(), stakeAmount)

            await expect(stakingManager.connect(user).stake(stakeAmount))
                .to.emit(stakingManager, "FeeCollected")
                .withArgs(expectedFee)

            expect(await stakingManager.accumulatedFees()).to.equal(expectedFee)
            expect(await stakingManager.balanceOf(user.address)).to.equal(expectedNetAssets)
        })

        it("should not collect fees when fee rate is zero", async function () {
            const stakeAmount = ethers.parseEther("100")

            await token.connect(user).approve(await stakingManager.getAddress(), stakeAmount)
            await stakingManager.connect(user).stake(stakeAmount)

            expect(await stakingManager.accumulatedFees()).to.equal(0)
            expect(await stakingManager.balanceOf(user.address)).to.equal(stakeAmount)
        })

        it("should allow owner to withdraw fees", async function () {
            const feeRate = 1000 // 10%
            const stakeAmount = ethers.parseEther("100")
            const expectedFee = (stakeAmount * BigInt(feeRate)) / 10000n

            await stakingManager.connect(owner).setFeeRate(feeRate)
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

        it("should handle multiple stakes with fee accumulation", async function () {
            const feeRate = 250 // 2.5%
            const firstStake = ethers.parseEther("40")
            const secondStake = ethers.parseEther("60")
            const totalStaked = firstStake + secondStake
            const expectedTotalFee = (totalStaked * BigInt(feeRate)) / 10000n

            await stakingManager.connect(owner).setFeeRate(feeRate)
            await token.connect(user).approve(await stakingManager.getAddress(), totalStaked)

            await stakingManager.connect(user).stake(firstStake)
            await stakingManager.connect(user).stake(secondStake)

            expect(await stakingManager.accumulatedFees()).to.equal(expectedTotalFee)
        })

        it("should calculate correct net assets with maximum fee rate", async function () {
            const maxFeeRate = await stakingManager.MAX_FEE_RATE() // 10%
            const stakeAmount = ethers.parseEther("1000")
            const expectedFee = (stakeAmount * maxFeeRate) / 10000n
            const expectedNetAssets = stakeAmount - expectedFee

            await stakingManager.connect(owner).setFeeRate(maxFeeRate)
            await token.connect(user).approve(await stakingManager.getAddress(), stakeAmount)
            await stakingManager.connect(user).stake(stakeAmount)

            expect(await stakingManager.accumulatedFees()).to.equal(expectedFee)
            expect(await stakingManager.balanceOf(user.address)).to.equal(expectedNetAssets)
        })
    })
})
