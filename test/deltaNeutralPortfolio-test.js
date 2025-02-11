const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DeltaNeutralPortfolio", function () {
    let owner, addr1;
    let deltaPortfolio;
    let mockAggregator;
    // For example, an initial ETH price of 2000 (in 8 decimals)
    const initialPrice = 2000 * 1e8; // 200000000000

    beforeEach(async function () {
	[owner, addr1] = await ethers.getSigners();

	// Deploy the MockV3Aggregator.
	const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
	mockAggregator = await MockV3Aggregator.deploy(8, initialPrice);
	await mockAggregator.waitForDeployment();

	// Deploy the DeltaNeutralPortfolio using the aggregator's address.
	const DeltaNeutralPortfolio = await ethers.getContractFactory("DeltaNeutralPortfolio");
	// In ethers v6, the deployed address is available on the `.target` property.
	deltaPortfolio = await DeltaNeutralPortfolio.deploy(mockAggregator.target);
	await deltaPortfolio.waitForDeployment();
    });

    it("Should deposit ETH and update underlying position", async function () {
	// Use ethers.parseEther instead of ethers.utils.parseEther
	const depositAmount = ethers.parseEther("10");
	await deltaPortfolio.deposit({ value: depositAmount });
	expect(await deltaPortfolio.underlyingPosition()).to.equal(depositAmount);
    });

    it("Should open a short option position and calculate the option delta", async function () {
	const optionCount = 10;
	// Use a strike price equal to the initial price (2000 * 1e8)
	await deltaPortfolio.openShortOption(optionCount, initialPrice);
	// At price == strike, our model returns delta = 0.5 (i.e. 5e17 in fixed point)
	const optionDelta = await deltaPortfolio.optionDelta();
	// Use BigInt literal: 5e17 becomes 500000000000000000n
	expect(optionDelta).to.equal(500000000000000000n);
	// With no underlying deposited yet, net delta = 0 - (10 * 5e17) = -5e18.
	const netDelta = await deltaPortfolio.netDelta();
	expect(netDelta).to.equal(-5000000000000000000n);
    });

    it("Should rebalance the portfolio to delta neutral", async function () {
	// Deposit 10 ETH.
	const depositAmount = ethers.parseEther("10");
	await deltaPortfolio.deposit({ value: depositAmount });
	// Open a short option position: 10 options at a strike equal to the initial price.
	const optionCount = 10;
	await deltaPortfolio.openShortOption(optionCount, initialPrice);
	// At price == strike, optionDelta = 5e17 so net delta = underlying (10e18) - 10*5e17 = 5e18.
	let netDelta = await deltaPortfolio.netDelta();
	expect(netDelta).to.equal(5000000000000000000n);
	// Calling rebalance will "sell" 5 ETH from the underlying position.
	await deltaPortfolio.rebalance();
	// Underlying position should be reduced to 5 ETH.
	const underlyingPositionAfter = await deltaPortfolio.underlyingPosition();
	expect(underlyingPositionAfter).to.equal(ethers.parseEther("5"));
	// Now, net delta should be 5e18 - 10*5e17 = 0.
	netDelta = await deltaPortfolio.netDelta();
	expect(netDelta).to.equal(0n);
    });

    it("Should update option delta based on a price feed change and rebalance accordingly", async function () {
	// Deposit 10 ETH.
	const depositAmount = ethers.parseEther("10");
	await deltaPortfolio.deposit({ value: depositAmount });
	// Open a short option position: 10 options at a strike of 2000 * 1e8.
	const optionCount = 10;
	await deltaPortfolio.openShortOption(optionCount, initialPrice);
	// Initially, net delta = 10e18 - 10*5e17 = 5e18.
	let netDelta = await deltaPortfolio.netDelta();
	expect(netDelta).to.equal(5000000000000000000n);

	// Update the mock price feed to a higher price, e.g. 2500 * 1e8.
	const newPrice = 2500 * 1e8;
	await mockAggregator.updateAnswer(newPrice);
	// Now the model gives optionDelta = 7e17.
	const optionDelta = await deltaPortfolio.optionDelta();
	expect(optionDelta).to.equal(700000000000000000n);
	// New net delta = 10e18 - 10*7e17 = 3e18.
	netDelta = await deltaPortfolio.netDelta();
	expect(netDelta).to.equal(3000000000000000000n);
	// Rebalance: should “sell” 3 ETH from underlying.
	await deltaPortfolio.rebalance();
	const underlyingPositionAfter = await deltaPortfolio.underlyingPosition();
	// 10 ETH – 3 ETH = 7 ETH.
	expect(underlyingPositionAfter).to.equal(ethers.parseEther("7"));
	// Now net delta = 7e18 - 10*7e17 = 0.
	netDelta = await deltaPortfolio.netDelta();
	expect(netDelta).to.equal(0n);
    });
});
