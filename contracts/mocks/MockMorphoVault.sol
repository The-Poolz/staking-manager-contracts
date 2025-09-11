// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

/// @notice A mock ERC4626 vault for testing purposes
contract MockMorphoVault is ERC4626 {
    constructor(
        IERC20 asset_
    ) ERC20("Mock ERC4626 Vault", "m4626") ERC4626(asset_) {}

    function DECIMALS_OFFSET() external pure returns (uint8) {
        return 12;
    }
}
