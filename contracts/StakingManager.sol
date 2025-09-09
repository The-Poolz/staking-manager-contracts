// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IMorphoVault.sol";
import "./StakingAdmin.sol";

/**
 * @title StakingManager
 * @dev Upgradeable staking contract that also acts as an ERC20 token representing staked shares.
 */
contract StakingManager is StakingAdmin, ReentrancyGuardUpgradeable, ERC4626Upgradeable {
    using SafeERC20 for IERC20;
    using Math for uint256;

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
        IMorphoVault _stakingVault,
        string memory name,
        string memory symbol,
        address owner
    ) public initializer notZeroAddress(address(_stakingVault)) notZeroAddress(owner) {
        // Initialize inherited contracts
        __Ownable_init(owner);
        __ReentrancyGuard_init();
        __ERC20_init(name, symbol);
        __ERC4626_init(IERC20(_stakingVault.asset()));
        __Pausable_init();
        __UUPSUpgradeable_init();

        // Initialize immutable-like variables (stored in storage for upgradeable contracts)
        stakingVault = _stakingVault;
        token = IERC20(_stakingVault.asset());

        DECIMALS_OFFSET = _stakingVault.DECIMALS_OFFSET();
        
        // Initialize mutable state with 0% fees
        inputFeeRate = 0;
        outputFeeRate = 0;

        emit Events.StakingVaultSet(_stakingVault, token);
    }

    function _decimalsOffset() internal view override returns (uint8) {
        return DECIMALS_OFFSET;
    }

    /**
     * @dev Override totalAssets to resolve conflict and implement ERC4626 logic
     * Returns the total amount of underlying assets held by the vault
     */
    function totalAssets() public view override(ERC4626Upgradeable, StakingState) returns (uint256) {
        // Return total assets from the underlying staking vault
        return stakingVault.convertToAssets(stakingVault.balanceOf(address(this)));
    }

    // stake assets and receive shares
    function deposit(uint256 assets, address receiver) public override whenNotPaused returns (uint256 shares) {
        shares = previewDeposit(assets);
        uint256 vaultShare = stakingVault.previewDeposit(assets);
        // Calculate fee and deposit all assets into vault
        uint256 feeAmount = _calculateFeeAmount(assets, inputFeeRate);
        // Split shares between user and fee recipient
        uint256 feeShares = _feeShares(vaultShare, assets, feeAmount);
        uint256 userShares = _userShares(shares, assets, feeAmount);

        _handleInputFeeShares(feeAmount, feeShares);

        _deposit(_msgSender(), receiver, assets, userShares);
        _depositIntoVault(assets);
    }

    function withdraw(uint256 assets, address receiver, address owner) public override whenNotPaused returns (uint256 shares) {
        // Preview the total assets we would get from redeeming all shares
        shares = stakingVault.previewWithdraw(assets);
        uint256 grossAssets = stakingVault.previewRedeem(shares);
        // Calculate fee amount
        uint256 feeAmount = _calculateFeeAmount(grossAssets, outputFeeRate);
        (uint256 feeShares, uint256 userShares) = _splitShares(shares, grossAssets, feeAmount);
        _handleOutputFeeShares(feeAmount, feeShares);

        uint256 actualShares = previewWithdraw(grossAssets); // calculate before redeeming to avoid rounding issues
        uint256 actualAssets = stakingVault.redeem(userShares, address(this), address(this));

        _withdraw(_msgSender(), receiver, owner, actualAssets, actualShares);
    }

    function mint(uint256 shares, address receiver) public override whenNotPaused returns (uint256 assets) {
        return super.mint(shares, receiver);
    }

    function redeem(uint256 shares, address receiver, address owner) public override whenNotPaused returns (uint256 assets) {
        return super.redeem(shares, receiver, owner);
    }
}
