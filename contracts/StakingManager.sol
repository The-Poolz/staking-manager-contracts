// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./StakingModifiers.sol";

/**
 * @title StakingManager
 * @dev Staking contract that also acts as an ERC20 token representing staked shares.
 */
contract StakingManager is Ownable, StakingModifiers {
    using SafeERC20 for IERC20;

    /**
     * @dev Initializes the contract with the staking vault address.
     * @param _stakingVault The address of the IERC4626 vault where assets will be staked.
     */
    constructor(
        IERC4626 _stakingVault,
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) Ownable(_msgSender()) {
        if (address(_stakingVault) == address(0)) revert ZeroAddress();

        stakingVault = _stakingVault;
        token = IERC20(_stakingVault.asset());
        feeRate = 0; // Initialize with 0% fee

        emit StakingVaultSet(_stakingVault, token);
    }

    /**
     * @dev Allows users to stake assets in the vault.
     * @param assets The amount of assets to stake.
     */
    function stake(uint256 assets) external amountGreaterThanZero(assets) {
        token.safeTransferFrom(msg.sender, address(this), assets);
        
        // Calculate fee and net assets
        (uint256 feeAmount, uint256 netAssets) = _calculateFee(assets);
        
        // Collect fee if applicable
        if (feeAmount > 0) {
            accumulatedFees += feeAmount;
            emit FeeCollected(feeAmount);
        }
        
        // Approve the staking vault to spend the net assets
        token.forceApprove(address(stakingVault), netAssets);
        // Deposit net assets into the staking vault and receive shares
        uint256 shares = stakingVault.deposit(netAssets, address(this));
        // Reset the approval to zero to prevent re-entrancy attacks
        token.forceApprove(address(stakingVault), 0);

        // Mint this ERC20 token as proof of ownership
        _mint(msg.sender, shares);

        emit Stake(msg.sender, assets, shares);
    }

    /**
     * @dev Allows users to unstake their shares and receive the underlying assets.
     * @param shares The number of shares to unstake.
     */
    function unstake(
        uint256 shares
    ) external amountGreaterThanZero(shares) hasEnoughShares(shares) {
        // Redeem shares for assets for the user
        uint256 assets = stakingVault.redeem(shares, msg.sender, address(this));
        // Burn the ERC20 staking token
        _burn(msg.sender, shares);
        emit Unstake(msg.sender, shares, assets);
    }

    /**
     * @dev Allows the owner to set the fee rate for staking operations.
     * @param _feeRate The new fee rate in basis points (1 basis point = 0.01%).
     */
    function setFeeRate(uint256 _feeRate) external onlyOwner {
        if (_feeRate > MAX_FEE_RATE) revert InvalidFeeRate();
        
        uint256 oldFeeRate = feeRate;
        feeRate = _feeRate;
        
        emit FeeRateUpdated(oldFeeRate, _feeRate);
    }

    /**
     * @dev Allows the owner to withdraw accumulated fees.
     * @param recipient The address to receive the fees.
     */
    function withdrawFees(address recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        if (accumulatedFees == 0) revert NoFeesToWithdraw();
        
        uint256 feesToWithdraw = accumulatedFees;
        accumulatedFees = 0;
        
        token.safeTransfer(recipient, feesToWithdraw);
        
        emit FeesWithdrawn(recipient, feesToWithdraw);
    }
}
