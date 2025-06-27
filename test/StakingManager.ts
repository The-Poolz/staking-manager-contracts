import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs"
import { expect } from "chai"
import { ethers } from "hardhat"
import hre from "hardhat"
import { MockMorphoVault, StakingManager } from "../typechain-types"

describe("StakingManager", function () {
    const name = "StakingManager Token"
    const symbol = "SMT"

    describe("Deployment", function () {
        // MockMorphoVault
        let vaultAddress: MockMorphoVault
        let stakingManager: StakingManager

        beforeEach(async function () {
            // deploy token contract
            const Token = await hre.ethers.getContractFactory("ERC20Token")
            const token = await Token.deploy("Test Token", "TTK")
            // deploy the Vault contract
            const Vault = await hre.ethers.getContractFactory("MockMorphoVault")
            vaultAddress = await Vault.deploy(await token.getAddress())
            const StakingManager = await hre.ethers.getContractFactory("StakingManager")
            stakingManager = await StakingManager.deploy(await vaultAddress.getAddress(), name, symbol)
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
            expect(await stakingManager.token()).to.equal(await vaultAddress.asset())
        })

        it("should return vault address", async function () {
            expect(await stakingManager.stakingVault()).to.equal(await vaultAddress.getAddress())
        })

        it("should return token name and symbol", async function () {
            expect(await stakingManager.name()).to.equal(name)
            expect(await stakingManager.symbol()).to.equal(symbol)
        })
    })

    describe("Deposits", function () {
        let token: any
        let vault: MockMorphoVault
        let stakingManager: StakingManager
        let owner: any
        let user: any

        const amount = ethers.parseUnits("100", 18)

        beforeEach(async function () {
            ;[owner, user] = await hre.ethers.getSigners()
            const Token = await hre.ethers.getContractFactory("ERC20Token")
            token = await Token.deploy("Test Token", "TTK")
            const Vault = await hre.ethers.getContractFactory("MockMorphoVault")
            vault = await Vault.deploy(await token.getAddress())
            const StakingManager = await hre.ethers.getContractFactory("StakingManager")
            stakingManager = await StakingManager.deploy(await vault.getAddress(), name, symbol)

            // fund user and approve staking
            await token.transfer(user.address, amount)
            await token.connect(user).approve(await stakingManager.getAddress(), amount)
        })

        it("should stake tokens and mint shares", async function () {
            await expect(stakingManager.connect(user).stake(amount))
                .to.emit(stakingManager, "Stake")
                .withArgs(user.address, amount, amount)

            expect(await stakingManager.balanceOf(user.address)).to.equal(amount)
            expect(await vault.balanceOf(await stakingManager.getAddress())).to.equal(amount)
        })

        it("should revert when staking zero tokens", async function () {
            await expect(stakingManager.connect(user).stake(0)).to.be.revertedWithCustomError(
                stakingManager,
                "AmountMustBeGreaterThanZero"
            )
        })

        it("should update total user and contract assets", async function () {
            await stakingManager.connect(user).stake(amount)

            expect(await stakingManager.totalUserAssets(user.address)).to.equal(amount)
            expect(await stakingManager.totalAssets()).to.equal(amount)
        })
    })

    describe("Withdrawals", function () {
        let token: any
        let vault: MockMorphoVault
        let stakingManager: StakingManager
        let owner: any
        let user: any

        const amount = ethers.parseUnits("50", 18)

        beforeEach(async function () {
            ;[owner, user] = await hre.ethers.getSigners()
            const Token = await hre.ethers.getContractFactory("ERC20Token")
            token = await Token.deploy("Test Token", "TTK")
            const Vault = await hre.ethers.getContractFactory("MockMorphoVault")
            vault = await Vault.deploy(await token.getAddress())
            const StakingManager = await hre.ethers.getContractFactory("StakingManager")
            stakingManager = await StakingManager.deploy(await vault.getAddress(), name, symbol)

            // fund user and stake some tokens
            await token.transfer(user.address, amount)
            await token.connect(user).approve(await stakingManager.getAddress(), amount)
            await stakingManager.connect(user).stake(amount)
        })

        it("should unstake tokens and burn shares", async function () {
            await expect(stakingManager.connect(user).unstake(amount))
                .to.emit(stakingManager, "Unstake")
                .withArgs(user.address, amount, amount)

            expect(await stakingManager.balanceOf(user.address)).to.equal(0)
            expect(await token.balanceOf(user.address)).to.equal(amount)
        })

        it("should revert when unstaking zero shares", async function () {
            await expect(stakingManager.connect(user).unstake(0)).to.be.revertedWithCustomError(
                stakingManager,
                "AmountMustBeGreaterThanZero"
            )
        })

        it("should revert when unstaking more shares than owned", async function () {
            await expect(
                stakingManager.connect(user).unstake(amount + 1n)
            ).to.be.revertedWithCustomError(stakingManager, "InsufficientShares")
        })
    })
})
