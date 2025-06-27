// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./StakingModifiers.sol";

/**
 * @title StakingManager
 * @dev Staking contract that also acts as an ERC20 token representing staked shares.
 */
contract StakingManager is Ownable, StakingModifiers {
    using SafeERC20 for IERC20;

    /**
     * @dev Initializes the contract with the staking vault address.
     * @param _stakingVault The address of the IERC4626 vault where assets will be staked.
     */
    constructor(
        IERC4626 _stakingVault
    ) ERC20("Staking Share", "STK") Ownable(_msgSender()) {
        if (address(_stakingVault) == address(0)) revert ZeroAddress();

        stakingVault = _stakingVault;
        token = IERC20(_stakingVault.asset());

        emit StakingVaultSet(_stakingVault, token);
    }

    /**
     * @dev Allows users to stake assets in the vault.
     * @param assets The amount of assets to stake.
     */
    function stake(uint256 assets) external amountGreaterThanZero(assets) {
        token.safeTransferFrom(msg.sender, address(this), assets);
        // Approve the staking vault to spend the assets
        token.forceApprove(address(stakingVault), assets);
        // Deposit assets into the staking vault and receive shares
        uint256 shares = stakingVault.deposit(assets, address(this));
        // Reset the approval to zero to prevent re-entrancy attacks
        token.forceApprove(address(stakingVault), 0);

        // Mint this ERC20 token as proof of ownership
        _mint(msg.sender, shares);

        emit Stake(msg.sender, assets, shares);
    }

    /**
     * @dev Allows users to unstake their shares and receive the underlying assets.
     * @param shares The number of shares to unstake.
     */
    function unstake(
        uint256 shares
    ) external amountGreaterThanZero(shares) hasEnoughShares(shares) {
        // Redeem shares for assets for the user
        uint256 assets = stakingVault.redeem(shares, msg.sender, address(this));
        // Burn the ERC20 staking token
        _burn(msg.sender, shares);
        emit Unstake(msg.sender, shares, assets);
    }
}
