// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./shared/Ownable2Step.sol";

interface ICompliance {
    function canTransfer(address token, address from, address to, uint256 amount) external view returns (bool);
}

contract ERC3643Token is Ownable2Step {
    uint256 public constant MAX_TOTAL_SUPPLY = 500;
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    address public identityRegistry;
    address public compliance;
    mapping(address => bool) public isIssuer;
    mapping(address => bool) public isCustodian;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event ComplianceUpdated(address indexed compliance);
    event IdentityRegistryUpdated(address indexed identityRegistry);
    event IssuerUpdated(address indexed account, bool allowed);
    event CustodianUpdated(address indexed account, bool allowed);
    event MaxSupplyReached(uint256 totalSupply);

    modifier onlyIssuerOrOwner() {
        require(msg.sender == owner || isIssuer[msg.sender], "Only issuer");
        _;
    }

    modifier onlyCustodianOrOwner() {
        require(msg.sender == owner || isCustodian[msg.sender], "Only custodian");
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        address identityRegistry_,
        address compliance_
    ) {
        require(identityRegistry_ != address(0), "Zero registry");
        require(compliance_ != address(0), "Zero compliance");
        name = name_;
        symbol = symbol_;
        _initializeOwner(msg.sender);
        identityRegistry = identityRegistry_;
        compliance = compliance_;
        isIssuer[msg.sender] = true;
        isCustodian[msg.sender] = true;
        emit IssuerUpdated(msg.sender, true);
        emit CustodianUpdated(msg.sender, true);
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function allowance(address tokenOwner, address spender) external view returns (uint256) {
        return _allowances[tokenOwner][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        require(spender != address(0), "Zero spender");
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= amount, "Insufficient allowance");
        unchecked {
            _allowances[from][msg.sender] = currentAllowance - amount;
        }
        emit Approval(from, msg.sender, _allowances[from][msg.sender]);
        _transfer(from, to, amount);
        return true;
    }

    function mint(address to, uint256 amount) external onlyIssuerOrOwner {
        require(to != address(0), "Zero recipient");
        require(totalSupply + amount <= MAX_TOTAL_SUPPLY, "Max supply exceeded");
        require(_isCompliant(address(0), to, amount), "Transfer not compliant");
        totalSupply += amount;
        _balances[to] += amount;
        emit Transfer(address(0), to, amount);
        if (totalSupply == MAX_TOTAL_SUPPLY) {
            emit MaxSupplyReached(totalSupply);
        }
    }

    function setCompliance(address newCompliance) external onlyOwner {
        require(newCompliance != address(0), "Zero compliance");
        compliance = newCompliance;
        emit ComplianceUpdated(newCompliance);
    }

    function setIdentityRegistry(address newIdentityRegistry) external onlyOwner {
        require(newIdentityRegistry != address(0), "Zero registry");
        identityRegistry = newIdentityRegistry;
        emit IdentityRegistryUpdated(newIdentityRegistry);
    }

    function setIssuer(address account, bool allowed) external onlyOwner {
        require(account != address(0), "Zero issuer");
        isIssuer[account] = allowed;
        emit IssuerUpdated(account, allowed);
    }

    function setCustodian(address account, bool allowed) external onlyOwner {
        require(account != address(0), "Zero custodian");
        isCustodian[account] = allowed;
        emit CustodianUpdated(account, allowed);
    }

    function custodianTransfer(address from, address to, uint256 amount) external onlyCustodianOrOwner returns (bool) {
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "Zero sender");
        require(to != address(0), "Zero recipient");
        require(_balances[from] >= amount, "Insufficient balance");
        require(_isCompliant(from, to, amount), "Transfer not compliant");

        unchecked {
            _balances[from] -= amount;
        }
        _balances[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _isCompliant(address from, address to, uint256 amount) internal view returns (bool) {
        return ICompliance(compliance).canTransfer(address(this), from, to, amount);
    }
}
