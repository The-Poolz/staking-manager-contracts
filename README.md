# StakingManager

[![Build and Test](https://github.com/The-Poolz/staking-manager-contracts/actions/workflows/node.js.yml/badge.svg)](https://github.com/The-Poolz/staking-manager-contracts/actions/workflows/node.js.yml)
[![codecov](https://codecov.io/gh/The-Poolz/StakingManager/graph/badge.svg)](https://codecov.io/gh/The-Poolz/StakingManager)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/The-Poolz/staking-manager-contracts/blob/master/LICENSE)

**`StakingManager`** is a **fully ERC4626-compliant** upgradeable Solidity smart contract that enables users to stake **ERC-20** tokens into an **IERC4626** compatible vault with a **dual fee system**. The contract implements the complete **ERC4626 Vault standard** providing standardized deposit/withdraw/mint/redeem functionality. When users stake, they receive **ERC-20** "shares" that represent their vault position and can be traded or redeemed later for the underlying assets plus accrued yield. 

The contract features **input fees** (on deposits) and **output fees** (on withdrawals) with basis point precision, **pausable operations** for enhanced security, and **vault migration capabilities**. Built with **UUPS proxy pattern** for seamless upgrades while preserving user state, and designed with a modular architecture including `StakingAdmin`, `StakingState`, and `StakingInternal` contracts. This project uses [Hardhat](https://hardhat.org/) for development and testing.

## 📚 Table of Contents

-   [**Features**](#features)
-   [**Setup**](#setup)
    -   [**Requirements**](#requirements)
    -   [**Installation**](#installation)
    -   [**Compilation**](#compilation)
    -   [**Running Tests**](#running-tests)
    -   [**Test Coverage**](#test-coverage)
    -   [**Deployment**](#deployment)
    -   [**Network Configuration**](#network-configuration)
    -   [**Environment Variables**](#environment-variables)
-   [**UML Diagram**](#uml-diagram)
-   [**Functions Overview**](#functions-overview)
-   [**Usage Example**](#usage-example)
-   [**License**](#license)

---

## Features

-   🚀 **Upgradeable Contract Architecture** - UUPS proxy pattern for seamless upgrades
-   💰 **Dual Fee System** - Separate input and output fees with basis point precision
-   🏦 **ERC4626 Vault Integration** - Compatible with any ERC4626 yield-bearing vault
-   🪙 **ERC4626 Compliant** - Full ERC4626 implementation for standardized vault interactions
-   🪙 **ERC20 Token Representation** - Staked assets represented as transferable shares
-   🔒 **Access Control** - Owner-based fee management and upgrade authorization
-   📊 **Fee Accumulation** - Automatic fee collection and withdrawal functionality
-   🛡️ **Security Features** - Comprehensive validation and error handling
-   ⏸️ **Pausable Operations** - Emergency pause functionality for enhanced security
-   🔄 **Vault Migration** - Ability to migrate to new vaults while preserving user positions
-   ⚡ **Gas Optimized** - Efficient operations with custom errors

---

# Setup

## Requirements

-   Node.js v18 or later
-   npm

## Installation

Install the dependencies defined in `package.json`:

```bash
npm install
```

## Compilation

Compile the contracts using Hardhat:

```bash
npx hardhat compile
```

## Running Tests

The unit tests are written with Hardhat and Chai. Execute them with:

```bash
npx hardhat test
```

## Test Coverage

Generate a test coverage report (requires solidity-coverage):

```bash
npx hardhat coverage
```

Coverage results are stored in the **coverage/** directory

## Deployment

Deploy scripts live in the `scripts` folder. The StakingManager uses upgradeable proxy pattern:

```bash
# Deploy upgradeable StakingManager with proxy
npx hardhat run scripts/deploy.ts --network <network>

# Run dual fee system example
npx hardhat run scripts/dualFeeExample.ts --network <network>

# Upgrade existing deployment
npx hardhat run scripts/upgradeContract.ts --network <network>
```

Replace `<network>` with one of the configured networks (see below).

### Upgrade Process

The contract uses OpenZeppelin's UUPS proxy pattern for upgrades:
1. **Deploy**: Initial deployment creates proxy and implementation
2. **Upgrade**: New implementation deployed, proxy updated
3. **State Preserved**: All user balances and fees maintained across upgrades

## Network Configuration

Networks are defined in `hardhat.config.ts`.

-   `hardhat` – local network with a high block gas limit.
-   `bscTestnet` – Binance Smart Chain testnet at `https://data-seed-prebsc-1-s1.binance.org:8545`.
-   `bsc` – Binance Smart Chain mainnet at `https://bsc-dataseed.binance.org/`.

To deploy to BSC networks you must provide a private key and BscScan API key.

## Environment Variables

Create a `.env` file in the project root and supply the following variables
as needed by `hardhat.config.ts`:

```env
PRIVATE_KEY=your_private_key         # used for deployments
ETHERSCAN_API_KEY=your_etherscan_key # verification on Ethereum networks
BSCSCAN_API_KEY=your_bscscan_key     # verification on BSC networks
CMC_API_KEY=your_coinmarketcap_key   # for gas reporter
```

These variables are optional for local development but required for network
deployments and contract verification.

## UML diagram
![classDiagram](uml.svg)

## Functions Overview

### ERC4626 Core Functions

#### deposit

```solidity
function deposit(uint256 assets, address receiver) external returns (uint256 shares);
```

Deposits **ERC-20** tokens into the vault. Transfers `assets` from the caller to the contract, deposits them into the vault, and mints shares to the `receiver`. Input fees are deducted before depositing.

**Emits**: 
```solidity
event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)
```

#### withdraw

```solidity
function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
```

Withdraws `assets` by burning the required shares from the `owner` and transferring assets to the `receiver`. Output fees are deducted from the withdrawn assets.

**Emits**:
```solidity
event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)
```

#### mint

```solidity
function mint(uint256 shares, address receiver) external returns (uint256 assets);
```

Mints exactly `shares` to the `receiver` by depositing the required amount of assets (including input fees).

#### redeem

```solidity
function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
```

Redeems exactly `shares` from the `owner` and transfers the equivalent assets (minus output fees) to the `receiver`.

### Admin Functions

#### setInputFeeRate

```solidity
function setInputFeeRate(uint256 _inputFeeRate) external onlyOwner;
```

Sets the input fee rate for deposits in basis points (1 basis point = 0.01%, max 10%).

#### setOutputFeeRate

```solidity
function setOutputFeeRate(uint256 _outputFeeRate) external onlyOwner;
```

Sets the output fee rate for withdrawals in basis points (1 basis point = 0.01%, max 10%).

#### withdrawFeeShares

```solidity
function withdrawFeeShares(address recipient, uint256 shares) external onlyOwner;
```

Allows the owner to redeem accumulated fee shares for assets.

### View Functions

#### totalAssets

```solidity
function totalAssets() external view returns (uint256);
```

Returns the total value of assets staked in the vault on behalf of this contract.

#### totalUserAssets

```solidity
function totalUserAssets(address user) external view returns (uint256);
```

Returns the total amount of underlying assets the user has staked, calculated from their share balance.

#### accumulatedFees

```solidity
function accumulatedFees() external view returns (uint256);
```

Returns the current accumulated fee assets available for withdrawal.

## Usage Example

```ts
import { ethers } from "hardhat"
import { StakingManager, ERC20 } from "../typechain-types"

async function main() {
    const [deployer] = await ethers.getSigners()

    const stakingManager = (await ethers.getContractAt("StakingManager", "<staking_manager_address>")) as StakingManager

    const token = (await ethers.getContractAt("ERC20", "<token_address>")) as ERC20

    const amount = ethers.parseEther("1000")

    // Approve stakingManager to transfer tokens
    const approveTx = await token.approve(await stakingManager.getAddress(), amount)
    await approveTx.wait()

    // Deposit tokens (ERC4626 compliant method)
    const depositTx = await stakingManager.deposit(amount, deployer.address)
    await depositTx.wait()

    // Check user's shares
    const shares = await stakingManager.balanceOf(await deployer.getAddress())

    // Redeem shares for assets (ERC4626 compliant method)
    const redeemTx = await stakingManager.redeem(shares, deployer.address, deployer.address)
    await redeemTx.wait()

    console.log(`Deposited and redeemed ${ethers.formatEther(amount)} tokens successfully.`)
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
```

-   Replace **<staking_manager_address>** and **<token_address>** with actual deployed contract addresses.

## License

This project is licensed under the [MIT License](LICENSE).
