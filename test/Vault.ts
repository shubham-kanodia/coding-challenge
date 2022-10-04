import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

import { setTime, currentTime } from "./helpers";


describe("Vault", function () {
  let INITIAL_SUPPLY = 1000;
  let SECONDS_IN_YEAR = 365 * 24 * 60 * 60;
  let INITIAL_DELAY = 1000;

  async function deployVaultFixture() {
    const [owner, user] = await ethers.getSigners();

    const PrimeToken = await ethers.getContractFactory("Prime");
    const primeToken = await PrimeToken.deploy(INITIAL_SUPPLY, user.address);

    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy(primeToken.address);

    const rewardToken = await ethers.getContractAt("PUSD", await vault.rewardToken());

    return {owner, user, primeToken, vault, rewardToken};
  }

  describe("#stake", function () {
    it("should not allow staking with invalid amount", async function() {
      const {vault} = await loadFixture(deployVaultFixture);
      
      await expect(vault.stake(0)).to.be.revertedWith("Invalid amount!");
    });

    it("should not allow staking if tokens are not approved", async function() {
        const {user, vault} = await loadFixture(deployVaultFixture);
        
        await expect(vault.connect(user).stake(1000)).to.be.reverted;
    });

    it("should emit an event in case of successful stake", async function() {
        const {user, vault, primeToken} = await loadFixture(deployVaultFixture);
        
        let deposit = 1000;
        await primeToken.connect(user).approve(vault.address, deposit);

        await expect(
            vault.connect(user).stake(deposit)
            ).to.emit(vault, "Staked")
            .withArgs(user.address, deposit);
    });

    it("should transfer deposit tokens to vault contract", async function() {
        const {user, vault, primeToken} = await loadFixture(deployVaultFixture);
        
        let deposit = 1000;
        await primeToken.connect(user).approve(vault.address, deposit);

        await expect(
            () => vault.connect(user).stake(deposit)
        ).to.changeTokenBalance(primeToken, vault, deposit);
    });
  });

  describe("#withdrawAllRewards", function() {
    it("should revert in case user has not staked", async function() {
        const {user, vault} = await loadFixture(deployVaultFixture);

        await expect(vault.connect(user).withdrawAllRewards()).to.be.revertedWith("No amount staked!");
    });

    it("should withdraw correct amount of rewards accrued", async function() {
        const {user, primeToken, vault, rewardToken} = await loadFixture(deployVaultFixture);
        
        let deposit = 1000;
        await primeToken.connect(user).approve(vault.address, deposit);

        let startTimestamp = currentTime() + 1000;

        await setTime(ethers.provider, startTimestamp);
        await vault.connect(user).stake(deposit);

        let stopTimestamp = startTimestamp + SECONDS_IN_YEAR;

        await setTime(ethers.provider, stopTimestamp);
        let expectedRewardsAccrued = deposit / 100;
        
        await expect(
            vault.connect(user).withdrawAllRewards()
            )
            .to
            .emit(vault, "RewardsWithdrawn")
            .withArgs(user.address, expectedRewardsAccrued);
    });

    it("should credit the correct amount of PUSD tokens on withdrawl", async function() {
        const {user, primeToken, vault, rewardToken} = await loadFixture(deployVaultFixture);
        
        let deposit = 1000;
        await primeToken.connect(user).approve(vault.address, deposit);

        let startTimestamp = currentTime() + INITIAL_DELAY;

        await setTime(ethers.provider, startTimestamp);
        await vault.connect(user).stake(deposit);

        // Fast forward an year
        let stopTimestamp = startTimestamp + SECONDS_IN_YEAR;

        await setTime(ethers.provider, stopTimestamp);
        let expectedRewardsAccrued = deposit / 100;
        
        await expect(
            () => vault.connect(user).withdrawAllRewards()
            )
            .to
            .changeTokenBalance(rewardToken, user, expectedRewardsAccrued);
    });
  });

  describe("#unstake", function() {
    it("should revert in case user has not staked", async function() {
        const {user, vault} = await loadFixture(deployVaultFixture);

        await expect(vault.connect(user).unstake(100)).to.be.revertedWith("No amount staked!");
    });

    it("should emit Unstaked event in a happy case scenario", async function() {
        const {user, vault, primeToken} = await loadFixture(deployVaultFixture);
        
        let deposit = 1000;
        await primeToken.connect(user).approve(vault.address, deposit);

        await vault.connect(user).stake(deposit);
        await expect(
            vault.connect(user).unstake(deposit)
        )
        .to.emit(vault, "Unstaked")
        .withArgs(user.address, deposit);
    });

    it("should decrease the tokenAmount", async function() {
        const {user, vault, primeToken} = await loadFixture(deployVaultFixture);

        let deposit = 1000;
        await primeToken.connect(user).approve(vault.address, deposit);

        await vault.connect(user).stake(deposit);
        await vault.connect(user).unstake(100);

        let expectedTokenAmount = 900;
        let stake = await vault.connect(user).stakes(user.address);
        expect(stake.tokenAmount).to.eq(expectedTokenAmount);
    });

    it("should transfer the correct amount of token back to user", async function() {
        const {user, vault, primeToken} = await loadFixture(deployVaultFixture);

        let deposit = 1000;
        await primeToken.connect(user).approve(vault.address, deposit);

        await vault.connect(user).stake(deposit);

        await expect(() => vault.connect(user).unstake(100))
        .to.changeTokenBalance(primeToken, user.address, 100);
    });
  });
});
