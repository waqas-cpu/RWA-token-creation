// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./shared/Ownable2Step.sol";

interface IERC20Like {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface ITrancheToken1155Like {
    function mint(address to, uint256 id, uint256 amount) external;
    function burn(address from, uint256 id, uint256 amount) external;
    function balanceOf(address account, uint256 id) external view returns (uint256);
}

contract WrapperYieldVault is Ownable2Step {
    uint256 public constant FIXED_YIELD_BPS = 1000; // 10%
    uint256 public constant BPS_DENOMINATOR = 10000;
    error ReentrancyGuard();
    error VaultPaused();
    error ZeroAddress();
    error InvalidRatio();
    error UnknownTranche();
    error ZeroAmount();
    error InvalidAmount();
    error DepositFailed();
    error RedeemFailed();
    error FundingFailed();
    error NoShares();
    error NoYield();
    error InvalidYieldAmount();
    error ClaimFailed();

    uint256 private constant PRECISION = 1e18;
    uint256 private _reentrancyLock;

    struct TrancheConfig {
        bool exists;
        uint256 underlyingPerShare;
    }

    address public immutable underlyingToken;
    address public immutable trancheToken;
    bool public paused;

    mapping(uint256 => TrancheConfig) public trancheConfigs;
    mapping(uint256 => uint256) public accYieldPerShare;
    mapping(uint256 => uint256) public totalShares;
    mapping(uint256 => uint256) public principalLockedByTranche;
    uint256 public totalPrincipalLocked;
    mapping(uint256 => mapping(address => uint256)) public rewardDebt;
    mapping(uint256 => mapping(address => uint256)) public pendingYield;

    event TrancheConfigured(uint256 indexed trancheId, uint256 underlyingPerShare);
    event Deposited(address indexed investor, uint256 indexed trancheId, uint256 underlyingAmount, uint256 shares);
    event Redeemed(address indexed investor, uint256 indexed trancheId, uint256 shares, uint256 underlyingAmount);
    event YieldDistributed(uint256 indexed trancheId, uint256 yieldAmount);
    event YieldClaimed(address indexed investor, uint256 indexed trancheId, uint256 amount);
    event PausedUpdated(bool paused);

    modifier nonReentrant() {
        if (_reentrancyLock == 1) revert ReentrancyGuard();
        _reentrancyLock = 1;
        _;
        _reentrancyLock = 0;
    }

    modifier whenNotPaused() {
        if (paused) revert VaultPaused();
        _;
    }

    constructor(address underlyingToken_, address trancheToken_) {
        if (underlyingToken_ == address(0) || trancheToken_ == address(0)) revert ZeroAddress();
        _initializeOwner(msg.sender);
        underlyingToken = underlyingToken_;
        trancheToken = trancheToken_;
    }

    function configureTranche(uint256 trancheId, uint256 underlyingPerShare) external onlyOwner {
        if (underlyingPerShare == 0) revert InvalidRatio();
        trancheConfigs[trancheId] = TrancheConfig({exists: true, underlyingPerShare: underlyingPerShare});
        emit TrancheConfigured(trancheId, underlyingPerShare);
    }

    function setPaused(bool isPaused) external onlyOwner {
        paused = isPaused;
        emit PausedUpdated(isPaused);
    }

    function depositAndMint(uint256 trancheId, uint256 underlyingAmount) external nonReentrant whenNotPaused {
        TrancheConfig memory config = trancheConfigs[trancheId];
        if (!config.exists) revert UnknownTranche();
        if (underlyingAmount == 0) revert ZeroAmount();
        if (underlyingAmount % config.underlyingPerShare != 0) revert InvalidAmount();

        _syncUser(trancheId, msg.sender);

        uint256 shares = underlyingAmount / config.underlyingPerShare;
        if (!IERC20Like(underlyingToken).transferFrom(msg.sender, address(this), underlyingAmount)) revert DepositFailed();

        totalShares[trancheId] += shares;
        principalLockedByTranche[trancheId] += underlyingAmount;
        totalPrincipalLocked += underlyingAmount;
        ITrancheToken1155Like(trancheToken).mint(msg.sender, trancheId, shares);

        uint256 newBalance = ITrancheToken1155Like(trancheToken).balanceOf(msg.sender, trancheId);
        rewardDebt[trancheId][msg.sender] = (newBalance * accYieldPerShare[trancheId]) / PRECISION;
        emit Deposited(msg.sender, trancheId, underlyingAmount, shares);
    }

    function redeemAndBurn(uint256 trancheId, uint256 shares) external nonReentrant whenNotPaused {
        TrancheConfig memory config = trancheConfigs[trancheId];
        if (!config.exists) revert UnknownTranche();
        if (shares == 0) revert ZeroAmount();

        _syncUser(trancheId, msg.sender);

        uint256 underlyingAmount = shares * config.underlyingPerShare;
        totalShares[trancheId] -= shares;
        principalLockedByTranche[trancheId] -= underlyingAmount;
        totalPrincipalLocked -= underlyingAmount;
        ITrancheToken1155Like(trancheToken).burn(msg.sender, trancheId, shares);
        if (!IERC20Like(underlyingToken).transfer(msg.sender, underlyingAmount)) revert RedeemFailed();

        uint256 newBalance = ITrancheToken1155Like(trancheToken).balanceOf(msg.sender, trancheId);
        rewardDebt[trancheId][msg.sender] = (newBalance * accYieldPerShare[trancheId]) / PRECISION;
        emit Redeemed(msg.sender, trancheId, shares, underlyingAmount);
    }

    function distributeYield(uint256 trancheId, uint256 yieldAmount) external onlyOwner nonReentrant whenNotPaused {
        if (!trancheConfigs[trancheId].exists) revert UnknownTranche();
        if (yieldAmount == 0) revert ZeroAmount();
        if (totalShares[trancheId] == 0) revert NoShares();
        uint256 expectedYield = (principalLockedByTranche[trancheId] * FIXED_YIELD_BPS) / BPS_DENOMINATOR;
        if (yieldAmount != expectedYield) revert InvalidYieldAmount();
        if (!IERC20Like(underlyingToken).transferFrom(msg.sender, address(this), yieldAmount)) revert FundingFailed();

        accYieldPerShare[trancheId] += (yieldAmount * PRECISION) / totalShares[trancheId];
        emit YieldDistributed(trancheId, yieldAmount);
    }

    function claimYield(uint256 trancheId) external nonReentrant whenNotPaused {
        _syncUser(trancheId, msg.sender);
        uint256 payout = pendingYield[trancheId][msg.sender];
        if (payout == 0) revert NoYield();
        pendingYield[trancheId][msg.sender] = 0;
        if (!IERC20Like(underlyingToken).transfer(msg.sender, payout)) revert ClaimFailed();
        emit YieldClaimed(msg.sender, trancheId, payout);
    }

    function previewClaimable(address account, uint256 trancheId) external view returns (uint256) {
        uint256 userShares = ITrancheToken1155Like(trancheToken).balanceOf(account, trancheId);
        uint256 accumulated = (userShares * accYieldPerShare[trancheId]) / PRECISION;
        uint256 debt = rewardDebt[trancheId][account];
        uint256 pending = pendingYield[trancheId][account];
        if (accumulated >= debt) {
            return pending + (accumulated - debt);
        }
        return pending;
    }

    function _syncUser(uint256 trancheId, address account) internal {
        uint256 userShares = ITrancheToken1155Like(trancheToken).balanceOf(account, trancheId);
        uint256 accumulated = (userShares * accYieldPerShare[trancheId]) / PRECISION;
        uint256 debt = rewardDebt[trancheId][account];
        if (accumulated > debt) {
            pendingYield[trancheId][account] += (accumulated - debt);
        }
        rewardDebt[trancheId][account] = accumulated;
    }

    function isSolvent() external view returns (bool) {
        return IERC20Like(underlyingToken).balanceOf(address(this)) >= totalPrincipalLocked;
    }
}
