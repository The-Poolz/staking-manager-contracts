// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "./StakingAdmin.sol";

/**
 * @title StakingInternal
 * @dev Internal functions for the StakingManager contract.
 */
contract StakingInternal is StakingAdmin {
    function _processDeposit(
        uint256 assets,
        uint256 shares,
        address receiver
    ) internal {
        // step 1: Preview vault shares for the assets being deposited
        uint256 vaultShare = stakingVault.previewDeposit(assets);

        // step 2: Calculate fee amount based on input fee rate
        uint256 feeAmount = _calculateFeeAmount(assets, inputFeeRate);

        // step 3: Split shares between user and fee
        uint256 feeShares = _feeShares(vaultShare, assets, feeAmount);
        uint256 userShares = _userShares(shares, assets, feeAmount);

        _handleInputFeeShares(feeAmount, feeShares);

        // step 4: Mint user shares and deposit assets into vault
        _deposit(_msgSender(), receiver, assets, userShares);
        _depositIntoVault(assets);
    }

    function _processWithdrawal(
        uint256 assets,
        uint256 shares,
        address receiver,
        address owner,
        bool isWithdraw
    ) internal {
        // Step 1: Calculate fee amount
        uint256 feeAmount = _calculateFeeAmount(assets, outputFeeRate);

        // Step 2: Split shares between user and fee
        uint256 feeShares;
        uint256 userShares;
        uint256 userAssets;

        if (isWithdraw) {
            // For withdraw: calculate based on gross assets from all shares
            uint256 grossAssets = stakingVault.previewRedeem(shares);
            (feeShares, userShares) = _splitShares(shares, grossAssets, feeAmount);
            userAssets = assets;
        } else {
            // For redeem: calculate based on the provided shares and assets
            feeShares = _feeShares(shares, assets, feeAmount);
            userShares = shares - feeShares;
            userAssets = assets - feeAmount;
        }

        // Step 3: Handle the output fee shares
        _handleOutputFeeShares(feeAmount, feeShares);

        // Step 4: Execute the withdrawal/redeem operation
        if (isWithdraw) {
            uint256 actualShares = previewWithdraw(assets); // calculate before redeeming to avoid rounding issues
            uint256 actualAssets = stakingVault.redeem(userShares, address(this),address(this));
            _withdraw(_msgSender(), receiver, owner, actualAssets, actualShares);
        } else {
            stakingVault.withdraw(userAssets, address(this), address(this));
            _withdraw(_msgSender(), receiver, owner, userAssets, userShares);
        }
    }
}
