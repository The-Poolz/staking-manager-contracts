// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC4626.sol";
import "./interfaces/Events.sol";

abstract contract StakingState {
    using SafeERC20 for IERC20;
    // The vault where assets are staked (stored in storage for upgradeable contracts)
    IERC4626 public stakingVault;

    // The token that is being staked (stored in storage for upgradeable contracts)
    IERC20 public token;

    // Input fee rate in basis points (1 basis point = 0.01%, 10000 = 100%)
    // Applied when staking
    uint256 public inputFeeRate;

    // Output fee rate in basis points (1 basis point = 0.01%, 10000 = 100%)
    // Applied when unstaking
    uint256 public outputFeeRate;

    // Maximum fee rate (10% = 1000 basis points)
    uint256 public constant MAX_FEE_RATE = 1000;

    // Accumulated fees available for withdrawal
    uint256 public accumulatedFees;

    // Total shares minted from staked fees
    uint256 public totalFeeShares;

    /**
     * @dev Returns the total assets staked by a user.
     * @param user The address of the user.
     * @return The total assets staked by the user.
     */
    function totalUserAssets(address user) external view returns (uint256) {
        return stakingVault.previewRedeem(IERC20(address(this)).balanceOf(user));
    }

    /**
     * @dev Returns the total assets in the vault.
     * This is the total amount of assets that have been staked in the vault from stakingManager.
     * It is calculated by converting the total shares of the contract into assets.
     * @return The total assets in the vault.
     */
    function totalAssets() external view returns (uint256) {
        return stakingVault.convertToAssets(stakingVault.balanceOf(address(this)));
    }

    /**
     * @dev Calculates the fee amount based on the assets and fee rate.
     * @param assets The amount of assets to calculate the fee for.
     * @param feeRate The fee rate in basis points.
     * @return feeAmount The calculated fee amount.
     */
    function _calculateFeeAmount(
        uint256 assets,
        uint256 feeRate
    ) internal pure returns (uint256 feeAmount) {
        feeAmount = (assets * feeRate) / 10000;
    }

    /**
     * @dev Calculates the net assets after fee deduction.
     * @param assets The amount of assets to calculate the fee for.
     * @param feeAmount The fee amount to be deducted.
     * @return netAssets The net assets after fee deduction.
     *
     */
    function _calculateFeeAssets(
        uint256 assets,
        uint256 feeAmount
    ) internal pure returns (uint256 netAssets) {
        netAssets = assets - feeAmount;
    }
    
    function _depositIntoVault(
        uint256 assets
    ) internal returns (uint256 totalShares) {
        token.forceApprove(address(stakingVault), assets);
        totalShares = stakingVault.deposit(assets, address(this));
        token.forceApprove(address(stakingVault), 0);
    }

    function _splitShares(
        uint256 totalShares,
        uint256 assets,
        uint256 feeAmount
    ) internal pure returns (uint256 userShares, uint256 feeShares) {
        feeShares = (totalShares * feeAmount) / assets;
        userShares = totalShares - feeShares;
    }

    function _handleFeeShares(uint256 feeAmount, uint256 feeShares) internal {
        if (feeAmount > 0) {
            totalFeeShares += feeShares;
            emit Events.InputFeeCollected(feeAmount, feeShares);
        }
    }

    function _applyOutputFee(
        uint256 grossAssets
    ) internal view returns (uint256 netAssets, uint256 feeAmount) {
        feeAmount = _calculateFeeAmount(grossAssets, outputFeeRate);
        netAssets = grossAssets - feeAmount;
    }

    function _handleOutputFee(uint256 feeAmount) internal {
        if (feeAmount == 0) return;

        token.forceApprove(address(stakingVault), feeAmount);
        uint256 feeShares = stakingVault.deposit(feeAmount, address(this));
        token.forceApprove(address(stakingVault), 0);

        totalFeeShares += feeShares;
        emit Events.OutputFeeCollected(feeAmount, feeShares);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
