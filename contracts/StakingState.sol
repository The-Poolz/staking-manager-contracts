// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "./interfaces/IStakingManager.sol";

abstract contract StakingState is IStakingManager {
    // The vault where assets are staked
    IERC4626 public immutable stackingVault;

    // The token that is being staked
    IERC20 public immutable token;

    // Mapping of user addresses to their shares in the vault
    mapping(address => uint256) public userShares;

    /**
     * @dev Returns the total assets staked by a user.
     * @param user The address of the user.
     * @return The total assets staked by the user.
     */
    function totalUserAssets(address user) external view returns (uint256) {
        return stackingVault.previewRedeem(userShares[user]);
    }

    /**
     * @dev Returns the total assets in the vault.
     * @return The total assets in the vault.
     */
    function totalAssets() external view returns (uint256) {
        return stackingVault.previewRedeem(stackingVault.balanceOf(address(this)));
    }
}
