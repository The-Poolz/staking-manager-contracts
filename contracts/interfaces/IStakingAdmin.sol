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
     * @notice Withdraw accumulated fees.
     * @param recipient The address to receive the fees.
     */
    function withdrawFees(address recipient) external;

    /**
     * @notice Pause stake and unstake operations.
     */
    function pause() external;

    /**
     * @notice Unpause stake and unstake operations.
     */
    function unpause() external;
}
