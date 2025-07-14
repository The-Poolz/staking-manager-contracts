// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "./interfaces/IStakingManager.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC4626.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

abstract contract StakingState is IStakingManager, ERC20 {
    // The vault where assets are staked
    IERC4626 public immutable stakingVault;

    // The token that is being staked
    IERC20 public immutable token;

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

    /**
     * @dev Returns the total assets staked by a user.
     * @param user The address of the user.
     * @return The total assets staked by the user.
     */
    function totalUserAssets(address user) external view returns (uint256) {
        return stakingVault.previewRedeem(balanceOf(user));
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
     * @dev Calculates the fee amount for a given asset amount and fee rate.
     * @param assets The amount of assets to calculate the fee for.
     * @param feeRate The fee rate in basis points to apply.
     * @return feeAmount The fee amount to be collected.
     * @return netAssets The net assets after fee deduction.
     */
    function _calculateFee(uint256 assets, uint256 feeRate) internal pure returns (uint256 feeAmount, uint256 netAssets) {
        feeAmount = (assets * feeRate) / 10000;
        netAssets = assets - feeAmount;
    }

    /**
     * @dev Calculates the input fee amount for staking operations.
     * @param assets The amount of assets to calculate the fee for.
     * @return feeAmount The fee amount to be collected.
     * @return netAssets The net assets after fee deduction.
     */
    function _calculateInputFee(uint256 assets) internal view returns (uint256 feeAmount, uint256 netAssets) {
        return _calculateFee(assets, inputFeeRate);
    }

    /**
     * @dev Calculates the output fee amount for unstaking operations.
     * @param assets The amount of assets to calculate the fee for.
     * @return feeAmount The fee amount to be collected.
     * @return netAssets The net assets after fee deduction.
     */
    function _calculateOutputFee(uint256 assets) internal view returns (uint256 feeAmount, uint256 netAssets) {
        return _calculateFee(assets, outputFeeRate);
    }
}
