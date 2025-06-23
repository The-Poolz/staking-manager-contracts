import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs"
import { expect } from "chai"
import { ethers } from "hardhat"
import hre from "hardhat"
import { MockMorphoVault } from "../typechain-types"

describe("StakingManager", function () {
    describe("Deployment", function () {
        // MockMorphoVault
        let vaultAddress: MockMorphoVault
        it("should deploy the StakingManager contract", async function () {
            // deploy token contract
            const Token = await hre.ethers.getContractFactory("ERC20Token")
            const token = await Token.deploy("Test Token", "TTK")
            // deploy the Vault contract
            const Vault = await hre.ethers.getContractFactory("MockMorphoVault")
            vaultAddress = await Vault.deploy(await token.getAddress())

            const StakingManager = await hre.ethers.getContractFactory("StakingManager")
            const stakingManager = await StakingManager.deploy(await vaultAddress.getAddress())

            expect(await stakingManager.getAddress()).to.be.properAddress
        })

        it("should revert if the Vault address is zero", async function () {
            const StakingManager = await hre.ethers.getContractFactory("StakingManager")
            await expect(StakingManager.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
                StakingManager,
                "ZeroAddress"
            )
        })

        it("should return vault token address", async function () {
            const StakingManager = await hre.ethers.getContractFactory("StakingManager")
            const stakingManager = await StakingManager.deploy(await vaultAddress.getAddress())

            expect(await stakingManager.token()).to.equal(await vaultAddress.asset())
        })

        it("should return vault address", async function () {
            const StakingManager = await hre.ethers.getContractFactory("StakingManager")
            const stakingManager = await StakingManager.deploy(await vaultAddress.getAddress())

            expect(await stakingManager.stakingVault()).to.equal(await vaultAddress.getAddress())
        })
    })

    describe("Deposits", function () {})
    describe("Withdrawals", function () {})
})
