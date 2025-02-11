// scripts/deploy.js
const hre = require("hardhat");

async function main() {
    // Get the deployer account.
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Deploy the MockV3Aggregator.
    const decimals = 8;
    const initialPrice = 2000 * 1e8; // 2000 in 8 decimals
    const MockV3Aggregator = await hre.ethers.getContractFactory("MockV3Aggregator");
    const mockAggregator = await MockV3Aggregator.deploy(decimals, initialPrice);
    await mockAggregator.waitForDeployment();

    // Use .target (ethers v6) if available, otherwise use .address (ethers v5).
    const aggregatorAddress = mockAggregator.target || mockAggregator.address;
    console.log("MockV3Aggregator deployed to:", aggregatorAddress);

    // Deploy the DeltaNeutralPortfolio contract using the aggregator's address.
    const DeltaNeutralPortfolio = await hre.ethers.getContractFactory("DeltaNeutralPortfolio");
    const portfolio = await DeltaNeutralPortfolio.deploy(aggregatorAddress);
    await portfolio.waitForDeployment();
    const portfolioAddress = portfolio.target || portfolio.address;
    console.log("DeltaNeutralPortfolio deployed to:", portfolioAddress);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
