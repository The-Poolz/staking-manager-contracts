// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

// import ERC4626 interface
import "@openzeppelin/contracts/interfaces/IERC4626.sol";

interface IMorphoVault is IERC4626 {
    function DECIMALS_OFFSET() external view returns (uint8);
}
