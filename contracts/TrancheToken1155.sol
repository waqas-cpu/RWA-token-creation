// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./shared/Ownable2Step.sol";

contract TrancheToken1155 is Ownable2Step {
    mapping(address => bool) public minters;
    mapping(uint256 => mapping(address => uint256)) private _balances;

    event MinterUpdated(address indexed account, bool allowed);
    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);

    modifier onlyMinter() {
        require(minters[msg.sender], "Only minter");
        _;
    }

    constructor() {
        _initializeOwner(msg.sender);
        minters[msg.sender] = true;
        emit MinterUpdated(msg.sender, true);
    }

    function setMinter(address account, bool allowed) external onlyOwner {
        require(account != address(0), "Zero account");
        minters[account] = allowed;
        emit MinterUpdated(account, allowed);
    }

    function balanceOf(address account, uint256 id) external view returns (uint256) {
        require(account != address(0), "Zero account");
        return _balances[id][account];
    }

    function mint(address to, uint256 id, uint256 amount) external onlyMinter {
        require(to != address(0), "Zero recipient");
        require(amount > 0, "Zero amount");
        _balances[id][to] += amount;
        emit TransferSingle(msg.sender, address(0), to, id, amount);
    }

    function burn(address from, uint256 id, uint256 amount) external onlyMinter {
        require(from != address(0), "Zero holder");
        require(amount > 0, "Zero amount");
        uint256 current = _balances[id][from];
        require(current >= amount, "Insufficient balance");
        unchecked {
            _balances[id][from] = current - amount;
        }
        emit TransferSingle(msg.sender, from, address(0), id, amount);
    }
}
