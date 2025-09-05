// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./StakingProxy.sol";
import "./StakingState.sol";
import "./StakingModifiers.sol";
import "./interfaces/IStakingAdmin.sol";
import "./interfaces/Errors.sol";

abstract contract StakingAdmin is IStakingAdmin, StakingProxy, StakingState, StakingModifiers, PausableUpgradeable {
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
    function migrateVault(IERC4626 newVault) external onlyOwner notZeroAddress(address(newVault)) {
        // Validate that the new vault uses the same asset
        if (newVault.asset() != stakingVault.asset()) revert Errors.DifferentVaultAsset();
        if (address(newVault) == address(stakingVault)) revert Errors.SameVaultAsset();

        // Get current vault balances
        uint256 totalShares = stakingVault.balanceOf(address(this));
        if (totalShares == 0) revert Errors.NoAssetsToMigrate();

        IERC4626 oldVault = stakingVault;
        // Redeem all shares from the old vault
        uint256 totalAssetsRedeemed = oldVault.redeem(totalShares, address(this), address(this));
        // Approve and deposit all assets into the new vault
        uint256 newSharesReceived = _depositIntoVault(totalAssetsRedeemed);

        // Calculate exchange rate impact
        uint256 newTotalAssets = newVault.previewRedeem(newSharesReceived);
        uint256 exchangeRateImpact = _calculateExchangeRateImpact(totalAssetsRedeemed, newTotalAssets);

        // Update the vault reference
        stakingVault = newVault;

        // Critical: Update the conversion factor to maintain user token value consistency
        // The new conversion factor ensures that staking tokens maintain their asset value
        // even though the underlying vault shares have changed
        uint256 oldConversionFactor = vaultShareConversionFactor;
        vaultShareConversionFactor = (vaultShareConversionFactor * newSharesReceived) / totalShares;

        // Adjust fee shares proportionally to maintain fee accounting accuracy
        totalFeeShares = (totalFeeShares * newSharesReceived) / totalShares;

        emit Events.VaultMigrationCompleted(
            oldVault,
            newVault,
            totalAssetsRedeemed,
            newSharesReceived,
            exchangeRateImpact,
            oldConversionFactor,
            vaultShareConversionFactor
        );
    }

    /**
     * @dev Calculates the exchange rate impact during vault migration.
     * @param assetsBefore Total assets before migration.
     * @param assetsAfter Total assets after migration.
     * @return impact The impact in basis points (positive = gain, negative = loss).
     */
    function _calculateExchangeRateImpact(
        uint256 assetsBefore,
        uint256 assetsAfter
    ) internal pure returns (uint256 impact) {
        if (assetsBefore == 0) return 0;
        
        if (assetsAfter >= assetsBefore) {
            // Gain
            impact = ((assetsAfter - assetsBefore) * 10000) / assetsBefore;
        } else {
            // Loss (represented as a very large number to indicate negative)
            impact = ((assetsBefore - assetsAfter) * 10000) / assetsBefore;
        }
    }

    /**
     * @dev Returns migration information for the current vault state.
     * @param newVault The potential new vault to migrate to.
     * @return currentAssets Current total assets in the vault.
     * @return currentShares Current total shares in the vault.
     * @return projectedAssets Projected assets after migration.
     * @return projectedShares Projected shares after migration.
     * @return exchangeRateImpact Estimated exchange rate impact.
     */
    function getMigrationInfo(IERC4626 newVault) external view returns (
        uint256 currentAssets,
        uint256 currentShares,
        uint256 projectedAssets,
        uint256 projectedShares,
        uint256 exchangeRateImpact
    ) {
        currentShares = stakingVault.balanceOf(address(this));
        currentAssets = stakingVault.previewRedeem(currentShares);
        
        if (currentAssets > 0) {
            projectedShares = newVault.previewDeposit(currentAssets);
            projectedAssets = newVault.previewRedeem(projectedShares);
            exchangeRateImpact = _calculateExchangeRateImpact(currentAssets, projectedAssets);
        }
    }
}
