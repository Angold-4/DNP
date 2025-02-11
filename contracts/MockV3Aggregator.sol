// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract MockV3Aggregator is AggregatorV3Interface {
    int256 public answer;
    uint8 public override decimals;
    string public override description;
    uint256 public override version;

    constructor(uint8 _decimals, int256 _initialAnswer) {
        decimals = _decimals;
        answer = _initialAnswer;
        description = "MockV3Aggregator";
        version = 1;
    }

    /// @notice Allows updating the price feed answer.
    function updateAnswer(int256 _answer) public {
        answer = _answer;
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
        return (0, answer, 0, 0, 0);
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
