// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./PUSD.sol";
import "./Prime.sol";

contract Vault {
    struct UserStake {
        uint256 tokenAmount;
        uint256 lastDepositTimeStamp;
        uint256 rewardsAccrued;
    }

    event Staked(address user, uint256 amount);
    event RewardsWithdrawn(address user, uint256 rewards);
    event Unstaked(address user, uint256 _amount);

    error InvalidAmount();
    error NoPriorStaking();

    modifier hasStaked() {
        if (stakes[msg.sender].tokenAmount == 0) {
            revert NoPriorStaking();
        }
        _;
    }

    PUSD public rewardToken;
    Prime primeToken;

    uint256 constant secondsInYear = 365 * 1 days;
    mapping(address => UserStake) public stakes;

    constructor(address _primeAddr) {
        rewardToken = new PUSD();
        primeToken = Prime(_primeAddr);
    }

    function _calculateRewards(
        uint256 _tokenAmount,
        uint256 _lastDepositTimeStamp
    ) internal view returns (uint256) {
        return ((_tokenAmount * (block.timestamp - _lastDepositTimeStamp)) /
            (100 * secondsInYear));
    }

    function _updateAccount(UserStake storage _stake) internal {
        uint256 rewardsAccruedSinceLastDeposit = _calculateRewards(
            _stake.tokenAmount,
            _stake.lastDepositTimeStamp
        );

        _stake.rewardsAccrued += rewardsAccruedSinceLastDeposit;
        _stake.lastDepositTimeStamp = block.timestamp;
    }

    function stake(uint256 _amount) public {
        if (_amount == 0) {
            revert InvalidAmount();
        }
        UserStake storage userStake = stakes[msg.sender];

        if (userStake.tokenAmount > 0) {
            _updateAccount(userStake);
        }
        else {
            userStake.lastDepositTimeStamp = block.timestamp;
        }

        userStake.tokenAmount += _amount;
        primeToken.transferFrom(msg.sender, address(this), _amount);
        
        emit Staked(msg.sender, _amount);
    }

    function withdrawAllRewards() public hasStaked {
        UserStake storage userStake = stakes[msg.sender];

        _updateAccount(userStake);
        uint256 totalRewards = userStake.rewardsAccrued;

        userStake.rewardsAccrued = 0;
        rewardToken.mint(msg.sender, totalRewards);

        emit RewardsWithdrawn(msg.sender, totalRewards);
    }

    function unstake(uint256 _amount) public hasStaked {
        UserStake storage userStake = stakes[msg.sender];

        _updateAccount(userStake);
        userStake.tokenAmount -= _amount;

        primeToken.transfer(msg.sender, _amount);

        emit Unstaked(msg.sender, _amount);
    }
}
