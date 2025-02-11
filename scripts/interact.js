// scripts/interact.js
const hre = require("hardhat");

async function main() {
    const portfolioAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"

    // Attach to the deployed DeltaNeutralPortfolio contract.
    const DeltaNeutralPortfolio = await hre.ethers.getContractFactory("DeltaNeutralPortfolio");
    const portfolio = DeltaNeutralPortfolio.attach(portfolioAddress);

    // Example Interaction: Deposit 5 ETH.
    console.log("Depositing 5 ETH into the portfolio...");
    const depositTx = await portfolio.deposit({ value: hre.ethers.parseEther("5") });
    await depositTx.wait();
    console.log("Deposit complete.");

    // Query the underlying position.
    const underlying = await portfolio.underlyingPosition();
    console.log("Current underlying position (ETH):", hre.ethers.formatEther(underlying));

    // Open a short option position.
    console.log("Opening a short option position...");
    const optionCount = 10;
    const optionStrike = 2000 * 1e8; // strike price
    const openOptionTx = await portfolio.openShortOption(optionCount, optionStrike);
    await openOptionTx.wait();
    console.log("Short option position opened.");

    // Retrieve and log the net delta.
    const netDelta = await portfolio.netDelta();
    console.log("Current net delta:", netDelta.toString());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
