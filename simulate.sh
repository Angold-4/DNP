#!/bin/bash
set -e

echo "Compiling contracts..."
npx hardhat compile

echo "Deploying contracts on localhost..."
# Run the deployment script and capture its output.
DEPLOY_OUTPUT=$(npx hardhat run scripts/deploy.js --network localhost)

# Extract the addresses using grep and awk.
PORTFOLIO_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "Portfolio Address:" | awk '{print $NF}')
AGGREGATOR_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "Aggregator Address:" | awk '{print $NF}')

if [ -z "$PORTFOLIO_ADDRESS" ] || [ -z "$AGGREGATOR_ADDRESS" ]; then
  echo "Error: Could not extract deployed addresses from deployment output."
  exit 1
fi

echo "Deployed Portfolio Address: $PORTFOLIO_ADDRESS"
echo "Deployed Aggregator Address: $AGGREGATOR_ADDRESS"

echo "Starting interact.js script on localhost..."

# Pass the addresses as environment variables to interact.js.
PORTFOLIO_ADDRESS=$PORTFOLIO_ADDRESS AGGREGATOR_ADDRESS=$AGGREGATOR_ADDRESS \
npx hardhat run scripts/interact.js --network localhost
