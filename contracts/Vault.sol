// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./PUSD.sol";
import "./Prime.sol";

import "hardhat/console.sol";

contract Vault {
    struct UserStake {
        uint256 tokenAmount;
        uint256 rewardsAccrued;
        uint256 lastUpdatedUnitRewards;
    }

    event Staked(address user, uint256 amount);
    event RewardsWithdrawn(address user, uint256 rewards);
    event Unstaked(address user, uint256 amount);

    error InvalidAmount();
    error NoPriorStaking();
    error NoRewards();

    modifier hasStaked() {
        if (stakes[msg.sender].tokenAmount == 0) {
            revert NoPriorStaking();
        }
        _;
    }

    PUSD public rewardToken;
    Prime primeToken;

    uint256 internal unitRewardUpdateTimestamp;
    uint256 internal unitRewards;

    uint256 public interestRate;
    uint256 public stakedAmount;
    uint256 public mulFactor;

    mapping(address => UserStake) public stakes;

    constructor(address _primeAddr, uint256 _interestRate) {
        rewardToken = new PUSD();
        primeToken = Prime(_primeAddr);
        unitRewardUpdateTimestamp = block.timestamp;
        mulFactor = 10**primeToken.decimals();

        interestRate = _interestRate;
    }

    function _updateUnitRewards() internal {
        if (stakedAmount > 0) {
            unitRewards += (
                interestRate * mulFactor * (block.timestamp - unitRewardUpdateTimestamp)
                ) / (stakedAmount * 100);
        } else {
            unitRewards += unitRewards;
        }
    }

    function _calculateRewards(
        uint256 _tokenAmount,
        uint256 _lastUpdatedUnitRewards
    ) internal view returns (uint256) {
        return
            (
                _tokenAmount * (unitRewards - _lastUpdatedUnitRewards)
            ) / mulFactor;
    }

    function _updateAccount(UserStake storage _stake) internal {
        _updateUnitRewards();

        uint256 rewardsAccruedSinceLastDeposit = _calculateRewards(
            _stake.tokenAmount,
            _stake.lastUpdatedUnitRewards
        );

        _stake.rewardsAccrued += rewardsAccruedSinceLastDeposit;
        _stake.lastUpdatedUnitRewards = unitRewards;

        unitRewardUpdateTimestamp = block.timestamp;
    }

    function stake(uint256 _amount) public {
        if (_amount == 0) {
            revert InvalidAmount();
        }
        UserStake storage userStake = stakes[msg.sender];

        _updateAccount(userStake);

        userStake.tokenAmount += _amount;
        stakedAmount += _amount;
        primeToken.transferFrom(msg.sender, address(this), _amount);

        emit Staked(msg.sender, _amount);
    }

    function withdrawAllRewards() public {
        UserStake storage userStake = stakes[msg.sender];
        _updateAccount(userStake);

        if (userStake.rewardsAccrued == 0) {
            revert NoRewards();
        }
        uint256 totalRewards = userStake.rewardsAccrued;

        userStake.rewardsAccrued = 0;
        rewardToken.mint(msg.sender, totalRewards);

        emit RewardsWithdrawn(msg.sender, totalRewards);
    }

    function unstake(uint256 _amount) public hasStaked {
        UserStake storage userStake = stakes[msg.sender];
        _updateAccount(userStake);

        userStake.tokenAmount -= _amount;
        stakedAmount -= _amount;

        primeToken.transfer(msg.sender, _amount);

        emit Unstaked(msg.sender, _amount);
    }
}
