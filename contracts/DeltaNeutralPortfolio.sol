// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// We use the Chainlink Aggregator interface to get live ETH prices.
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract DeltaNeutralPortfolio {
    // address that deployed the contract
    address public owner;

    // chainlink's aggregator interface for retrieving the latest ETH price.
    AggregatorV3Interface internal priceFeed;

    // The portfolio holds an underlying position (ETH) and a short option position.
    // underlyingPosition is recorded in wei (1e18 = 1 ETH).
    uint256 public underlyingPosition; 
    // optionCount is the number of options "shorted"
    uint256 public optionCount;
    // optionStrike is the strike price for the option (expressed in the price feed's decimals, usually 8)
    uint256 public optionStrike;

    /*  
	TODO: Implement more complex model like Block-Scholes.
	This is a toy piecewise function to assign a delta value based on
	how the current ETH price compares with the strike price

	- if current ETH price < strike, we assume delta = 0.3 (30%)
	- if current ETH price == strike, we assume delta = 0.5 (50%)
	- if current ETH price > strike, we assume delta = 0.7 (70%)

        We use 1e18–fixed point math so that "1" is represented as 1e18.
    */

    event Deposit(address indexed sender, uint256 amount);
    event Withdraw(address indexed sender, uint256 amount);
    event OptionsOpened(uint256 count, uint256 strike);
    event Rebalanced(int256 netDelta, uint256 underlyingPosition, uint256 optionCount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /// @notice Constructor accepts the address of a Chainlink price feed contract.
    /// when the contract is deployed, it sets the deployer as the owner and initialize the chainlink price feed address
    constructor(address _priceFeed) {
        owner = msg.sender;
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    /// @notice Deposit ETH into the portfolio (increases underlying position)
    /// Lets the owner deposit ETH into the contract, which is added to underlyingPosition
    function deposit() external payable onlyOwner {
        underlyingPosition += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    /// @notice Withdraw ETH from the portfolio.
    function withdraw(uint256 amount) external onlyOwner {
        require(amount <= underlyingPosition, "Not enough underlying");
        underlyingPosition -= amount;
        payable(owner).transfer(amount);
        emit Withdraw(msg.sender, amount);
    }

    /// @notice Open a short option position. For simplicity, we assume only one option series is active.
    /// @param _optionCount Number of options to short.
    /// @param _optionStrike Strike price (in the same decimals as the price feed, e.g. 8 decimals).
    function openShortOption(uint256 _optionCount, uint256 _optionStrike) external onlyOwner {
        // For this demo, we assume only one active option series.
        require(optionCount == 0, "Option position already open");
        optionCount = _optionCount;
        optionStrike = _optionStrike;
        emit OptionsOpened(_optionCount, _optionStrike);
    }

    /// @notice Get the latest ETH price from the Chainlink price feed.
    function getLatestPrice() public view returns (int256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return price; // typically 8 decimals (e.g., 2000 * 1e8)
    }

    /// @notice Calculate the option delta (in 1e18 fixed point) using our simple model.
    function optionDelta() public view returns (uint256) {
        int256 currentPrice = getLatestPrice();  // 8 decimals
        int256 strike = int256(optionStrike);    // 8 decimals
        if (currentPrice < strike) {
            return 3e17; // 0.3
        } else if (currentPrice == strike) {
            return 5e17; // 0.5
        } else {
            return 7e17; // 0.7
        }
    }

    /// @notice Calculate the net delta of the portfolio (in 1e18 fixed point).
    /// underlying delta: each 1e18 of underlyingPosition gives “1” delta.
    /// Option delta: each option contributes optionDelta() (but since we are short, we subtract).
    function netDelta() public view returns (int256) {
        int256 underlyingDelta = int256(underlyingPosition); // in 1e18 fixed point
        int256 optionsDelta = int256(optionCount) * int256(optionDelta());
        // Because the option position is short, its delta subtracts from the underlying delta.
        return underlyingDelta - optionsDelta;
    }

    /// @notice Rebalance the portfolio to be delta neutral.
    /// If netDelta > 0, we "sell" underlying (reduce underlyingPosition).
    /// If netDelta < 0, we need to "buy" underlying (increase underlyingPosition).
    /// In a production system, these adjustments would trigger trades.
    function rebalance() external onlyOwner {
        int256 delta = netDelta();
        if (delta == 0) {
            emit Rebalanced(delta, underlyingPosition, optionCount);
            return;
        } else if (delta > 0) {
            // Too much long exposure – sell underlying.
            uint256 sellAmount = uint256(delta);
            require(sellAmount <= underlyingPosition, "Not enough underlying to sell");
            underlyingPosition -= sellAmount;
        } else {
            // delta < 0: need to buy underlying to cover negative delta.
            uint256 buyAmount = uint256(-delta);
            // In a real implementation, buying underlying would require funds (or a swap via DEX).
            underlyingPosition += buyAmount;
        }
        emit Rebalanced(netDelta(), underlyingPosition, optionCount);
    }
}
