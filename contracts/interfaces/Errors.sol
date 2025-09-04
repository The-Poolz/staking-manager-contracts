// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

interface Errors {
    /// @notice Error thrown when attempting to stake or unstake zero assets or shares.
    error AmountMustBeGreaterThanZero();

    /// @notice Error thrown when the user doesn't have enough shares to unstake.
    error InsufficientShares();

    /// @notice Error thrown when setting a zero address for the vault or token.
    error ZeroAddress();

    /// @notice Error thrown when setting an invalid fee rate.
    error InvalidFeeRate();

    /// @notice Error thrown when there are no fees to withdraw.
    error NoFeesToWithdraw();

    /// @notice Error thrown when trying to withdraw more fee shares than available.
    error InsufficientFeeShares();

    /// @notice Error thrown when the new vault has the same asset as the current vault.
    error SameVaultAsset();

    /// @notice Error thrown when the new vault has a different asset than the current vault.
    error DifferentVaultAsset();

    /// @notice Error thrown when trying to migrate with no assets in the current vault.
    error NoAssetsToMigrate();
}
