// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./StakingModifiers.sol";

/**
 * @title StakingManager
 * @dev Staking contract that also acts as an ERC20 token representing staked shares.
 */
contract StakingManager is Ownable, StakingModifiers {
    using SafeERC20 for IERC20;

    /**
     * @dev Initializes the contract with the staking vault address.
     * @param _stakingVault The address of the IERC4626 vault where assets will be staked.
     */
    constructor(
        IERC4626 _stakingVault,
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) Ownable(_msgSender()) {
        if (address(_stakingVault) == address(0)) revert ZeroAddress();

        // Initialize immutable variables
        stakingVault = _stakingVault;
        token = IERC20(_stakingVault.asset());
        
        // Initialize mutable state with 0% fees
        inputFeeRate = 0;
        outputFeeRate = 0;

        emit StakingVaultSet(_stakingVault, token);
    }

    /**
     * @dev Allows users to stake assets in the vault.
     * @param assets The amount of assets to stake.
     */
    function stake(uint256 assets) external amountGreaterThanZero(assets) {
        token.safeTransferFrom(msg.sender, address(this), assets);
        
        // Calculate input fee and net assets for staking
        (uint256 feeAmount, uint256 netAssets) = _calculateInputFee(assets);
        
        // Collect input fee if applicable
        if (feeAmount > 0) {
            accumulatedFees += feeAmount;
            emit InputFeeCollected(feeAmount);
        }
        
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
    ) external amountGreaterThanZero(shares) hasEnoughShares(shares) {
        // Redeem shares for assets
        uint256 grossAssets = stakingVault.redeem(shares, address(this), address(this));
        
        // Calculate output fee and net assets for unstaking
        (uint256 feeAmount, uint256 netAssets) = _calculateOutputFee(grossAssets);
        
        // Collect output fee if applicable
        if (feeAmount > 0) {
            accumulatedFees += feeAmount;
            emit OutputFeeCollected(feeAmount);
        }
        
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
}
