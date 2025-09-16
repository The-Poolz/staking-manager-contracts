// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./StakingProxy.sol";
import "./interfaces/IStakingAdmin.sol";
import "./interfaces/Errors.sol";

abstract contract StakingAdmin is IStakingAdmin, StakingProxy {
    using SafeERC20 for IERC20;
    /**
     * @dev Allows the owner to set the input fee rate for staking operations.
     * @param _inputFeeRate The new input fee rate in basis points (1 basis point = 0.01%).
     */
    function setInputFeeRate(uint256 _inputFeeRate) external onlyOwner {
        if (_inputFeeRate > MAX_FEE_RATE) revert Errors.InvalidFeeRate();
        
        uint256 oldFeeRate = inputFeeRate;
        inputFeeRate = _inputFeeRate;
        
        emit Events.InputFeeRateUpdated(oldFeeRate, _inputFeeRate);
    }

    /**
     * @dev Allows the owner to set the output fee rate for unstaking operations.
     * @param _outputFeeRate The new output fee rate in basis points (1 basis point = 0.01%).
     */
    function setOutputFeeRate(uint256 _outputFeeRate) external onlyOwner {
        if (_outputFeeRate > MAX_FEE_RATE) revert Errors.InvalidFeeRate();
        
        uint256 oldFeeRate = outputFeeRate;
        outputFeeRate = _outputFeeRate;
        
        emit Events.OutputFeeRateUpdated(oldFeeRate, _outputFeeRate);
    }

    /**
     * @dev Allows the owner to withdraw staked fee shares by redeeming them for assets.
     * @param recipient The address to receive the redeemed assets.
     * @param shares The number of fee shares to redeem.
     */
    function withdrawFeeShares(address recipient, uint256 shares) external onlyOwner notZeroAddress(recipient) amountGreaterThanZero(shares) {
        if (shares > totalFeeShares) revert Errors.InsufficientFeeShares();
        
        // Update total fee shares
        totalFeeShares -= shares;
        // Redeem shares for assets
        uint256 assets = stakingVault.redeem(shares, address(this), address(this));
        // Transfer assets to recipient
        token.safeTransfer(recipient, assets);
        
        emit Events.FeeSharesWithdrawn(recipient, shares, assets);
    }

    /**
     * @dev Returns the total assets from staked fees.
     * @return The total assets that can be redeemed from fee shares.
     */
    function totalFeeAssets() external view returns (uint256) {
        return stakingVault.previewRedeem(totalFeeShares);
    }

    /**
     * @dev Pauses stake and unstake operations. Can only be called by the owner.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses stake and unstake operations. Can only be called by the owner.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Migrates all staked assets from the current vault to a new vault.
     * This function handles the complexity of different exchange rates between vaults.
     * @param newVault The new IERC4626 vault to migrate to.
     */
    function migrateVault(IERC4626 newVault) 
        external 
        onlyOwner 
        notZeroAddress(address(newVault))
        notSameVault(address(newVault), address(stakingVault))
        validAssets(newVault.asset(), stakingVault.asset())
    {
        IERC4626 oldVault = stakingVault;
        uint256 totalShares = oldVault.balanceOf(address(this));
        if (totalShares == 0) revert Errors.NoAssetsToMigrate();
        // Redeem all shares from the old vault
        uint256 totalAssetsRedeemed = oldVault.redeem(totalShares, address(this), address(this));
        // Update the vault reference
        stakingVault = newVault;
        // Deposit all redeemed assets into the new vault
        uint256 newSharesReceived = _depositIntoVault(totalAssetsRedeemed);
        emit Events.VaultMigrationCompleted(oldVault, newVault, totalAssetsRedeemed, newSharesReceived);
    }

    /**
     * @dev Returns migration information for the current vault state.
     * @param newVault The potential new vault to migrate to.
     * @return currentAssets Current total assets in the vault.
     * @return currentShares Current total shares in the vault.
     * @return projectedAssets Projected assets after migration.
     * @return projectedShares Projected shares after migration.
     */
    function getMigrationInfo(IERC4626 newVault) external view returns (
        uint256 currentAssets,
        uint256 currentShares,
        uint256 projectedAssets,
        uint256 projectedShares
    ) {
        currentShares = stakingVault.balanceOf(address(this));
        currentAssets = stakingVault.previewRedeem(currentShares);
        if (currentAssets > 0) {
            projectedShares = newVault.previewDeposit(currentAssets);
            projectedAssets = newVault.previewRedeem(projectedShares);
        }
    }
}
