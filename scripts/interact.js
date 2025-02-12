// scripts/interact.js
const hre = require("hardhat");
const { calculateOptionDelta } = require("../src/deltaCalculator");
const { ethers } = hre;

async function main() {
    /*
    const portfolioAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
    const aggregatorAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    */

    const portfolioAddress = process.env.PORTFOLIO_ADDRESS;
    const aggregatorAddress = process.env.AGGREGATOR_ADDRESS;

    if (!portfolioAddress || !aggregatorAddress) {
	console.error("Error: Deployed addresses not provided.");
	process.exit(1);
    }


    // Attach to the deployed DeltaNeutralPortfolio contract.
    const DeltaNeutralPortfolio = await hre.ethers.getContractFactory("DeltaNeutralPortfolio");
    const portfolio = DeltaNeutralPortfolio.attach(portfolioAddress);

    // Attach to the deployed MockV3Aggregator contract.
    const MockV3Aggregator = await hre.ethers.getContractFactory("MockV3Aggregator");
    const aggregator = MockV3Aggregator.attach(aggregatorAddress);

    // Initial Testing
    // Example Interaction: Deposit 2.5 ETH.
    console.log("Depositing 2.5 ETH into the portfolio...");
    const depositTx = await portfolio.deposit({ value: ethers.parseEther("2.5") });
    await depositTx.wait();
    console.log("Deposit complete.");

    // Query the underlying position.
    const underlying = await portfolio.underlyingPosition();
    console.log("Current underlying position (ETH):", ethers.formatEther(underlying));

    // Open a short option position.
    console.log("Opening a short option position...");
    const optionCount = 5; // 5 ETH
    const optionStrike = 2000 * 1e8; // strike price (using 8 decimals)
    const openOptionTx = await portfolio.openShortOption(optionCount, optionStrike);
    await openOptionTx.wait();
    console.log("Short option position opened.");

    // Retrieve and log the net delta.
    let netDelta = await portfolio.netDelta();
    console.log("Initial net delta (1e18 fixed point):", netDelta.toString());

    // Start simulating price fluctuations every 60 seconds.
    simulatePriceFluctuation(portfolio, aggregator, optionStrike);
}

/**
 * Every 60 seconds, simulate a new ETH price, update the off-chain computed option delta,
 * push it on-chain, and then call rebalance.
 *
 * @param {Contract} portfolio - The deployed DeltaNeutralPortfolio contract instance.
 * @param {Contract} aggregator - The deployed MockV3Aggregator contract instance.
 * @param {number} optionStrike - The strike price in 8 decimals.
 */
async function simulatePriceFluctuation(portfolio, aggregator, optionStrike) {
    // Parameters for the Black–Scholes model:
    const r = 0.01;          // Risk-free rate (1%)
    const sigma = 0.5;       // Volatility (50%)
    const T = 30 / 365;      // Time to expiration: 30 days

    portfolio.on("RebalanceTrade", (action, tradeAmount, previousDelta, delta, underlyingPosition, event) => {
	console.log(`\n--- RebalanceTrade Event (Live) ---`);
	// Convert fixed-point delta values (1e18) into decimal strings (e.g., "0.2")
	previousDelta = ethers.formatUnits(previousDelta, 18);
	delta = ethers.formatUnits(delta, 18);
	// Convert wei values into ETH (using 18 decimals).
	const tradeAmountETH = ethers.formatEther(tradeAmount);
	const underlyingPositionETH = ethers.formatEther(underlyingPosition);
	
	console.log("Action (buy/sell):", event.args.action);
	console.log("Trade Amount:", tradeAmountETH, "ETH");
	console.log("Net Delta:", previousDelta);
	console.log("Current Option Delta:", delta);
	console.log("Underlying Position:", underlyingPositionETH, "ETH");
	console.log(`-------------------------------------\n`);
    });

    setInterval(async () => {
	try {
	    console.log("\n--- Price Update Triggered ---");
	    // Simulate a new ETH price in dollars.
	    // For example, randomly choose between 1900 and 2100.
	    const randomPrice = Math.floor(Math.random() * (2100 - 1900 + 1)) + 1900;
	    // Convert price to the aggregator's 8–decimals format.
	    const newPrice = randomPrice * 1e8;
	    console.log("New simulated ETH price (8 decimals):", newPrice);

	    // Update the aggregator's price on-chain.
	    const priceTx = await aggregator.updateAnswer(newPrice);
	    await priceTx.wait();
	    console.log("Price updated in aggregator.");

	    // Compute the option delta off-chain.
	    // Convert optionStrike (which is in 8 decimals) to a number.
	    const K = optionStrike / 1e8;
	    // The underlying price S is newPrice in 8 decimals; convert to a number.
	    const S = newPrice / 1e8;
	    const delta = calculateOptionDelta(S, K, T, r, sigma);
	    console.log("Computed off-chain option delta (call):", delta);

	    // Convert the delta to 1e18 fixed–point format.
	    const fixedDelta = ethers.parseUnits(delta.toString(), 18);
	    console.log("Option delta in 1e18 fixed point:", fixedDelta.toString());

	    // Update the option delta on-chain.
	    const updateTx = await portfolio.updateOptionDelta(fixedDelta);
	    await updateTx.wait();

	    const rebalanceTx = await portfolio.rebalance();
	    await rebalanceTx.wait();
	} catch (err) {
	    console.error("Error in price simulation and update:", err);
	}
    }, 5000); // 5000 ms = 5 seconds
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
