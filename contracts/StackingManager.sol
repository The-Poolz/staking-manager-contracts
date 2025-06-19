// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract StackingManager is Ownable {
    using SafeERC20 for IERC20;

    // The stacking vault that will be used for staking and unstaking
    IERC4626 public stackingVault;

    // The token that will be used for staking
    IERC20 public token;

    // errors
    error AmountMustBeGreaterThanZero();
    error ZeroAddress();

    // events
    event Stake(address indexed user, uint256 shares);
    event StakingVaultSet(IERC4626 indexed stackingVault, IERC20 indexed token);
    event Unstake(address indexed user, uint256 shares);

    constructor(IERC4626 _stackingVault) Ownable(_msgSender()) {
        if (address(_stackingVault) == address(0)) revert ZeroAddress();

        stackingVault = _stackingVault;
        token = IERC20(_stackingVault.asset());
        emit StakingVaultSet(stackingVault, token);
    }

    /// @notice Sets the stacking vault and token
    /// @param amount The amount of tokens to stake
    function stake(uint256 amount) external {
        if (amount == 0) revert AmountMustBeGreaterThanZero();

        // Transfer the tokens from the sender to this contract
        IERC20(stackingVault.asset()).safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );

        // Approve the stacking vault to spend the tokens
        token.forceApprove(address(stackingVault), type(uint256).max);
        // Deposit the tokens into the stacking vault
        stackingVault.deposit(amount, msg.sender);
        // Reset the approval to zero to prevent re-entrancy attacks
        token.forceApprove(address(stackingVault), 0);

        emit Stake(msg.sender, amount);
    }

    /// @notice Sets the stacking vault
    /// @param shares The amount of shares to unstake
    function unstake(uint256 shares) external {
        if (shares == 0) revert AmountMustBeGreaterThanZero();
        if (shares > stackingVault.balanceOf(msg.sender))
            revert AmountMustBeGreaterThanZero();

        // Withdraw the shares from the stacking vault
        uint256 amount = stackingVault.withdraw(
            shares,
            msg.sender,
            address(this)
        );
        emit Unstake(msg.sender, amount);
    }
}
