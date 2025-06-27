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

            await expect(stakingManager.connect(user).unstake(amount))
                .to.emit(stakingManager, "Unstake")
                .withArgs(user.address, amount, amount)

            expect(await stakingManager.balanceOf(user.address)).to.equal(0n)

            expect(await token.balanceOf(user.address)).to.equal(amount)
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
})
