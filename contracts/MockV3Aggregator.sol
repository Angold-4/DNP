// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract MockV3Aggregator is AggregatorV3Interface {
    int256 public answer;
    uint8 public override decimals;
    string public override description;
    uint256 public override version;
    uint256 public lastUpdated; // NEW: Track the timestamp of the latest price update

    constructor(uint8 _decimals, int256 _initialAnswer) {
        decimals = _decimals;
        answer = _initialAnswer;
        description = "MockV3Aggregator";
        version = 1;
        lastUpdated = block.timestamp; // initialize timestamp
    }

    /// @notice Allows updating the price feed answer.
    function updateAnswer(int256 _answer) public {
        answer = _answer;
        lastUpdated = block.timestamp; // NEW: update timestamp on each price change
    }

    function latestRoundData()
        external
        view
        override
        returns (
		 uint80 roundId,
		 int256 answer_,
		 uint256 startedAt,
		 uint256 updatedAt,
		 uint80 answeredInRound
        )
    {
        // NEW: Return block.timestamp as startedAt and lastUpdated as updatedAt
        return (0, answer, block.timestamp, lastUpdated, 0);
    }

    function getRoundData(uint80)
        external
        pure
        override
        returns (
		 uint80,
		 int256,
		 uint256,
		 uint256,
		 uint80
        )
    {
        revert("Not implemented");
    }
}
