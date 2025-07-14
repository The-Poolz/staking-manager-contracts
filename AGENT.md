# AI Agent Documentation for StakingManager

## � Installation Steps

### Prerequisites
Before working with the StakingManager project, ensure you have the following installed:
- **Node.js** v18 or later
- **npm** (comes with Node.js)
- **Git** for version control

### 1. Clone the Repository
```bash
git clone https://github.com/The-Poolz/StakingManager.git
cd StakingManager
```

### 2. Install Dependencies
Install all required packages and development dependencies:
```bash
npm install
```

This will install:
- Hardhat development framework
- OpenZeppelin contracts
- TypeScript and testing libraries
- Gas reporting and coverage tools

### 3. Compile Contracts
Compile the Solidity smart contracts:
```bash
npx hardhat compile
```

This command will:
- Compile all `.sol` files in the `contracts/` directory
- Generate TypeScript type definitions in `typechain-types/`
- Create artifacts in the `artifacts/` directory
- Validate contract syntax and dependencies

### 4. Run Tests
Execute the comprehensive test suite:
```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/StakingManager.ts

# Run tests with gas reporting
npx hardhat test --gas-report

# Run tests with verbose output
npx hardhat test --verbose
```

### 5. Test Coverage
Generate and view test coverage reports:
```bash
# Generate coverage report
npx hardhat coverage

# View coverage in browser (opens coverage/index.html)
```

### 6. Additional Commands
Useful development commands:
```bash
# Clean build artifacts
npx hardhat clean

# Compile and generate fresh artifacts
npx hardhat compile --force

# Run linting (if configured)
npm run lint

# Run specific test pattern
npx hardhat test --grep "Fee Management"
```

### 7. Environment Setup
For deployment and mainnet interaction, create a `.env` file:
```bash
# Copy example environment file (if available)
cp .env.example .env

# Edit with your configuration
# PRIVATE_KEY=your_private_key_here
# INFURA_API_KEY=your_infura_key_here
# ETHERSCAN_API_KEY=your_etherscan_key_here
```

### 8. Verify Installation
Confirm everything is working correctly:
```bash
# Should show Hardhat version and available tasks
npx hardhat

# Should compile successfully
npx hardhat compile

# Should pass all tests
npx hardhat test
```
## 📖 Repository Agent Guidelines

### Repository Context
- **Repository**: StakingManager
- **Owner**: The-Poolz
- **License**: MIT
- **Primary Language**: Solidity (with TypeScript tests)
- **Framework**: Hardhat
- **Architecture**: ERC4626-compatible staking system

### Code Standards & Conventions

#### Solidity Contracts
- **Version**: Solidity 0.8.29 with optimization enabled
- **Style**: Follow OpenZeppelin and industry best practices
- **Documentation**: Use NatSpec comments for all public functions
- **Security**: Implement proper access controls and input validation
- **Gas Optimization**: Prioritize efficiency without compromising security

#### TypeScript Tests
- **Framework**: Hardhat with Chai matchers
- **Pattern**: Use `loadFixture` for setup optimization
- **Coverage**: Aim for >95% test coverage
- **Organization**: Group tests by functionality (Deployment, Deposits, Withdrawals, etc.)
- **Naming**: Use descriptive test names that explain the expected behavior

#### File Organization
```
contracts/
├── StakingManager.sol          # Main contract
├── StakingState.sol           # State management
├── StakingModifiers.sol       # Access control modifiers
├── interfaces/
│   └── IStakingManager.sol    # Contract interface
└── mocks/                     # Test contracts
    ├── ERC20Token.sol
    └── MockMorphoVault.sol

test/
└── StakingManager.ts          # Comprehensive test suite

scripts/
├── deploy.ts                  # Deployment script
├── stake.ts                   # Interaction script
└── morphoMarketAPY.ts         # APY calculation utility
```

### Development Workflow

#### Pull Request Guidelines
- **Branch Naming**: Use descriptive branch names (e.g., `feature/add-fee-management`, `fix/test-coverage`)
- **Commit Messages**: Follow conventional commit format
- **Testing**: All tests must pass before merging
- **Coverage**: Maintain or improve test coverage
- **Gas Reports**: Include gas usage analysis for significant changes

