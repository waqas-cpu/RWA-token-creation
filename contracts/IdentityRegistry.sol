// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./shared/Ownable2Step.sol";

contract IdentityRegistry is Ownable2Step {
    mapping(address => bool) private _verified;
    mapping(address => bool) public trustedIssuers;
    mapping(address => mapping(uint256 => bool)) private _claimsByTopic;
    mapping(uint256 => bool) public requiredClaimTopics;
    uint256[] private _requiredClaimTopicList;
    mapping(address => uint16) public countryOf;
    mapping(address => uint8) public investorCategory;

    event IdentityStatusUpdated(address indexed user, bool isVerified);
    event TrustedIssuerUpdated(address indexed issuer, bool allowed);
    event ClaimUpdated(address indexed issuer, address indexed user, uint256 indexed topic, bool status);
    event RequiredClaimTopicUpdated(uint256 indexed topic, bool required);
    event InvestorProfileUpdated(address indexed user, uint16 countryCode, uint8 category);

    modifier onlyClaimIssuer() {
        require(msg.sender == owner || trustedIssuers[msg.sender], "Only claim issuer");
        _;
    }

    constructor() {
        _initializeOwner(msg.sender);
    }

    function setVerified(address user, bool status) external onlyOwner {
        require(user != address(0), "Zero user");
        _verified[user] = status;
        emit IdentityStatusUpdated(user, status);
    }

    function setVerifiedBatch(address[] calldata users, bool status) external onlyOwner {
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            require(user != address(0), "Zero user");
            _verified[user] = status;
            emit IdentityStatusUpdated(user, status);
        }
    }

    function setTrustedIssuer(address issuer, bool allowed) external onlyOwner {
        require(issuer != address(0), "Zero issuer");
        trustedIssuers[issuer] = allowed;
        emit TrustedIssuerUpdated(issuer, allowed);
    }

    function setRequiredClaimTopic(uint256 topic, bool required) external onlyOwner {
        if (!requiredClaimTopics[topic] && required) {
            _requiredClaimTopicList.push(topic);
        }
        requiredClaimTopics[topic] = required;
        emit RequiredClaimTopicUpdated(topic, required);
    }

    function issueClaim(address user, uint256 topic, bool status) external onlyClaimIssuer {
        require(user != address(0), "Zero user");
        _claimsByTopic[user][topic] = status;
        emit ClaimUpdated(msg.sender, user, topic, status);
    }

    function setInvestorProfile(address user, uint16 countryCode, uint8 category) external onlyOwner {
        require(user != address(0), "Zero user");
        countryOf[user] = countryCode;
        investorCategory[user] = category;
        emit InvestorProfileUpdated(user, countryCode, category);
    }

    function hasClaim(address user, uint256 topic) external view returns (bool) {
        return _claimsByTopic[user][topic];
    }

    function hasRequiredClaims(address user) external view returns (bool) {
        return _hasRequiredClaims(user);
    }

    function isVerified(address user) external view returns (bool) {
        return _verified[user] && _hasRequiredClaims(user);
    }

    function _hasRequiredClaims(address user) internal view returns (bool) {
        for (uint256 i = 0; i < _requiredClaimTopicList.length; i++) {
            uint256 topic = _requiredClaimTopicList[i];
            if (requiredClaimTopics[topic] && !_claimsByTopic[user][topic]) {
                return false;
            }
        }
        return true;
    }
}
