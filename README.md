# StakingManager

StakingManager is a Solidity smart contract that manages staking into an
IERC4626 compatible vault. It allows users to stake ERC‑20 tokens,
tracks the shares issued by the vault and lets users withdraw their stake
along with any accrued yield. The project uses [Hardhat](https://hardhat.org/)
for development and testing.

## Requirements

- Node.js v18 or later
- npm

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

## Deployment

Deploy scripts live in the `scripts` folder. To deploy `StakingManager` run:

```bash
npx hardhat run scripts/deploy.ts --network <network>
```

Replace `<network>` with one of the configured networks (see below).

## Network Configuration

Networks are defined in `hardhat.config.ts`.

- `hardhat` – local network with a high block gas limit.
- `bscTestnet` – Binance Smart Chain testnet at `https://data-seed-prebsc-1-s1.binance.org:8545`.
- `bsc` – Binance Smart Chain mainnet at `https://bsc-dataseed.binance.org/`.

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
