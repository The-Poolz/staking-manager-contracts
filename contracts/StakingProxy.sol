// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

abstract contract StakingProxy is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    /**
     * @dev Returns the current version of the contract.
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }

    /**
     * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract.
     * Called by {upgradeTo} and {upgradeToAndCall}.
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}
