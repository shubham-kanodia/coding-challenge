import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

import { setTime, currentTime } from "./helpers";


describe("Vault", function () {
  let INITIAL_SUPPLY = 1000000;
  let SECONDS_IN_YEAR = 365 * 24 * 60 * 60;
  let INITIAL_DELAY = 1000;
  let INTEREST_RATE = 5; // In percentage

  let ERROR_INVALID_AMOUNT = "InvalidAmount";
  let ERROR_NO_PRIOR_STAKING = "NoPriorStaking";

  async function deployVaultFixture() {
    const [owner, userA, userB] = await ethers.getSigners();

    const PrimeToken = await ethers.getContractFactory("Prime");
    const primeToken = await PrimeToken.deploy(INITIAL_SUPPLY, userA.address);

    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy(primeToken.address, INTEREST_RATE);

    await primeToken.connect(userA).transfer(userB.address, INITIAL_SUPPLY / 2);
    const rewardToken = await ethers.getContractAt("PUSD", await vault.rewardToken());

    return {owner, userA, userB, primeToken, vault, rewardToken};
  }

  describe("#stake", function () {
    it("should not allow staking with invalid amount", async function() {
      const {vault} = await loadFixture(deployVaultFixture);
      
      await expect(vault.stake(0)).to.be.revertedWithCustomError(vault, ERROR_INVALID_AMOUNT);
    });

    it("should not allow staking if tokens are not approved", async function() {
        const {userA, vault} = await loadFixture(deployVaultFixture);
        
        await expect(vault.connect(userA).stake(1000)).to.be.reverted;
    });

    it("should emit an event in case of successful stake", async function() {
        const {userA, vault, primeToken} = await loadFixture(deployVaultFixture);
        
        let deposit = 1000;
        await primeToken.connect(userA).approve(vault.address, deposit);

        await expect(
            vault.connect(userA).stake(deposit)
            ).to.emit(vault, "Staked")
            .withArgs(userA.address, deposit);
    });

    it("should transfer deposit tokens to vault contract", async function() {
        const {userA, vault, primeToken} = await loadFixture(deployVaultFixture);
        
        let deposit = 1000;
        await primeToken.connect(userA).approve(vault.address, deposit);

        await expect(
            () => vault.connect(userA).stake(deposit)
        ).to.changeTokenBalance(primeToken, vault, deposit);
    });
  });

  describe("#withdrawAllRewards", function() {
    it("should withdraw correct amount of rewards accrued when only single staker is involved",
        async function () {
        const {userA, primeToken, vault} = await loadFixture(deployVaultFixture);
        
        let deposit = 1000;
        await primeToken.connect(userA).approve(vault.address, deposit);

        let startTimestamp = currentTime() + INITIAL_DELAY;

        await setTime(ethers.provider, startTimestamp);
        await vault.connect(userA).stake(deposit);

        let stopTimestamp = startTimestamp + SECONDS_IN_YEAR;

        let timeDelta = (stopTimestamp - startTimestamp);
        let expectedRewardsAccrued = Math.floor((timeDelta * INTEREST_RATE)  / 100);
        
        await setTime(ethers.provider, stopTimestamp);
        vault.connect(userA).unstake(deposit);
        
        await expect(
            vault.connect(userA).withdrawAllRewards()
            )
            .to
            .emit(vault, "RewardsWithdrawn")
            .withArgs(userA.address, expectedRewardsAccrued);
    });

    it("should withdraw correct amount of rewards accrued when multiple parties are involved",
        async function () {
        const {userA, userB, primeToken, vault} = await loadFixture(deployVaultFixture);
        
        let userADeposit = 1000;
        let userBDeposit = 1000;

        await primeToken.connect(userA).approve(vault.address, userADeposit);
        await primeToken.connect(userB).approve(vault.address, userBDeposit);

        let userAStartTimestamp = currentTime() + INITIAL_DELAY;

        await setTime(ethers.provider, userAStartTimestamp);
        await vault.connect(userA).stake(userADeposit);

        let userBStartTimestamp = userAStartTimestamp + 101;
        await setTime(ethers.provider, userBStartTimestamp);
        await vault.connect(userB).stake(userBDeposit);
        
        let userAStopTimestamp = userAStartTimestamp + 151;
        await setTime(ethers.provider, userAStopTimestamp);
        await vault.connect(userA).unstake(userADeposit);

        let userBStopTimestamp = userBStartTimestamp + 200;
        await setTime(ethers.provider, userBStopTimestamp);
        await vault.connect(userB).unstake(userBDeposit);

        let expectedUserARewards = 
        Math.floor(
            (userBStartTimestamp - userAStartTimestamp) * INTEREST_RATE / 100)
        +
        Math.floor(
            ((userAStopTimestamp - userBStartTimestamp) * INTEREST_RATE * 1000 ) / (100 * 2000)
        );

        let expectedUserBRewards = 
        Math.floor(
            ((userAStopTimestamp - userBStartTimestamp) * INTEREST_RATE * 1000) / (100 * 2000))
        +
        Math.floor(
            (userBStopTimestamp - userAStopTimestamp) * INTEREST_RATE / 100);

        await expect(
            vault.connect(userA).withdrawAllRewards()
            )
            .to
            .emit(vault, "RewardsWithdrawn")
            .withArgs(userA.address, expectedUserARewards);

        await expect(
            vault.connect(userB).withdrawAllRewards()
            )
            .to
            .emit(vault, "RewardsWithdrawn")
            .withArgs(userB.address, expectedUserBRewards);
    });

    it("should withdraw correct amount of rewards for a user in case of different amounts staked",
        async function () {
        const {userA, userB, primeToken, vault} = await loadFixture(deployVaultFixture);
        
        let userADeposit = 20000;
        let userBDeposit = 5000;
        await primeToken.connect(userA).approve(vault.address, userADeposit);
        await primeToken.connect(userB).approve(vault.address, userBDeposit);

        let userAStartTimestamp = currentTime() + INITIAL_DELAY;

        await setTime(ethers.provider, userAStartTimestamp);
        await vault.connect(userA).stake(userADeposit);

        let userBStartTimestamp = userAStartTimestamp + 10000;
        await setTime(ethers.provider, userBStartTimestamp);
        await vault.connect(userB).stake(userBDeposit);
        
        let userAStopTimestamp = userAStartTimestamp + 20000;
        await setTime(ethers.provider, userAStopTimestamp);
        await vault.connect(userA).unstake(userADeposit);

        let expectedUserARewards = 
        Math.floor(
            (userBStartTimestamp - userAStartTimestamp) * INTEREST_RATE / 100
        )
        +
        Math.floor(
            ((userAStopTimestamp - userBStartTimestamp) * INTEREST_RATE * 20000) / (100 * 25000)
        );

        await expect(
            vault.connect(userA).withdrawAllRewards()
            )
            .to
            .emit(vault, "RewardsWithdrawn")
            .withArgs(userA.address, expectedUserARewards);
    });

    it("should credit the correct amount of PUSD tokens on withdrawl", async function() {
        const {userA, primeToken, vault, rewardToken} = await loadFixture(deployVaultFixture);
        
        let deposit = 1000;
        await primeToken.connect(userA).approve(vault.address, deposit);

        let startTimestamp = currentTime() + INITIAL_DELAY;

        await setTime(ethers.provider, startTimestamp);
        await vault.connect(userA).stake(deposit);

        let stopTimestamp = startTimestamp + SECONDS_IN_YEAR;

        let timeDelta = (stopTimestamp - startTimestamp);
        let expectedRewardsAccrued = Math.floor((timeDelta * INTEREST_RATE)  / 100);
        
        await setTime(ethers.provider, stopTimestamp);
        vault.connect(userA).unstake(deposit);
        
        await expect(
            () => vault.connect(userA).withdrawAllRewards()
        )
        .to
        .changeTokenBalance(rewardToken, userA, expectedRewardsAccrued);
    });
  });

  describe("#unstake", function() {
    it("should revert in case user has not staked", async function() {
        const {userA, vault} = await loadFixture(deployVaultFixture);

        await expect(vault.connect(userA).unstake(100)).to.be.revertedWithCustomError(vault, ERROR_NO_PRIOR_STAKING);
    });

    it("should emit Unstaked event in a happy case scenario", async function() {
        const {userA, vault, primeToken} = await loadFixture(deployVaultFixture);
        
        let deposit = 1000;
        await primeToken.connect(userA).approve(vault.address, deposit);

        await vault.connect(userA).stake(deposit);
        await expect(
            vault.connect(userA).unstake(deposit)
        )
        .to.emit(vault, "Unstaked")
        .withArgs(userA.address, deposit);
    });

    it("should decrease the tokenAmount", async function() {
        const {userA, vault, primeToken} = await loadFixture(deployVaultFixture);

        let deposit = 1000;
        await primeToken.connect(userA).approve(vault.address, deposit);

        await vault.connect(userA).stake(deposit);
        await vault.connect(userA).unstake(100);

        let expectedTokenAmount = 900;
        let stake = await vault.connect(userA).stakes(userA.address);
        expect(stake.tokenAmount).to.eq(expectedTokenAmount);
    });

    it("should transfer the correct amount of token back to user", async function() {
        const {userA, vault, primeToken} = await loadFixture(deployVaultFixture);

        let deposit = 1000;
        await primeToken.connect(userA).approve(vault.address, deposit);

        await vault.connect(userA).stake(deposit);

        await expect(() => vault.connect(userA).unstake(100))
        .to.changeTokenBalance(primeToken, userA.address, 100);
    });
  });
});
