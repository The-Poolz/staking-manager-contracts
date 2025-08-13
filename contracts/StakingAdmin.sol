// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./StakingProxy.sol";
import "./StakingState.sol";
import "./StakingModifiers.sol";
import "./interfaces/IStakingAdmin.sol";
import "./interfaces/Events.sol";

abstract contract StakingAdmin is IStakingAdmin, StakingProxy, StakingState, StakingModifiers {
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
     * @dev Allows the owner to withdraw accumulated fees.
     * @param recipient The address to receive the fees.
     */
    function withdrawFees(address recipient) external onlyOwner notZeroAddress(recipient) validFee(accumulatedFees) {
        uint256 feesToWithdraw = accumulatedFees;
        accumulatedFees = 0;
        
        token.safeTransfer(recipient, feesToWithdraw);
        
        emit Events.FeesWithdrawn(recipient, feesToWithdraw);
    }
}
