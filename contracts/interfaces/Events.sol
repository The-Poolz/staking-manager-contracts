// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/interfaces/IERC4626.sol";

interface Events {
    /// @notice Emitted when the staking vault is set.
    event StakingVaultSet(IERC4626 stakingVault, IERC20 token);

    /// @notice Emitted when fees are collected during staking.
    event InputFeeCollected(uint256 feeAmount, uint256 feeShares);

    /// @notice Emitted when fees are collected during unstaking.
    event OutputFeeCollected(uint256 feeAmount, uint256 feeShares);

    /// @notice Emitted when the input fee rate is updated.
    event InputFeeRateUpdated(uint256 oldFeeRate, uint256 newFeeRate);

    /// @notice Emitted when the output fee rate is updated.
    event OutputFeeRateUpdated(uint256 oldFeeRate, uint256 newFeeRate);

    /// @notice Emitted when fees are withdrawn.
    event FeesWithdrawn(address indexed recipient, uint256 amount);

    /// @notice Emitted when fee shares are withdrawn and redeemed for assets.
    event FeeSharesWithdrawn(address indexed recipient, uint256 shares, uint256 assets);

    /// @notice Emitted when vault migration is completed.
    event VaultMigrationCompleted(
        IERC4626 oldVault, 
        IERC4626 newVault, 
        uint256 totalAssetsRedeemed, 
        uint256 newSharesReceived
    );
}
