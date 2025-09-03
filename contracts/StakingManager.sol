// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./StakingAdmin.sol";
import "./interfaces/IStakingManager.sol";

/**
 * @title StakingManager
 * @dev Upgradeable staking contract that also acts as an ERC20 token representing staked shares.
 */
contract StakingManager is
    IStakingManager,
    ERC20Upgradeable,
    StakingAdmin,
    ReentrancyGuardUpgradeable
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
    ) public initializer notZeroAddress(address(_stakingVault)) notZeroAddress(owner) {
        // Initialize inherited contracts
        __ERC20_init(name, symbol);
        __Ownable_init(owner);
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        // Initialize immutable-like variables (stored in storage for upgradeable contracts)
        stakingVault = _stakingVault;
        token = IERC20(_stakingVault.asset());
        
        // Initialize mutable state with 0% fees
        inputFeeRate = 0;
        outputFeeRate = 0;

        emit Events.StakingVaultSet(_stakingVault, token);
    }

    /**
     * @dev Allows users to stake assets in the vault.
     * @param assets The amount of assets to stake.
     */
    function stake(uint256 assets) external amountGreaterThanZero(assets) nonReentrant whenNotPaused {
        token.safeTransferFrom(msg.sender, address(this), assets);

        uint256 feeAmount = _calculateFeeAmount(assets, inputFeeRate);
        uint256 totalShares = _depositIntoVault(assets);

        (uint256 userShares, uint256 feeShares) = _splitShares(totalShares, assets, feeAmount);

        _handleFeeShares(feeAmount, feeShares);
        // Mint address(this) ERC20 token as proof of ownership
        _mint(msg.sender, userShares);
        emit Events.Stake(msg.sender, assets, userShares);
    }

    /**
     * @dev Allows users to unstake their shares and receive the underlying assets.
     * @param shares The number of shares to unstake.
     */
    function unstake(
        uint256 shares
    ) external amountGreaterThanZero(shares) hasEnoughShares(shares) nonReentrant whenNotPaused {
        // Preview the total assets we would get from redeeming all shares
        uint256 grossAssets = stakingVault.previewRedeem(shares);
        
        // Calculate fee amount
        uint256 feeAmount = _calculateFeeAmount(grossAssets, outputFeeRate);
        (uint256 userShares, uint256 feeShares) = _splitShares(shares, grossAssets, feeAmount);

        // Track fee shares and emit events
        if (feeAmount > 0) {
            totalFeeShares += feeShares;
            emit Events.OutputFeeCollected(feeAmount, feeShares);
        }
        // Only redeem the user shares
        uint256 actualAssets = stakingVault.redeem(userShares, address(this), address(this));

        // Transfer net assets to user
        token.safeTransfer(msg.sender, actualAssets);
        
        // Burn the ERC20 staking token
        _burn(msg.sender, shares);
        emit Events.Unstake(msg.sender, shares, actualAssets);
    }
}
