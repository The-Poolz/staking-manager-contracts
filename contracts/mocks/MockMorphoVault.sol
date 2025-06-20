// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

/// @notice A mock ERC4626 vault for testing purposes
contract MockMorphoVault is ERC4626 {
    constructor(
        IERC20 asset_
    ) ERC20("Mock ERC4626 Vault", "m4626") ERC4626(asset_) {}

    /// @notice Allows anyone to mint shares directly (useful for testing)
    function mintShares(address to, uint256 shares) external {
        _mint(to, shares);
    }

    /// @notice Allows anyone to mint assets directly to the vault (for liquidity simulation)
    function mintAssets(uint256 amount) external {
        IERC20(asset()).transferFrom(msg.sender, address(this), amount);
    }

    /// @notice Simulate yield by increasing asset balance without minting shares
    function simulateYield(uint256 amount) external {
        IERC20(asset()).transferFrom(msg.sender, address(this), amount);
    }
}
