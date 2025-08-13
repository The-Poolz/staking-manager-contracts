// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

interface IStakingManager {
    /**
     * @notice Stake assets in the vault.
     * @param assets The amount of assets to stake.
     */
    function stake(uint256 assets) external;

    /**
     * @notice Unstake shares and receive the underlying assets.
     * @param shares The number of shares to unstake.
     */
    function unstake(uint256 shares) external;
}
