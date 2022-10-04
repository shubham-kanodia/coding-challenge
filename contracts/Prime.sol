// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Prime is ERC20 {
    constructor(uint256 _initialSupply, address user) ERC20("Prime", "PRIME") {
        _mint(user, _initialSupply);
    }
}