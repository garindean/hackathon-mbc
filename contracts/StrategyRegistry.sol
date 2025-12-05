// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract StrategyRegistry {
    struct MarketPosition {
        string marketId;
        uint256 allocation;
        uint256 edgeBps;
    }

    struct Strategy {
        address user;
        string topicId;
        uint256 totalAllocation;
        uint256 timestamp;
        MarketPosition[] positions;
    }

    mapping(address => Strategy[]) public userStrategies;
    mapping(uint256 => Strategy) public strategies;
    uint256 public strategyCount;

    event StrategyRecorded(
        uint256 indexed strategyId,
        address indexed user,
        string topicId,
        uint256 totalAllocation,
        uint256 timestamp
    );

    event PositionAdded(
        uint256 indexed strategyId,
        string marketId,
        uint256 allocation,
        uint256 edgeBps
    );

    function recordStrategy(
        string calldata topicId,
        string[] calldata marketIds,
        uint256[] calldata allocations,
        uint256[] calldata edgeBps
    ) external returns (uint256) {
        require(marketIds.length > 0, "No markets provided");
        require(
            marketIds.length == allocations.length && 
            allocations.length == edgeBps.length,
            "Array length mismatch"
        );

        uint256 strategyId = strategyCount++;
        Strategy storage strategy = strategies[strategyId];
        strategy.user = msg.sender;
        strategy.topicId = topicId;
        strategy.timestamp = block.timestamp;

        uint256 total = 0;
        for (uint256 i = 0; i < marketIds.length; i++) {
            strategy.positions.push(MarketPosition({
                marketId: marketIds[i],
                allocation: allocations[i],
                edgeBps: edgeBps[i]
            }));
            total += allocations[i];

            emit PositionAdded(strategyId, marketIds[i], allocations[i], edgeBps[i]);
        }

        strategy.totalAllocation = total;
        userStrategies[msg.sender].push(strategy);

        emit StrategyRecorded(
            strategyId,
            msg.sender,
            topicId,
            total,
            block.timestamp
        );

        return strategyId;
    }

    function getStrategy(uint256 strategyId) external view returns (
        address user,
        string memory topicId,
        uint256 totalAllocation,
        uint256 timestamp,
        uint256 positionCount
    ) {
        Strategy storage strategy = strategies[strategyId];
        return (
            strategy.user,
            strategy.topicId,
            strategy.totalAllocation,
            strategy.timestamp,
            strategy.positions.length
        );
    }

    function getStrategyPosition(uint256 strategyId, uint256 positionIndex) external view returns (
        string memory marketId,
        uint256 allocation,
        uint256 edgeBps
    ) {
        MarketPosition storage position = strategies[strategyId].positions[positionIndex];
        return (
            position.marketId,
            position.allocation,
            position.edgeBps
        );
    }

    function getUserStrategyCount(address user) external view returns (uint256) {
        return userStrategies[user].length;
    }

    function getUserStrategyIds(address user) external view returns (uint256[] memory) {
        Strategy[] storage userStrats = userStrategies[user];
        uint256[] memory ids = new uint256[](userStrats.length);
        
        for (uint256 i = 0; i < userStrats.length; i++) {
            for (uint256 j = 0; j < strategyCount; j++) {
                if (strategies[j].user == user && 
                    strategies[j].timestamp == userStrats[i].timestamp &&
                    keccak256(bytes(strategies[j].topicId)) == keccak256(bytes(userStrats[i].topicId))) {
                    ids[i] = j;
                    break;
                }
            }
        }
        return ids;
    }
}
