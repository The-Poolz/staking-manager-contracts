// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC4626.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract StackingManager is Ownable {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // The vault where assets are staked
    IERC4626 public immutable stackingVault;

    // The token that is being staked
    IERC20 public immutable token;

    // Mapping of user addresses to their shares in the vault
    mapping(address => uint256) public userShares;

    // Custom errors for better gas efficiency
    error AmountMustBeGreaterThanZero();
    error InsufficientShares();
    error ZeroAddress();

    // Events to log staking and unstaking actions
    event Stake(address indexed user, uint256 assets, uint256 shares);
    event Unstake(address indexed user, uint256 shares, uint256 assets);

    /**
     * @dev Initializes the contract with the stacking vault address.
     * @param _stackingVault The address of the IERC4626 vault where assets will be staked.
     */
    constructor(IERC4626 _stackingVault) Ownable(_msgSender()) {
        if (address(_stackingVault) == address(0)) revert ZeroAddress();

        stackingVault = _stackingVault;
        token = IERC20(_stackingVault.asset());
    }

    /**
     * @dev Allows users to stake assets in the vault.
     * @param assets The amount of assets to stake.
     */
    function stake(uint256 assets) external {
        if (assets == 0) revert AmountMustBeGreaterThanZero();

        token.safeTransferFrom(msg.sender, address(this), assets);
        // Approve the vault to spend the assets        
        token.forceApprove(address(stackingVault), assets);
        // Deposit into vault as this contract
        uint256 shares = stackingVault.deposit(assets, address(this));
        // Zero out the approval to prevent re-entrancy
        token.forceApprove(address(stackingVault), 0);

        userShares[msg.sender] += shares;

        emit Stake(msg.sender, assets, shares);
    }

    /**
     * @dev Allows users to unstake their shares and receive the underlying assets.
     * @param shares The number of shares to unstake.
     */
    function unstake(uint256 shares) external {
        if (shares == 0) revert AmountMustBeGreaterThanZero();
        if (shares > userShares[msg.sender]) revert InsufficientShares();

        userShares[msg.sender] -= shares;

        // Withdraw from vault to this contract
        uint256 assets = stackingVault.redeem(
            shares,
            address(this),
            address(this)
        );

        // Send tokens to user
        token.safeTransfer(msg.sender, assets);

        emit Unstake(msg.sender, shares, assets);
    }

    /**
     * @dev Returns the total assets staked by a user.
     * @param user The address of the user.
     * @return The total assets staked by the user.
     */
    function totalUserAssets(address user) external view returns (uint256) {
        return stackingVault.previewRedeem(userShares[user]);
    }

    /**
     * @dev Returns the total assets in the vault.
     * @return The total assets in the vault.
     */
    function totalAssets() external view returns (uint256) {
        return stackingVault.previewRedeem(stackingVault.balanceOf(address(this)));
    }
}
