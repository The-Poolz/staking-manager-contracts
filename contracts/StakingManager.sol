// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "./StakingInternal.sol";

/**
 * @title StakingManager
 * @dev Upgradeable staking contract that also acts as an ERC20 token representing staked shares.
 */
contract StakingManager is StakingInternal {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Returns the decimals offset used for share calculations
     * @return uint8 The number of decimal places offset between assets and shares
     */
    function _decimalsOffset() internal view override returns (uint8) {
        return DECIMALS_OFFSET;
    }

    /**
     * @dev Deposit assets to receive staking shares
     * @param assets Amount of assets to deposit
     * @param receiver Address that will receive the minted shares
     * @return shares Amount of shares minted to the receiver
     */
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
        // Calculate shares based on current exchange rate
        shares = previewDeposit(assets);
        // Process the deposit including fee calculations and vault interactions
        _processDeposit(assets, shares, receiver);
    }

    /**
     * @dev Withdraws assets by burning the corresponding shares.
     * @param assets Amount of assets to withdraw
     * @param receiver Address that will receive the withdrawn assets
     * @param owner Address that owns the shares being burned
     * @return shares Amount of shares burned for the withdrawal
     */
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
        // Calculate shares required to withdraw the requested assets
        shares = stakingVault.previewWithdraw(assets);
        // Process withdrawal including fee calculations and vault interactions
        _processWithdrawal(assets, shares, receiver, owner, true);
    }

    /**
     * @dev Mint shares by depositing the equivalent amount of assets
     * @param shares Amount of shares to mint
     * @param receiver Address that will receive the minted shares
     * @return assets Amount of assets required to mint the requested shares
     */
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
        // Calculate assets required to mint the requested shares
        assets = previewMint(shares);
        // Process the deposit including fee calculations and vault interactions
        _processDeposit(assets, shares, receiver);
    }

    /**
     * @dev Redeem shares for equivalent assets
     * @param shares Amount of shares to redeem
     * @param receiver Address that will receive the redeemed assets
     * @param owner Address that owns the shares being redeemed
     * @return assets Amount of assets received for the redeemed shares
     */
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
        // Calculate assets equivalent to the shares being redeemed
        assets = previewRedeem(shares);
        // Process redemption including fee calculations and vault interactions
        _processWithdrawal(assets, shares, receiver, owner, false);
    }
}