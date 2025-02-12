// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract DeltaNeutralPortfolio {
    address public owner;
    AggregatorV3Interface internal priceFeed;

    // The portfolio holds an underlying position (ETH) and a short option position.
    // underlyingPosition is recorded in wei (1e18 = 1 ETH).
    uint256 public underlyingPosition; 
    // optionCount is the number of options “shorted”
    uint256 public optionCount;
    // optionStrike is the strike price for the option (expressed in the price feed’s decimals, usually 8)
    uint256 public optionStrike;

    // New: option delta computed off-chain (in 1e18 fixed point).
    // This value is updated by the off-chain system (via updateOptionDelta).
    // For example, if the Black–Scholes model returns 0.42 then computedOptionDelta = 0.42e18.
    uint256 public computedOptionDelta;

    // Events
    event Deposit(address indexed sender, uint256 amount);
    event Withdraw(address indexed sender, uint256 amount);
    event OptionsOpened(uint256 count, uint256 strike);
    event OptionDeltaUpdated(uint256 newDelta);
    event Rebalanced(int256 netDelta, uint256 underlyingPosition, uint256 optionCount);

    event RebalanceTrade(
			 string action,           // "buy" or "sell"
			 uint256 tradeAmount,     // amount of underlying traded (in wei)
			 int256 previousDelta,    // net delta before trade (1e18 fixed point)
			 int256 delta,         // delta after trade
			 uint256 underlyingPosition // underlying position after trade
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /// @notice Constructor accepts the address of a Chainlink price feed contract.
    constructor(address _priceFeed) {
        owner = msg.sender;
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    /// @notice Deposit ETH into the portfolio (increases underlying position)
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

    /// @notice Returns the option delta in 1e18 fixed point.
    /// If computedOptionDelta has been updated off-chain (nonzero), that value is used.
    /// Otherwise, the function falls back to the simple piecewise model.
    function optionDelta() public view returns (uint256) {
        if (computedOptionDelta != 0) {
            return computedOptionDelta;
        }
        // Fallback: use the simple model.
        int256 currentPrice = getLatestPrice(); // 8 decimals
        int256 strike = int256(optionStrike);    // 8 decimals
        if (currentPrice < strike) {
            return 3e17; // 0.3
        } else if (currentPrice == strike) {
            return 5e17; // 0.5
        } else {
            return 7e17; // 0.7
        }
    }

    /// @notice Update the option delta that is computed off-chain.
    /// @param _newDelta The new option delta in 1e18 fixed point (e.g., 0.42e18 for a delta of 42%).
    function updateOptionDelta(uint256 _newDelta) external onlyOwner {
        computedOptionDelta = _newDelta;
        emit OptionDeltaUpdated(_newDelta);
    }

    /// @notice Calculate the net delta of the portfolio (in 1e18 fixed point).
    /// underlying delta: each 1e18 of underlyingPosition gives "1" delta.
    /// Option delta: each option contributes optionDelta() (and since we are short, we subtract).
    function netDelta() public view returns (int256) {
        int256 underlyingDelta = int256(underlyingPosition);
        int256 optionsDelta = int256(optionCount) * int256(computedOptionDelta);
        return underlyingDelta - optionsDelta;
    }

    /// @notice Rebalance the portfolio to be delta neutral.
    /// If netDelta > 0, sell underlying; if netDelta < 0, buy underlying.
    function rebalance() external onlyOwner {
        int256 delta = netDelta();
        if (delta == 0) {
            emit Rebalanced(delta, underlyingPosition, optionCount);
            return;
        }
        // Capture the delta before making any trade.
        int256 prevDelta = delta;

        if (delta > 0) {
            // Too much long exposure – sell underlying.
            uint256 sellAmount = uint256(delta);
            require(sellAmount <= underlyingPosition, "Not enough underlying to sell");
            underlyingPosition -= sellAmount;
            emit RebalanceTrade("sell", sellAmount, prevDelta, int256(computedOptionDelta), underlyingPosition);
        } else {
            // delta < 0: need to buy underlying.
            uint256 buyAmount = uint256(-delta);
            underlyingPosition += buyAmount;
            emit RebalanceTrade("buy", buyAmount, prevDelta, int256(computedOptionDelta), underlyingPosition);
        }
    }
}
