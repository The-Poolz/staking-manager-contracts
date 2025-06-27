import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs"
import { expect } from "chai"
import { ethers } from "hardhat"
import hre from "hardhat"
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import {
    MockMorphoVault,
    StakingManager,
    ERC20Token,
} from "../typechain-types"

describe("StakingManager", function () {
    const name = "StakingManager Token"
    const symbol = "SMT"

    async function deployFixture() {
        const [owner, user]: SignerWithAddress[] = await ethers.getSigners()

        const Token = await hre.ethers.getContractFactory("ERC20Token")
        const token: ERC20Token = await Token.deploy("Test Token", "TTK")

        const Vault = await hre.ethers.getContractFactory("MockMorphoVault")
        const vault: MockMorphoVault = await Vault.deploy(await token.getAddress())

        const Manager = await hre.ethers.getContractFactory("StakingManager")
        const stakingManager: StakingManager = await Manager.deploy(
            await vault.getAddress(),
            name,
            symbol
        )

        // Give user some tokens to stake
        await token.transfer(user.address, ethers.parseEther("100"))

        return { owner, user, token, vault, stakingManager }
    }

    describe("Deployment", function () {
        let vault: MockMorphoVault
        let stakingManager: StakingManager

        beforeEach(async function () {
            ({ vault, stakingManager } = await loadFixture(deployFixture))
        })

        it("should deploy the StakingManager contract", async function () {
            expect(await stakingManager.getAddress()).to.be.properAddress
        })

        it("should revert if the Vault address is zero", async function () {
            const StakingManager = await hre.ethers.getContractFactory("StakingManager")
            await expect(StakingManager.deploy(ethers.ZeroAddress, name, symbol)).to.be.revertedWithCustomError(
                StakingManager,
                "ZeroAddress"
            )
        })

        it("should return vault token address", async function () {
            expect(await stakingManager.token()).to.equal(await vault.asset())
        })

        it("should return vault address", async function () {
            expect(await stakingManager.stakingVault()).to.equal(await vault.getAddress())
        })

        it("should return token name and symbol", async function () {
            expect(await stakingManager.name()).to.equal(name)
            expect(await stakingManager.symbol()).to.equal(symbol)
        })
    })

    describe("Deposits", function () {
        it("should stake assets and mint shares", async function () {
            const { user, token, stakingManager, vault } = await loadFixture(deployFixture)

            const amount = ethers.parseEther("10")
            await token.connect(user).approve(await stakingManager.getAddress(), amount)

            await expect(stakingManager.connect(user).stake(amount))
                .to.emit(stakingManager, "Stake")
                .withArgs(user.address, amount, amount)

            expect(await stakingManager.balanceOf(user.address)).to.equal(amount)
            expect(await vault.balanceOf(await stakingManager.getAddress())).to.equal(amount)
        })
    })

    describe("Withdrawals", function () {
        it("should unstake assets and burn shares", async function () {
            const fixture = await loadFixture(deployFixture)
            const { user, token, stakingManager } = fixture
            const amount = ethers.parseEther("5")

            await token.connect(user).approve(await stakingManager.getAddress(), amount)
            await stakingManager.connect(user).stake(amount)

            await expect(stakingManager.connect(user).unstake(amount))
                .to.emit(stakingManager, "Unstake")
                .withArgs(user.address, amount, amount)

            expect(await stakingManager.balanceOf(user.address)).to.equal(0n)
            expect(await token.balanceOf(user.address)).to.be.greaterThanOrEqual(amount)
        })
    })
})
