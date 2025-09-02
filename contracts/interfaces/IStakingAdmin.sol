// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

interface IStakingAdmin {
    /**
     * @notice Set the input fee rate for staking operations.
     * @param _inputFeeRate The new input fee rate in basis points.
     */
    function setInputFeeRate(uint256 _inputFeeRate) external;

    /**
     * @notice Set the output fee rate for unstaking operations.
     * @param _outputFeeRate The new output fee rate in basis points.
     */
    function setOutputFeeRate(uint256 _outputFeeRate) external;

    /**
     * @notice Withdraw staked fee shares by redeeming them for assets.
     * @param recipient The address to receive the redeemed assets.
     * @param shares The number of fee shares to redeem.
     */
    function withdrawFeeShares(address recipient, uint256 shares) external;

    /**
     * @notice Get the total assets from staked fees.
     * @return The total assets that can be redeemed from fee shares.
     */
    function totalFeeAssets() external view returns (uint256);

    /**
     * @notice Pause stake and unstake operations.
     */
    function pause() external;

    /**
     * @notice Unpause stake and unstake operations.
     */
    function unpause() external;
}