#### Code Review Focus Areas
1. **Security Vulnerabilities**: Check for reentrancy, overflow, access control issues
2. **Gas Optimization**: Identify opportunities to reduce transaction costs
3. **Test Completeness**: Ensure edge cases and error conditions are tested
4. **Documentation**: Verify all public functions have proper NatSpec comments
5. **Standards Compliance**: Confirm adherence to ERC standards and OpenZeppelin patterns

### Agent Responsibilities

#### Code Analysis
- **Static Analysis**: Review code for common vulnerabilities using knowledge of Slither patterns
- **Best Practices**: Ensure compliance with Solidity and OpenZeppelin standards
- **Performance**: Suggest gas optimizations and efficiency improvements
- **Maintainability**: Promote clean, readable, and well-documented code

#### Testing Support
- **Test Development**: Create comprehensive test scenarios including edge cases
- **Debugging**: Help diagnose and fix failing tests
- **Coverage Analysis**: Identify untested code paths and suggest additional tests
- **Mock Creation**: Develop appropriate mock contracts for testing

#### Documentation Maintenance
- **Code Comments**: Ensure all functions have proper NatSpec documentation
- **README Updates**: Keep project documentation current and accurate
- **Agent Documentation**: Maintain this AGENT.md file with current capabilities
- **API Documentation**: Document contract interfaces and function signatures

### Project-Specific Patterns

#### StakingManager Architecture
```solidity
// Inheritance hierarchy
StakingManager is StakingState, StakingModifiers, ERC20, Ownable

// Key state variables
IERC4626 public immutable stakingVault;
```

#### Common Test Patterns
```typescript
// Fixture pattern for test setup
const { owner, user, token, vault, stakingManager } = await loadFixture(deployFixture);

// Event testing pattern
await expect(stakingManager.connect(user).stake(amount))
    .to.emit(stakingManager, "Stake")
    .withArgs(user.address, amount, shares);

// Error testing pattern
await expect(stakingManager.connect(user).stake(0))
    .to.be.revertedWithCustomError(stakingManager, "AmountMustBeGreaterThanZero");
```

### Security Guidelines

#### Access Control
- **Owner Functions**: Use `onlyOwner` modifier for administrative functions
- **User Functions**: Validate user permissions and ownership
- **Zero Address**: Always check for zero address in critical functions
- **Input Validation**: Validate all parameters before processing

#### State Management
- **Reentrancy**: Use checks-effects-interactions pattern
- **State Updates**: Update state before external calls
- **Event Emission**: Emit events for all state changes
- **Error Handling**: Use custom errors for gas efficiency

#### External Interactions
- **Safe Transfers**: Use OpenZeppelin's SafeERC20 for token operations
- **Vault Interactions**: Validate vault responses and handle failures
- **Oracle Usage**: If implemented, ensure oracle data validation

### Performance Optimization

#### Gas Efficiency
- **Storage Access**: Minimize storage reads/writes
- **Loop Optimization**: Avoid unbounded loops
- **Packing**: Use struct packing for storage efficiency
- **Custom Errors**: Prefer custom errors over string messages

#### Contract Size
- **Modular Design**: Split functionality across multiple contracts
- **Library Usage**: Leverage OpenZeppelin libraries
- **Code Reuse**: Eliminate duplicate code patterns

### Quality Assurance

#### Testing Requirements
- **Unit Tests**: Test individual functions in isolation
- **Integration Tests**: Test contract interactions
- **Edge Cases**: Test boundary conditions and error paths
- **Gas Tests**: Verify gas usage is within acceptable limits

#### Continuous Integration
- **Automated Testing**: All tests must pass on every commit
- **Coverage Reports**: Maintain detailed coverage analysis
- **Gas Reports**: Track gas usage changes over time
- **Security Scans**: Regular vulnerability assessments

### Communication Protocols

#### Issue Reporting
- **Bug Reports**: Include reproduction steps and error messages
- **Feature Requests**: Provide clear requirements and use cases
- **Security Issues**: Follow responsible disclosure practices
- **Performance Issues**: Include gas usage data and optimization suggestions

#### Code Reviews
- **Constructive Feedback**: Focus on code quality and security
- **Educational Approach**: Explain the reasoning behind suggestions
- **Alternative Solutions**: Provide multiple approaches when applicable
- **Follow-up**: Ensure suggested changes are properly implemented

For complex architectural decisions or business logic questions, consider involving human developers alongside the agent's technical expertise.
