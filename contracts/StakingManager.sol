// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./StakingModifiers.sol";

/**
 * @title StakingManager
 * @dev Upgradeable staking contract that also acts as an ERC20 token representing staked shares.
 */
contract StakingManager is 
    Initializable, 
    OwnableUpgradeable, 
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    StakingModifiers 
{
    using SafeERC20 for IERC20;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract with the staking vault address.
     * @param _stakingVault The address of the IERC4626 vault where assets will be staked.
     * @param name The name of the ERC20 token.
     * @param symbol The symbol of the ERC20 token.
     * @param owner The owner of the contract.
     */
    function initialize(
        IERC4626 _stakingVault,
        string memory name,
        string memory symbol,
        address owner
    ) public initializer {
        if (address(_stakingVault) == address(0)) revert ZeroAddress();
        if (owner == address(0)) revert ZeroAddress();

        // Initialize inherited contracts
        __Ownable_init(owner);
        __ReentrancyGuard_init();
        __ERC20_init(name, symbol);
        __UUPSUpgradeable_init();

        // Initialize immutable-like variables (stored in storage for upgradeable contracts)
        stakingVault = _stakingVault;
        token = IERC20(_stakingVault.asset());
        
        // Initialize mutable state with 0% fees
        inputFeeRate = 0;
        outputFeeRate = 0;

        emit StakingVaultSet(_stakingVault, token);
    }

    /**
     * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract.
     * Called by {upgradeTo} and {upgradeToAndCall}.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @dev Allows users to stake assets in the vault.
     * @param assets The amount of assets to stake.
     */
    function stake(uint256 assets) external amountGreaterThanZero(assets) nonReentrant {
        token.safeTransferFrom(msg.sender, address(this), assets);
        
        // Apply input fee and get net assets (fee accumulation handled internally)
        uint256 netAssets = _applyInputFee(assets);
        
        // Approve the staking vault to spend the net assets
        token.forceApprove(address(stakingVault), netAssets);
        // Deposit net assets into the staking vault and receive shares
        uint256 shares = stakingVault.deposit(netAssets, address(this));
        // Reset the approval to zero to prevent re-entrancy attacks
        token.forceApprove(address(stakingVault), 0);

        // Mint this ERC20 token as proof of ownership
        _mint(msg.sender, shares);
        emit Stake(msg.sender, assets, shares);
    }

    /**
     * @dev Allows users to unstake their shares and receive the underlying assets.
     * @param shares The number of shares to unstake.
     */
    function unstake(
        uint256 shares
    ) external amountGreaterThanZero(shares) hasEnoughShares(shares) nonReentrant {
        // Redeem shares for assets
        uint256 grossAssets = stakingVault.redeem(shares, address(this), address(this));
        
        // Apply output fee and get net assets (fee accumulation handled internally)
        uint256 netAssets = _applyOutputFee(grossAssets);
        
        // Transfer net assets to user
        token.safeTransfer(msg.sender, netAssets);
        
        // Burn the ERC20 staking token
        _burn(msg.sender, shares);
        emit Unstake(msg.sender, shares, netAssets);
    }

    /**
     * @dev Allows the owner to set the input fee rate for staking operations.
     * @param _inputFeeRate The new input fee rate in basis points (1 basis point = 0.01%).
     */
    function setInputFeeRate(uint256 _inputFeeRate) external onlyOwner {
        if (_inputFeeRate > MAX_FEE_RATE) revert InvalidFeeRate();
        
        uint256 oldFeeRate = inputFeeRate;
        inputFeeRate = _inputFeeRate;
        
        emit InputFeeRateUpdated(oldFeeRate, _inputFeeRate);
    }

    /**
     * @dev Allows the owner to set the output fee rate for unstaking operations.
     * @param _outputFeeRate The new output fee rate in basis points (1 basis point = 0.01%).
     */
    function setOutputFeeRate(uint256 _outputFeeRate) external onlyOwner {
        if (_outputFeeRate > MAX_FEE_RATE) revert InvalidFeeRate();
        
        uint256 oldFeeRate = outputFeeRate;
        outputFeeRate = _outputFeeRate;
        
        emit OutputFeeRateUpdated(oldFeeRate, _outputFeeRate);
    }

    /**
     * @dev Allows the owner to withdraw accumulated fees.
     * @param recipient The address to receive the fees.
     */
    function withdrawFees(address recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        if (accumulatedFees == 0) revert NoFeesToWithdraw();
        
        uint256 feesToWithdraw = accumulatedFees;
        accumulatedFees = 0;
        
        token.safeTransfer(recipient, feesToWithdraw);
        
        emit FeesWithdrawn(recipient, feesToWithdraw);
    }

    /**
     * @dev Returns the current version of the contract.
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}
