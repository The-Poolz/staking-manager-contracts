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

    describe("Deposits", function () {})
    describe("Withdrawals", function () {})
})
