// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "./interfaces/IStakingManager.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

abstract contract StakingState is IStakingManager, ERC20 {
    // The vault where assets are staked
    IERC4626 public immutable stakingVault;

    // The token that is being staked
    IERC20 public immutable token;

    /**
     * @dev Returns the total assets staked by a user.
     * @param user The address of the user.
     * @return The total assets staked by the user.
     */
    function totalUserAssets(address user) external view returns (uint256) {
        return stakingVault.previewRedeem(balanceOf(user));
    }

    /**
     * @dev Returns the total assets in the vault.
     * @return The total assets in the vault.
     */
    function totalAssets() external view returns (uint256) {
        return stakingVault.previewRedeem(stakingVault.balanceOf(address(this)));
    }
}
