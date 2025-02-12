// test/deltaNeutralPortfolio-test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DeltaNeutralPortfolio", function () {
    let aggregator, portfolio, owner;
    const DECIMALS = 8;
    // For example, an initial price of $3600 with 8 decimals.
    const initialPrice = 3600 * 10 ** DECIMALS;

    beforeEach(async function () {
	[owner] = await ethers.getSigners();

	// Deploy MockV3Aggregator
	const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
	aggregator = await MockV3Aggregator.deploy(DECIMALS, initialPrice);

	// Deploy DeltaNeutralPortfolio with the aggregator’s address.
	const DeltaNeutralPortfolio = await ethers.getContractFactory("DeltaNeutralPortfolio");
	portfolio = await DeltaNeutralPortfolio.deploy(aggregator.target);

	// Deposit 5 ETH.
	const depositTx = await portfolio.deposit({ value: ethers.parseEther("5") });
	await depositTx.wait();

	// Open a short option position.
	const optionCount = 10;
	const optionStrike = 2000 * 10 ** DECIMALS;
	const openOptionTx = await portfolio.openShortOption(optionCount, optionStrike);
	await openOptionTx.wait();
    });

    it("should update price and rebalance the portfolio", async function () {
	// Log initial state.
	let underlying = await portfolio.underlyingPosition();
	let netDelta = await portfolio.netDelta();
	console.log("Initial underlying position (wei):", underlying.toString());
	console.log("Initial net delta (1e18 fixed point):", netDelta.toString());

	// For this test, use a fixed offset of +5 dollars (5 * 1e8) to simulate a price change.
	const offset = 5 * 10 ** DECIMALS;
	const newPrice = initialPrice + offset;
	console.log("Simulated new price:", newPrice.toString());

	// Update the aggregator price.
	const updateTx = await aggregator.updateAnswer(newPrice);
	await updateTx.wait();

	// Increase blockchain time by 60 seconds.
	await ethers.provider.send("evm_increaseTime", [60]);
	await ethers.provider.send("evm_mine", []);

	// Call rebalance.
	const rebalanceTx = await portfolio.rebalance();
	await rebalanceTx.wait();

	// Log updated state.
	underlying = await portfolio.underlyingPosition();
	netDelta = await portfolio.netDelta();
	console.log("Updated underlying position (wei):", underlying.toString());
	console.log("Updated net delta (1e18 fixed point):", netDelta.toString());

	// In our simulation, the portfolio’s rebalance() should adjust the underlying position
	// so that the net delta is neutral (i.e. 0).
	expect(netDelta).to.equal(0);
    });
});
