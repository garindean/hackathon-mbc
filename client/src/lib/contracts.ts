import { Abi } from "viem";

export const STRATEGY_REGISTRY_ADDRESS = "0xd4e090539A26862EF0661d9DD9c39d9e52AAbef9" as const;

export const strategyRegistryAbi = [
  {
    inputs: [
      { name: "topicId", type: "string" },
      { name: "marketIds", type: "string[]" },
      { name: "allocations", type: "uint256[]" },
      { name: "edgeBps", type: "uint256[]" },
    ],
    name: "recordStrategy",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "strategyId", type: "uint256" }],
    name: "getStrategy",
    outputs: [
      { name: "user", type: "address" },
      { name: "topicId", type: "string" },
      { name: "totalAllocation", type: "uint256" },
      { name: "timestamp", type: "uint256" },
      { name: "positionCount", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "strategyId", type: "uint256" },
      { name: "positionIndex", type: "uint256" },
    ],
    name: "getStrategyPosition",
    outputs: [
      { name: "marketId", type: "string" },
      { name: "allocation", type: "uint256" },
      { name: "edgeBps", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getUserStrategyCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getUserStrategyIds",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "strategyCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "strategyId", type: "uint256" },
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "topicId", type: "string" },
      { indexed: false, name: "totalAllocation", type: "uint256" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
    name: "StrategyRecorded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "strategyId", type: "uint256" },
      { indexed: false, name: "marketId", type: "string" },
      { indexed: false, name: "allocation", type: "uint256" },
      { indexed: false, name: "edgeBps", type: "uint256" },
    ],
    name: "PositionAdded",
    type: "event",
  },
] as const satisfies Abi;
