// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "./interfaces/IMorphoVault.sol";
import "./StakingModifiers.sol";
import "./StakingState.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";


abstract contract StakingProxy is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    ERC4626Upgradeable,
    PausableUpgradeable,
    StakingModifiers,
    StakingState
{
    /**
     * @dev Returns the current version of the contract.
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }

    /**
     * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract.
     * Called by {upgradeTo} and {upgradeToAndCall}.
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
    
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
        DECIMALS_OFFSET = _stakingVault.DECIMALS_OFFSET();

        // Initialize mutable state with 0% fees
        inputFeeRate = 0;
        outputFeeRate = 0;

        emit Events.StakingVaultSet(_stakingVault, IERC20(_stakingVault.asset()));
    }

    /**
     * @dev Override totalAssets to resolve conflict and implement ERC4626 logic
     * Returns the total amount of underlying assets held by the vault
     */
    function totalAssets() public view override(ERC4626Upgradeable, StakingState) returns (uint256) {
        // Return total assets from the underlying staking vault
        return stakingVault.convertToAssets(stakingVault.balanceOf(address(this)));
    }

    /// @dev asset function conflict resolution
    function asset() public view override(StakingState, ERC4626Upgradeable) returns (address) {
        return super.asset();
    }
}
