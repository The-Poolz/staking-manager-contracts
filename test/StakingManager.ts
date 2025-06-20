import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs"
import { expect } from "chai"
import { ethers } from "hardhat"
import hre from "hardhat"
import { MockMorphoVault } from "../typechain-types"

describe("StackingManager", function () {
    describe("Deployment", function () {
        // MockMorphoVault
        let vaultAddress: MockMorphoVault
        it("should deploy the StackingManager contract", async function () {
            // deploy token contract
            const Token = await hre.ethers.getContractFactory("ERC20Token")
            const token = await Token.deploy("Test Token", "TTK")
            // deploy the Vault contract
            const Vault = await hre.ethers.getContractFactory("MockMorphoVault")
            vaultAddress = await Vault.deploy(await token.getAddress())

            const StackingManager = await hre.ethers.getContractFactory("StakingManager")
            const stackingManager = await StackingManager.deploy(await vaultAddress.getAddress())

            expect(await stackingManager.getAddress()).to.be.properAddress
        })

        it("should revert if the Vault address is zero", async function () {
            const StackingManager = await hre.ethers.getContractFactory("StakingManager")
            await expect(StackingManager.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
                StackingManager,
                "ZeroAddress"
            )
        })

        it("should return vault token address", async function () {
            const StackingManager = await hre.ethers.getContractFactory("StakingManager")
            const stackingManager = await StackingManager.deploy(await vaultAddress.getAddress())

            expect(await stackingManager.token()).to.equal(await vaultAddress.asset())
        })

        it("should return vault address", async function () {
            const StackingManager = await hre.ethers.getContractFactory("StakingManager")
            const stackingManager = await StackingManager.deploy(await vaultAddress.getAddress())

            expect(await stackingManager.stackingVault()).to.equal(await vaultAddress.getAddress())
        })
    })

    describe("Deposits", function () {})
    describe("Withdrawals", function () {})
})
