// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./StakingAdmin.sol";

/**
 * @title StakingManager
 * @dev Upgradeable staking contract that also acts as an ERC20 token representing staked shares.
 */
contract StakingManager is StakingAdmin {
    using SafeERC20 for IERC20;
    using Math for uint256;

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
        nonReentrant
        whenNotPaused
        returns (uint256 shares)
    {
        shares = previewDeposit(assets);
        uint256 vaultShare = stakingVault.previewDeposit(assets);
        // Calculate fee and deposit all assets into vault
        uint256 feeAmount = _calculateFeeAmount(assets, inputFeeRate);
        // Split shares between user and fee recipient
        uint256 feeShares = _feeShares(vaultShare, assets, feeAmount);
        uint256 userShares = _userShares(shares, assets, feeAmount);

        _handleInputFeeShares(feeAmount, feeShares);

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
        nonReentrant
        whenNotPaused
        returns (uint256 shares)
    {
        // Preview the total assets we would get from redeeming all shares
        shares = stakingVault.previewWithdraw(assets);
        uint256 grossAssets = stakingVault.previewRedeem(shares);
        // Calculate fee amount
        uint256 feeAmount = _calculateFeeAmount(grossAssets, outputFeeRate);
        (uint256 feeShares, uint256 userShares) = _splitShares(shares, grossAssets, feeAmount);
        _handleOutputFeeShares(feeAmount, feeShares);

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
        nonReentrant
        whenNotPaused
        returns (uint256 assets)
    {
        // Preview assets required to mint given shares
        assets = previewMint(shares);
        uint256 vaultShare = stakingVault.previewDeposit(assets);

        // Calculate fee on the assets being deposited
        uint256 feeAmount = _calculateFeeAmount(assets, inputFeeRate);
        uint256 feeShares = _feeShares(vaultShare, assets, feeAmount);
        uint256 userShares = _userShares(shares, assets, feeAmount);

        // Handle fee logic
        _handleInputFeeShares(feeAmount, feeShares);

        // Mint user shares and deposit assets
        _mint(receiver, userShares);
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
        nonReentrant
        whenNotPaused
        returns (uint256 assets)
    {
        // Step 1: Preview how many assets the shares correspond to
        assets = previewRedeem(shares);

        // Step 2: Calculate fee on the assets to be redeemed
        uint256 feeAmount = _calculateFeeAmount(assets, outputFeeRate);

        // Step 3: Split shares between fee and user
        (uint256 feeShares, uint256 userShares) = _splitShares(shares, assets, feeAmount); 

        // Step 4: Handle the output fee
        _handleOutputFeeShares(feeAmount, feeShares);

        // Step 5: Redeem shares from the vault for the user
        uint256 redeemedAssets = stakingVault.redeem(userShares, address(this), address(this));

        // Step 6: Transfer redeemed assets to the receiver and burn user shares
        _withdraw(_msgSender(), receiver, owner, redeemedAssets, userShares);
    }
}
