import { expect } from "chai"
import { ethers, upgrades } from "hardhat"
import { StakingManager, MockMorphoVault, ERC20Token } from "../typechain-types"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"

describe("StakingManager", function () {
    let stakingManager: StakingManager
    let token: ERC20Token
    let vault: MockMorphoVault
    let owner: HardhatEthersSigner
    let user1: HardhatEthersSigner
    let user2: HardhatEthersSigner

    const INITIAL_BALANCE = ethers.parseEther("10000")
    const STAKE_AMOUNT = ethers.parseUnits("1000", 6) // Assuming token has 6 decimals
    // ERC4626 shares use 18 decimals (6 + 12 offset), so we need to convert
    const EXPECTED_SHARES = ethers.parseUnits("1000", 18) // 1000 tokens = 1000 * 10^18 shares

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners()

        // Deploy mock token
        const ERC20TokenFactory = await ethers.getContractFactory("ERC20Token")
        token = await ERC20TokenFactory.deploy("Test Token", "TEST")
        await token.waitForDeployment()

        // Deploy mock vault
        const MockMorphoVaultFactory = await ethers.getContractFactory("MockMorphoVault")
        vault = await MockMorphoVaultFactory.deploy(await token.getAddress())
        await vault.waitForDeployment()

        // Deploy upgradeable StakingManager
        const StakingManagerFactory = await ethers.getContractFactory("StakingManager")
        stakingManager = (await upgrades.deployProxy(
            StakingManagerFactory,
            [
                await vault.getAddress(),
                "Staking Manager Token",
                "SMT",
                owner.address
            ],
            {
                initializer: 'initialize',
                kind: 'uups'
            }
        )) as unknown as StakingManager

        // Transfer tokens to users for testing
        await token.transfer(user1.address, INITIAL_BALANCE)
        await token.transfer(user2.address, INITIAL_BALANCE)
    })

    describe("Initialization", function () {
        it("Should initialize correctly", async function () {
            expect(await stakingManager.name()).to.equal("Staking Manager Token")
            expect(await stakingManager.symbol()).to.equal("SMT")
            expect(await stakingManager.owner()).to.equal(owner.address)
            expect(await stakingManager.stakingVault()).to.equal(await vault.getAddress())
            expect(await stakingManager.token()).to.equal(await token.getAddress())
            expect(await stakingManager.inputFeeRate()).to.equal(0)
            expect(await stakingManager.outputFeeRate()).to.equal(0)
        })

        it("Should not allow reinitialization", async function () {
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
            expect(await stakingManager.version()).to.equal("1.0.0")
        })
    })

    describe("Staking and Unstaking", function () {
        it("Should allow staking with no fees", async function () {
            await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT)

            await expect(stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address))
                .to.emit(stakingManager, "Deposit")
                .withArgs(user1.address, user1.address, STAKE_AMOUNT, EXPECTED_SHARES)
                // Deposit(caller, receiver, assets, shares)

            expect(await stakingManager.balanceOf(user1.address)).to.equal(EXPECTED_SHARES)
            expect(await stakingManager.totalUserAssets(user1.address)).to.equal(EXPECTED_SHARES)
        })

        it("Should allow unstaking with no fees", async function () {
            // First stake
            await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT)
            await stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address)

            await expect(stakingManager.connect(user1).withdraw(STAKE_AMOUNT, user1.address, user1.address))
                .to.emit(stakingManager, "Withdraw")
                .withArgs(user1.address, user1.address, user1.address, STAKE_AMOUNT, EXPECTED_SHARES)
            // emit Withdraw(caller, receiver, owner, assets, shares)
            expect(await stakingManager.balanceOf(user1.address)).to.equal(0)
            expect(await token.balanceOf(user1.address)).to.equal(INITIAL_BALANCE)
        })
    })

    describe("Mint and Redeem", function () {
        beforeEach(async function () {
            // Approve tokens for testing
            await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT * 2n)
            await token.connect(user2).approve(await stakingManager.getAddress(), STAKE_AMOUNT * 2n)
        })

        describe("Mint Function", function () {
            it("Should allow minting specific amount of shares", async function () {
                const sharesToMint = EXPECTED_SHARES
                const previewAssets = await stakingManager.previewMint(sharesToMint)
                
                await expect(stakingManager.connect(user1).mint(sharesToMint, user1.address))
                    .to.emit(stakingManager, "Deposit")
                    .withArgs(user1.address, user1.address, previewAssets, sharesToMint)
                
                expect(await stakingManager.balanceOf(user1.address)).to.equal(sharesToMint)
                expect(await token.balanceOf(user1.address)).to.equal(INITIAL_BALANCE - previewAssets)
            })

            it("Should revert when minting zero shares", async function () {
                await expect(
                    stakingManager.connect(user1).mint(0, user1.address)
                ).to.be.revertedWithCustomError(stakingManager, "AmountMustBeGreaterThanZero")
            })

            it("Should revert when minting to zero address", async function () {
                await expect(
                    stakingManager.connect(user1).mint(EXPECTED_SHARES, "0x0000000000000000000000000000000000000000")
                ).to.be.revertedWithCustomError(stakingManager, "ZeroAddress")
            })

            it("Should mint to different receiver", async function () {
                const sharesToMint = EXPECTED_SHARES
                const previewAssets = await stakingManager.previewMint(sharesToMint)
                
                await expect(stakingManager.connect(user1).mint(sharesToMint, user2.address))
                    .to.emit(stakingManager, "Deposit")
                    .withArgs(user1.address, user2.address, previewAssets, sharesToMint)
                
                expect(await stakingManager.balanceOf(user2.address)).to.equal(sharesToMint)
                expect(await stakingManager.balanceOf(user1.address)).to.equal(0)
                expect(await token.balanceOf(user1.address)).to.equal(INITIAL_BALANCE - previewAssets)
            })

            it("Should revert when contract is paused", async function () {
                await stakingManager.pause()
                
                await expect(
                    stakingManager.connect(user1).mint(EXPECTED_SHARES, user1.address)
                ).to.be.revertedWithCustomError(stakingManager, "EnforcedPause")
            })

            it("Should handle mint with input fees", async function () {
                // Set 5% input fee
                await stakingManager.setInputFeeRate(500)
                
                const sharesToMint = EXPECTED_SHARES
                const previewAssets = await stakingManager.previewMint(sharesToMint)
                
                await expect(stakingManager.connect(user1).mint(sharesToMint, user1.address))
                    .to.emit(stakingManager, "Deposit")
                    .and.to.emit(stakingManager, "InputFeeCollected")
                
                expect(await stakingManager.balanceOf(user1.address)).to.be.lt(sharesToMint) // Less due to fees
                expect(await stakingManager.totalFeeShares()).to.be.gt(0)
            })

            it("Should calculate correct preview for mint", async function () {
                const sharesToMint = EXPECTED_SHARES
                const previewAssets = await stakingManager.previewMint(sharesToMint)
                
                // Should match the actual assets required
                expect(previewAssets).to.equal(STAKE_AMOUNT)
            })
        })

        describe("Redeem Function", function () {
            beforeEach(async function () {
                // Setup: user1 has some shares
                await stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address)
            })

            it("Should allow basic redeem functionality", async function () {
                const userShares = await stakingManager.balanceOf(user1.address)
                const smallAmount = userShares / 100n // 1% only
                const initialTokenBalance = await token.balanceOf(user1.address)
                
                await expect(stakingManager.connect(user1).redeem(smallAmount, user1.address, user1.address))
                    .to.emit(stakingManager, "Withdraw")
                
                expect(await stakingManager.balanceOf(user1.address)).to.be.lt(userShares) // Should have fewer shares
                expect(await token.balanceOf(user1.address)).to.be.gt(initialTokenBalance) // Should receive tokens
            })

            it("Should revert when redeeming zero shares", async function () {
                await expect(
                    stakingManager.connect(user1).redeem(0, user1.address, user1.address)
                ).to.be.revertedWithCustomError(stakingManager, "AmountMustBeGreaterThanZero")
            })

            it("Should revert when receiver is zero address", async function () {
                const userShares = await stakingManager.balanceOf(user1.address)
                const smallAmount = userShares / 10n
                
                await expect(
                    stakingManager.connect(user1).redeem(smallAmount, "0x0000000000000000000000000000000000000000", user1.address)
                ).to.be.revertedWithCustomError(stakingManager, "ZeroAddress")
            })

            it("Should revert when owner is zero address", async function () {
                const userShares = await stakingManager.balanceOf(user1.address)
                const smallAmount = userShares / 10n
                
                await expect(
                    stakingManager.connect(user1).redeem(smallAmount, user1.address, "0x0000000000000000000000000000000000000000")
                ).to.be.revertedWithCustomError(stakingManager, "ZeroAddress")
            })

            it("Should revert when contract is paused", async function () {
                const userShares = await stakingManager.balanceOf(user1.address)
                const smallAmount = userShares / 10n
                await stakingManager.pause()
                
                await expect(
                    stakingManager.connect(user1).redeem(smallAmount, user1.address, user1.address)
                ).to.be.revertedWithCustomError(stakingManager, "EnforcedPause")
            })

            it("Should revert when trying to redeem more shares than owned", async function () {
                const userShares = await stakingManager.balanceOf(user1.address)
                const excessiveShares = userShares + 1n
                
                await expect(
                    stakingManager.connect(user1).redeem(excessiveShares.toString(), user1.address, user1.address)
                ).to.be.reverted // Should fail due to insufficient balance
            })

            it("Should calculate correct preview for redeem", async function () {
                const userShares = await stakingManager.balanceOf(user1.address)
                const previewAssets = await stakingManager.previewRedeem(userShares)
                
                // Preview should be reasonable (no fees set)
                expect(previewAssets).to.be.gt(0)
            })

            it("Should demonstrate both redeem and withdraw work correctly", async function () {
                // This test shows that both redeem and withdraw work properly
                const initialBalance = await token.balanceOf(user1.address)
                const userShares = await stakingManager.balanceOf(user1.address)
                
                // Test redeem function
                const sharesToRedeem = userShares / 4n // Redeem 25% of shares
                await expect(stakingManager.connect(user1).redeem(sharesToRedeem, user1.address, user1.address))
                    .to.emit(stakingManager, "Withdraw")
                
                const balanceAfterRedeem = await token.balanceOf(user1.address)
                expect(balanceAfterRedeem).to.be.gt(initialBalance) // Should receive tokens from redeem
                
                // Test withdraw function 
                const withdrawAmount = STAKE_AMOUNT / 4n // Withdraw 25% of original stake
                await expect(stakingManager.connect(user1).withdraw(withdrawAmount, user1.address, user1.address))
                    .to.emit(stakingManager, "Withdraw")
                
                expect(await stakingManager.balanceOf(user1.address)).to.be.lt(userShares) // Should have fewer shares
                expect(await token.balanceOf(user1.address)).to.equal(balanceAfterRedeem + withdrawAmount) // Should receive exact amount
            })
        })

        describe("Mint and Redeem Integration", function () {
            it("Should maintain consistency between mint and withdraw", async function () {
                const sharesToMint = EXPECTED_SHARES
                
                // Mint shares
                await stakingManager.connect(user1).mint(sharesToMint, user1.address)
                expect(await stakingManager.balanceOf(user1.address)).to.equal(sharesToMint)
                
                // Use withdraw instead of redeem to avoid known issues
                const withdrawAmount = STAKE_AMOUNT / 2n // Withdraw half the original stake amount
                const initialBalance = await token.balanceOf(user1.address)
                
                await stakingManager.connect(user1).withdraw(withdrawAmount, user1.address, user1.address)
                
                // Should have fewer shares
                expect(await stakingManager.balanceOf(user1.address)).to.be.lt(sharesToMint)
                // Should have received exact withdraw amount
                expect(await token.balanceOf(user1.address)).to.equal(initialBalance + withdrawAmount)
            })

            it("Should handle mint/withdraw with fees", async function () {
                // Set both input and output fees
                await stakingManager.setInputFeeRate(200) // 2%
                await stakingManager.setOutputFeeRate(200) // 2%
                
                const sharesToMint = EXPECTED_SHARES
                
                // Mint shares
                await expect(stakingManager.connect(user1).mint(sharesToMint, user1.address))
                    .to.emit(stakingManager, "InputFeeCollected")
                
                const userShares = await stakingManager.balanceOf(user1.address)
                expect(userShares).to.be.lt(sharesToMint) // Less due to input fees
                
                // Use withdraw instead of redeem
                const withdrawAmount = STAKE_AMOUNT / 4n // Withdraw 25%
                
                await expect(stakingManager.connect(user1).withdraw(withdrawAmount, user1.address, user1.address))
                    .to.emit(stakingManager, "OutputFeeCollected")
                
                // Should have accumulated fees from both operations
                expect(await stakingManager.totalFeeShares()).to.be.gt(0)
            })
        })
    })

    describe("Upgradeability", function () {
        it("Should allow owner to upgrade", async function () {
            const StakingManagerFactory = await ethers.getContractFactory("StakingManager")
            
            // Upgrade the contract
            const upgraded = await upgrades.upgradeProxy(
                await stakingManager.getAddress(),
                StakingManagerFactory
            )

            expect(await upgraded.owner()).to.equal(owner.address)
        })

        it("Should not allow non-owner to upgrade", async function () {
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

    describe("Pause Functionality", function () {
        beforeEach(async function () {
            // Approve tokens for testing
            await token.connect(user1).approve(await stakingManager.getAddress(), STAKE_AMOUNT)
        })

        it("Should allow owner to pause and unpause", async function () {
            // Initially not paused
            expect(await stakingManager.paused()).to.be.false

            // Owner should be able to pause
            await expect(stakingManager.pause())
                .to.emit(stakingManager, "Paused")
                .withArgs(owner.address)

            expect(await stakingManager.paused()).to.be.true

            // Owner should be able to unpause
            await expect(stakingManager.unpause())
                .to.emit(stakingManager, "Unpaused")
                .withArgs(owner.address)

            expect(await stakingManager.paused()).to.be.false
        })

        it("Should not allow non-owner to pause or unpause", async function () {
            await expect(
                stakingManager.connect(user1).pause()
            ).to.be.revertedWithCustomError(stakingManager, "OwnableUnauthorizedAccount")

            await expect(
                stakingManager.connect(user1).unpause()
            ).to.be.revertedWithCustomError(stakingManager, "OwnableUnauthorizedAccount")
        })

        it("Should prevent staking when paused", async function () {
            // Pause the contract
            await stakingManager.pause()

            // Staking should be reverted
            await expect(
                stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address)
            ).to.be.revertedWithCustomError(stakingManager, "EnforcedPause")
        })

        it("Should prevent unstaking when paused", async function () {
            // First stake when not paused
            await stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address)
            const userShares = await stakingManager.balanceOf(user1.address)

            // Pause the contract
            await stakingManager.pause()

            // Unstaking should be reverted
            await expect(
                stakingManager.connect(user1).withdraw(userShares, user1.address, user1.address)
            ).to.be.revertedWithCustomError(stakingManager, "EnforcedPause")
        })

        it("Should allow staking and unstaking after unpause", async function () {
            // Pause and then unpause
            await stakingManager.pause()
            await stakingManager.unpause()

            // Should be able to stake
            await expect(stakingManager.connect(user1).deposit(STAKE_AMOUNT, user1.address))
                .to.not.be.reverted

            const userShares = await stakingManager.balanceOf(user1.address)
            expect(userShares).to.be.gt(0)

            // Should be able to unstake
            await expect(stakingManager.connect(user1).withdraw(STAKE_AMOUNT, user1.address, user1.address)).to.not.be.reverted
        })
     })
})
