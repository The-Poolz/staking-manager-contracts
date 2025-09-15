// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Token is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 10_000_000 * 10 ** 18);
    }

    // Override decimals to 6 for testing purposes
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}
