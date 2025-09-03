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
}
