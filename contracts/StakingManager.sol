// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./StakingModifiers.sol";

contract StakingManager is Ownable, StakingModifiers {
    using SafeERC20 for IERC20;
    /**
     * @dev Initializes the contract with the stacking vault address.
     * @param _stackingVault The address of the IERC4626 vault where assets will be staked.
     */
    constructor(IERC4626 _stackingVault) Ownable(_msgSender()) {
        if (address(_stackingVault) == address(0)) revert ZeroAddress();

        stackingVault = _stackingVault;
        token = IERC20(_stackingVault.asset());
        emit StakingVaultSet(_stackingVault, token);
    }

    /**
     * @dev Allows users to stake assets in the vault.
     * @param assets The amount of assets to stake.
     */
    function stake(uint256 assets) external amountGreaterThanZero(assets) {
        token.safeTransferFrom(msg.sender, address(this), assets);
        // Approve the vault to spend the assets
        token.forceApprove(address(stackingVault), assets);
        // Deposit into vault as this contract
        uint256 shares = stackingVault.deposit(assets, address(this));
        // Zero out the approval to prevent re-entrancy
        token.forceApprove(address(stackingVault), 0);

        userShares[msg.sender] += shares;

        emit Stake(msg.sender, assets, shares);
    }

    /**
     * @dev Allows users to unstake their shares and receive the underlying assets.
     * @param shares The number of shares to unstake.
     */
    function unstake(
        uint256 shares
    )
        external
        amountGreaterThanZero(shares)
        hasEnoughShares(userShares, msg.sender, shares)
    {
        userShares[msg.sender] -= shares;

        // Withdraw from vault to this contract
        uint256 assets = stackingVault.redeem(
            shares,
            address(this),
            address(this)
        );

        // Send tokens to user
        token.safeTransfer(msg.sender, assets);

        emit Unstake(msg.sender, shares, assets);
    }
}
