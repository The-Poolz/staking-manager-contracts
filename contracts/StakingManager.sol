// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "./StakingAdmin.sol";

/**
 * @title StakingManager
 * @dev Upgradeable staking contract that also acts as an ERC20 token representing staked shares.
 */
contract StakingManager is StakingAdmin {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function _decimalsOffset() internal view override returns (uint8) {
        return DECIMALS_OFFSET;
    }

    // stake assets and receive shares
    function deposit(
        uint256 assets,
        address receiver
    )
        public
        override
        amountGreaterThanZero(assets)
        notZeroAddress(receiver)
        nonReentrant
        whenNotPaused
        returns (uint256 shares)
    {
        // step 1: preview shares to be minted
        shares = previewDeposit(assets);
        // step 2: preview vault shares for the assets being deposited
        uint256 vaultShare = stakingVault.previewDeposit(assets);
        // step 3: Calculate fee amount based on input fee rate
        uint256 feeAmount = _calculateFeeAmount(assets, inputFeeRate);
        // step 4: Split shares between user and fee
        uint256 feeShares = _feeShares(vaultShare, assets, feeAmount);
        uint256 userShares = _userShares(shares, assets, feeAmount);
        _handleInputFeeShares(feeAmount, feeShares);
        // step 5: Mint user shares and deposit assets into vault
        _deposit(_msgSender(), receiver, assets, userShares);
        _depositIntoVault(assets);
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    )
        public
        override
        amountGreaterThanZero(assets)
        notZeroAddress(receiver)
        notZeroAddress(owner)
        nonReentrant
        whenNotPaused
        returns (uint256 shares)
    {
        // step 1: Preview shares needed to withdraw the requested assets
        shares = stakingVault.previewWithdraw(assets);
        // step 2: Preview the total assets we would get from redeeming all shares
        uint256 grossAssets = stakingVault.previewRedeem(shares);
        // step 3: Calculate fee amount
        uint256 feeAmount = _calculateFeeAmount(grossAssets, outputFeeRate);
        // step 4: Split shares between user and fee
        (uint256 feeShares, uint256 userShares) = _splitShares(shares, grossAssets, feeAmount);
        _handleOutputFeeShares(feeAmount, feeShares);
        // step 5: Redeem shares from vault and transfer assets to receiver
        uint256 actualShares = previewWithdraw(grossAssets); // calculate before redeeming to avoid rounding issues
        uint256 actualAssets = stakingVault.redeem(userShares, address(this), address(this));
        _withdraw(_msgSender(), receiver, owner, actualAssets, actualShares);
    }

    function mint(
        uint256 shares,
        address receiver
    )
        public
        override
        amountGreaterThanZero(shares)
        notZeroAddress(receiver)
        nonReentrant
        whenNotPaused
        returns (uint256 assets)
    {
        // step 1: Preview how many assets the shares correspond to
        assets = previewMint(shares);
        // step 2: Preview vault shares for the assets being deposited
        uint256 vaultShare = stakingVault.previewDeposit(assets);
        // step 3: Calculate fee on the assets being deposited
        uint256 feeAmount = _calculateFeeAmount(assets, inputFeeRate);
        uint256 feeShares = _feeShares(vaultShare, assets, feeAmount);
        uint256 userShares = _userShares(shares, assets, feeAmount);
        _handleInputFeeShares(feeAmount, feeShares);
        // step 4: Mint user shares and deposit assets into vault
        _deposit(_msgSender(), receiver, assets, userShares);
        _depositIntoVault(assets);
    }

    function redeem(
        uint256 shares,
        address receiver,
        address owner
    )
        public
        override
        amountGreaterThanZero(shares)
        notZeroAddress(receiver)
        notZeroAddress(owner)
        nonReentrant
        whenNotPaused
        returns (uint256 assets)
    {
        // Step 1: Preview how many assets the shares correspond to
        assets = previewRedeem(shares);
        // Step 2: Calculate fee on the assets to be redeemed
        uint256 feeAmount = _calculateFeeAmount(assets, outputFeeRate);
        // Step 3: Split shares between fee and user
        uint256 feeShares = _feeShares(shares, assets, feeAmount);
        uint256 userShares = shares - feeShares;
        uint256 userAssets = assets - feeAmount;
        // Step 4: Handle the output fee shares
        _handleOutputFeeShares(feeAmount, feeShares);
        // Step 5: Withdraw assets from the vault for the user (not redeem shares)
        stakingVault.withdraw(userAssets, address(this), address(this));
        // Step 6: Transfer redeemed assets to the receiver and burn user shares
        _withdraw(_msgSender(), receiver, owner, userAssets, userShares);
    }
}
