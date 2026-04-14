// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./shared/Ownable2Step.sol";

interface IIdentityRegistry {
    function isVerified(address user) external view returns (bool);
    function countryOf(address user) external view returns (uint16);
    function investorCategory(address user) external view returns (uint8);
}

interface IERC20BalanceOf {
    function balanceOf(address user) external view returns (uint256);
}

contract DefaultCompliance is Ownable2Step {
    uint8 private constant CODE_OK = 0;
    uint8 private constant CODE_TRANSFERS_PAUSED = 1;
    uint8 private constant CODE_ZERO_RECIPIENT = 2;
    uint8 private constant CODE_SENDER_LOCKED = 3;
    uint8 private constant CODE_UNVERIFIED_SENDER = 4;
    uint8 private constant CODE_UNVERIFIED_RECIPIENT = 5;
    uint8 private constant CODE_JURISDICTION = 6;
    uint8 private constant CODE_CATEGORY = 7;
    uint8 private constant CODE_MAX_BALANCE = 8;

    address public identityRegistry;
    bool public enforceIdentity;
    bool public transfersPaused;
    bool public enforceJurisdiction;
    bool public enforceCategory;
    uint256 public maxBalancePerWallet;
    mapping(address => uint256) public addressLockupUntil;
    mapping(uint16 => bool) public allowedCountries;
    mapping(uint8 => bool) public allowedInvestorCategories;

    event IdentityRegistryUpdated(address indexed newRegistry);
    event EnforceIdentityUpdated(bool enforceIdentity);
    event EnforceJurisdictionUpdated(bool enforceJurisdiction);
    event EnforceCategoryUpdated(bool enforceCategory);
    event TransfersPausedUpdated(bool transfersPaused);
    event MaxBalancePerWalletUpdated(uint256 maxBalancePerWallet);
    event AddressLockupUpdated(address indexed account, uint256 unlockTimestamp);
    event AllowedCountryUpdated(uint16 countryCode, bool allowed);
    event AllowedInvestorCategoryUpdated(uint8 category, bool allowed);
    event TransferCheckLogged(
        address indexed caller,
        address indexed token,
        address indexed from,
        address to,
        uint256 amount,
        bool allowed,
        uint8 reasonCode
    );

    constructor(address identityRegistry_) {
        require(identityRegistry_ != address(0), "Zero registry");
        _initializeOwner(msg.sender);
        identityRegistry = identityRegistry_;
        enforceIdentity = true;
    }

    function setIdentityRegistry(address newRegistry) external onlyOwner {
        require(newRegistry != address(0), "Zero registry");
        identityRegistry = newRegistry;
        emit IdentityRegistryUpdated(newRegistry);
    }

    function setEnforceIdentity(bool enforceIdentity_) external onlyOwner {
        enforceIdentity = enforceIdentity_;
        emit EnforceIdentityUpdated(enforceIdentity_);
    }

    function setTransfersPaused(bool paused) external onlyOwner {
        transfersPaused = paused;
        emit TransfersPausedUpdated(paused);
    }

    function setEnforceJurisdiction(bool enforce) external onlyOwner {
        enforceJurisdiction = enforce;
        emit EnforceJurisdictionUpdated(enforce);
    }

    function setEnforceCategory(bool enforce) external onlyOwner {
        enforceCategory = enforce;
        emit EnforceCategoryUpdated(enforce);
    }

    function setMaxBalancePerWallet(uint256 maxBalance) external onlyOwner {
        maxBalancePerWallet = maxBalance;
        emit MaxBalancePerWalletUpdated(maxBalance);
    }

    function setAddressLockup(address account, uint256 unlockTimestamp) external onlyOwner {
        require(account != address(0), "Zero account");
        addressLockupUntil[account] = unlockTimestamp;
        emit AddressLockupUpdated(account, unlockTimestamp);
    }

    function setAllowedCountry(uint16 countryCode, bool allowed) external onlyOwner {
        allowedCountries[countryCode] = allowed;
        emit AllowedCountryUpdated(countryCode, allowed);
    }

    function setAllowedInvestorCategory(uint8 category, bool allowed) external onlyOwner {
        allowedInvestorCategories[category] = allowed;
        emit AllowedInvestorCategoryUpdated(category, allowed);
    }

    function canTransfer(
        address token,
        address from,
        address to,
        uint256 amount
    ) external view returns (bool) {
        (bool allowed, ) = getTransferCheck(token, from, to, amount);
        return allowed;
    }

    function getTransferCheck(
        address token,
        address from,
        address to,
        uint256 amount
    ) public view returns (bool allowed, uint8 reasonCode) {
        if (transfersPaused) {
            return (false, CODE_TRANSFERS_PAUSED);
        }
        if (to == address(0)) {
            return (false, CODE_ZERO_RECIPIENT);
        }
        if (from != address(0) && block.timestamp < addressLockupUntil[from]) {
            return (false, CODE_SENDER_LOCKED);
        }

        if (enforceIdentity) {
            if (from != address(0) && !IIdentityRegistry(identityRegistry).isVerified(from)) {
                return (false, CODE_UNVERIFIED_SENDER);
            }
            if (!IIdentityRegistry(identityRegistry).isVerified(to)) {
                return (false, CODE_UNVERIFIED_RECIPIENT);
            }
        }

        if (enforceJurisdiction) {
            if (!allowedCountries[IIdentityRegistry(identityRegistry).countryOf(to)]) {
                return (false, CODE_JURISDICTION);
            }
            if (from != address(0) && !allowedCountries[IIdentityRegistry(identityRegistry).countryOf(from)]) {
                return (false, CODE_JURISDICTION);
            }
        }

        if (enforceCategory) {
            if (!allowedInvestorCategories[IIdentityRegistry(identityRegistry).investorCategory(to)]) {
                return (false, CODE_CATEGORY);
            }
            if (
                from != address(0) &&
                !allowedInvestorCategories[IIdentityRegistry(identityRegistry).investorCategory(from)]
            ) {
                return (false, CODE_CATEGORY);
            }
        }

        if (maxBalancePerWallet > 0 && from != to) {
            uint256 recipientBalance = IERC20BalanceOf(token).balanceOf(to);
            if (recipientBalance + amount > maxBalancePerWallet) {
                return (false, CODE_MAX_BALANCE);
            }
        }

        return (true, CODE_OK);
    }

    function logTransferCheck(
        address token,
        address from,
        address to,
        uint256 amount
    ) external returns (bool allowed, uint8 reasonCode) {
        (allowed, reasonCode) = getTransferCheck(token, from, to, amount);
        emit TransferCheckLogged(msg.sender, token, from, to, amount, allowed, reasonCode);
    }
}
