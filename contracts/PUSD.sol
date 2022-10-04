// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PUSD is ERC20 {
    address immutable vault;

    constructor() ERC20("PUSD", "PUSD") {
        vault = msg.sender;
    }

    function mint(address user, uint256 amount) public {
        require(vault == msg.sender, "Not vault!");
        _mint(user, amount);
    }
}