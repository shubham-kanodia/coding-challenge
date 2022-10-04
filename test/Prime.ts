import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Prime", function () {
  let INITIAL_SUPPLY = 1000;

  async function deployTokenFixture() {
    const [owner, user] = await ethers.getSigners();

    const PrimeToken = await ethers.getContractFactory("Prime");
    const primeToken = await PrimeToken.deploy(INITIAL_SUPPLY, user.address);

    return {owner, user, primeToken};
  }

  describe("Deployment", function () {
    it("User should have the right token balance", async function() {
      const {owner, user, primeToken} = await loadFixture(deployTokenFixture);

      expect(await primeToken.balanceOf(user.address)).to.eq(INITIAL_SUPPLY);
    });
  });
});
