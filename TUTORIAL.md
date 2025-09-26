# Hello FHEVM: Building Your First Confidential Application

Welcome to the complete beginner's guide for building confidential applications with FHEVM (Fully Homomorphic Encryption Virtual Machine). This tutorial will guide you through creating a privacy-preserving Q&A platform from scratch.

## 🎯 What You'll Learn

By the end of this tutorial, you'll have:
- Built a complete privacy-focused Q&A platform
- Understood how to use FHEVM for confidential smart contracts
- Implemented encrypted data storage and operations
- Created a frontend that interacts with encrypted blockchain data
- Deployed your first confidential application

## 🔧 Prerequisites

This tutorial assumes you have:
- Basic Solidity knowledge (can write and deploy simple smart contracts)
- Familiarity with standard Ethereum development tools (Hardhat, MetaMask, JavaScript)
- **No prior FHE or cryptography knowledge required!**

## 📚 Core Concepts

### What is FHEVM?

FHEVM (Fully Homomorphic Encryption Virtual Machine) allows you to perform computations on encrypted data without ever decrypting it. This means:

- **Privacy by Design**: User data remains encrypted on-chain
- **Confidential Operations**: Smart contracts can process encrypted inputs
- **Selective Disclosure**: Users control what data they reveal and to whom

### Our Privacy Q&A Platform

We'll build a platform where users can:
- Ask questions with encrypted content
- Submit encrypted answers
- Vote on answers while keeping scores private
- Build reputation without revealing exact scores
- Maintain complete anonymity

## 🚀 Getting Started

### Step 1: Project Setup

First, let's set up our project structure:

```bash
mkdir privacy-qa-platform
cd privacy-qa-platform
npm init -y
```

Install the required dependencies:

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install @fhevm/solidity ethers
```

Initialize Hardhat:

```bash
npx hardhat init
```

### Step 2: Project Structure

Your project should look like this:

```
privacy-qa-platform/
├── contracts/
│   └── PrivacyQA.sol
├── scripts/
│   └── deploy.js
├── hardhat.config.js
├── package.json
├── index.html
├── js/
│   └── app.js
└── css/
    └── styles.css
```

## 📝 Smart Contract Development

### Step 3: Understanding FHEVM Imports

Let's start with the essential FHEVM imports:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint8, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
```

**Key Points:**
- `FHE`: Core library for homomorphic operations
- `euint8`, `euint32`: Encrypted integer types
- `ebool`: Encrypted boolean type
- `SepoliaConfig`: Network configuration for Zama testnet

### Step 4: Data Structures with Encryption

Here's how we define our data structures with encrypted fields:

```solidity
struct Question {
    uint32 id;
    string category;                 // Public category for filtering
    string encryptedContent;         // Encrypted question content
    address author;
    uint256 timestamp;
    uint32 answerCount;
    euint8 reputationRequired;       // Encrypted reputation requirement
    bool isActive;
    uint256 bounty;
}

struct Answer {
    uint32 id;
    uint32 questionId;
    string encryptedContent;         // Encrypted answer content
    address author;
    uint256 timestamp;
    euint32 encryptedScore;          // Encrypted voting score
    bool isVerified;
    bool isBestAnswer;
}

struct UserProfile {
    euint32 encryptedReputation;     // Private reputation score
    euint32 encryptedContributions;  // Private contribution count
    bool isExpert;
    string[] specialties;
    uint256 joinDate;
}
```

**Design Decisions:**
- Mix of public and encrypted fields for functionality
- Public categories enable filtering while keeping content private
- Encrypted scores protect user voting patterns

### Step 5: User Initialization with FHE

```solidity
function initializeUser(uint32 _initialReputation) external {
    require(userProfiles[msg.sender].joinDate == 0, "User already initialized");

    // Convert plain values to encrypted ones
    euint32 encryptedReputation = FHE.asEuint32(_initialReputation);
    euint32 encryptedContributions = FHE.asEuint32(0);

    userProfiles[msg.sender] = UserProfile({
        encryptedReputation: encryptedReputation,
        encryptedContributions: encryptedContributions,
        isExpert: false,
        specialties: new string[](0),
        joinDate: block.timestamp
    });

    // Set permissions for encrypted data
    FHE.allowThis(encryptedReputation);
    FHE.allowThis(encryptedContributions);
    FHE.allow(encryptedReputation, msg.sender);
    FHE.allow(encryptedContributions, msg.sender);
}
```

**Key Concepts:**
- `FHE.asEuint32()`: Converts plain integers to encrypted form
- `FHE.allowThis()`: Allows contract to access encrypted data
- `FHE.allow()`: Grants specific address permission to decrypt data

### Step 6: Posting Questions with Encrypted Content

```solidity
function postQuestion(
    string calldata _category,
    string calldata _encryptedContent,
    uint8 _reputationRequired
) external payable {
    require(userProfiles[msg.sender].joinDate != 0, "User not initialized");
    require(bytes(_encryptedContent).length > 0, "Question content cannot be empty");

    euint8 encryptedReputationRequired = FHE.asEuint8(_reputationRequired);

    questions[nextQuestionId] = Question({
        id: nextQuestionId,
        category: _category,
        encryptedContent: _encryptedContent,
        author: msg.sender,
        timestamp: block.timestamp,
        answerCount: 0,
        reputationRequired: encryptedReputationRequired,
        isActive: true,
        bounty: msg.value
    });

    userQuestions[msg.sender].push(nextQuestionId);
    categoryQuestions[_category].push(nextQuestionId);

    FHE.allowThis(encryptedReputationRequired);
    FHE.allow(encryptedReputationRequired, msg.sender);

    emit QuestionPosted(nextQuestionId, msg.sender, _category);
    nextQuestionId++;
}
```

### Step 7: Voting with Encrypted Scores

```solidity
function voteOnAnswer(uint32 _answerId, uint32 _score) external answerExists(_answerId) {
    require(userProfiles[msg.sender].joinDate != 0, "User not initialized");

    Answer storage answer = answers[_answerId];
    euint32 encryptedScore = FHE.asEuint32(_score);

    // Add encrypted score to existing score
    answer.encryptedScore = FHE.add(answer.encryptedScore, encryptedScore);

    FHE.allowThis(answer.encryptedScore);
    FHE.allow(answer.encryptedScore, answer.author);

    emit VoteCasted(_answerId, msg.sender);
}
```

**FHE Operations:**
- `FHE.add()`: Adds encrypted values without decryption
- Scores remain private while allowing mathematical operations

## 🎨 Frontend Development

### Step 8: Setting Up Web3 with FHEVM

```javascript
// Contract Configuration
const CONTRACT_ADDRESS = 'YOUR_DEPLOYED_CONTRACT_ADDRESS';
const CONTRACT_ABI = [
    // Your contract ABI here
];

// Initialize Web3 connection
async function initializeWeb3() {
    if (typeof window.ethereum !== 'undefined') {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    }
}
```

### Step 9: Handling Encrypted Inputs

```javascript
async function postQuestion() {
    const category = document.getElementById('questionCategory').value;
    const content = document.getElementById('questionContent').value;
    const reputationRequired = document.getElementById('reputationRequired').value;
    const bounty = document.getElementById('bounty').value;

    try {
        // In a real implementation, you would encrypt the content here
        // For this demo, we're passing it as a string
        const encryptedContent = await encryptContent(content);

        const tx = await contract.postQuestion(
            category,
            encryptedContent,
            parseInt(reputationRequired),
            { value: ethers.utils.parseEther(bounty || '0') }
        );

        await tx.wait();
        showStatus('Question posted successfully!', 'success');
        await loadQuestions();
    } catch (error) {
        showStatus('Error posting question: ' + error.message, 'error');
    }
}
```

### Step 10: Displaying Encrypted Data

```javascript
async function displayQuestion(questionId) {
    try {
        const questionInfo = await contract.getQuestionInfo(questionId);

        // Public data can be displayed directly
        const category = questionInfo.category;
        const author = questionInfo.author;
        const timestamp = new Date(questionInfo.timestamp * 1000);

        // Encrypted content requires special handling
        const encryptedContent = questionInfo.encryptedContent;

        return `
            <div class="question-card">
                <div class="question-meta">
                    <span class="category">${category}</span>
                    <span class="author">${author.slice(0, 6)}...${author.slice(-4)}</span>
                    <span class="timestamp">${timestamp.toLocaleDateString()}</span>
                </div>
                <div class="question-content">
                    <p>${encryptedContent}</p>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error displaying question:', error);
    }
}
```

## 🔐 Understanding Privacy Features

### Access Control Patterns

FHEVM uses a permission system for encrypted data:

```solidity
// Grant permission to contract
FHE.allowThis(encryptedData);

// Grant permission to specific user
FHE.allow(encryptedData, userAddress);

// Grant permission to multiple parties
FHE.allow(encryptedData, address1);
FHE.allow(encryptedData, address2);
```

### Selective Disclosure

Users can choose what information to reveal:

```solidity
function revealReputation() external view returns (uint32) {
    UserProfile storage profile = userProfiles[msg.sender];
    // Only the user can decrypt their own reputation
    return FHE.decrypt(profile.encryptedReputation);
}
```

## 🧪 Testing Your Application

### Step 11: Writing Tests

Create comprehensive tests for your FHEVM contracts:

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PrivacyQA", function () {
    let privacyQA;
    let owner, user1, user2;

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        const PrivacyQA = await ethers.getContractFactory("PrivacyQA");
        privacyQA = await PrivacyQA.deploy();
        await privacyQA.deployed();
    });

    it("Should initialize user profile", async function () {
        await privacyQA.connect(user1).initializeUser(50);

        const profile = await privacyQA.getUserInfo(user1.address);
        expect(profile.joinDate).to.be.gt(0);
    });

    it("Should post question with encrypted content", async function () {
        await privacyQA.connect(user1).initializeUser(50);

        await expect(
            privacyQA.connect(user1).postQuestion(
                "Technology",
                "What is FHEVM?",
                10
            )
        ).to.emit(privacyQA, "QuestionPosted");
    });
});
```

## 🚀 Deployment Guide

### Step 12: Hardhat Configuration

Configure Hardhat for Zama's testnet:

```javascript
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
    solidity: "0.8.24",
    networks: {
        zama: {
            url: "https://devnet.zama.ai/",
            accounts: [process.env.PRIVATE_KEY]
        }
    }
};
```

### Step 13: Deploy Script

```javascript
const hre = require("hardhat");

async function main() {
    const PrivacyQA = await hre.ethers.getContractFactory("PrivacyQA");
    const privacyQA = await PrivacyQA.deploy();

    await privacyQA.deployed();

    console.log("PrivacyQA deployed to:", privacyQA.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

## 🎯 Key Takeaways

### What Makes This Different from Regular Smart Contracts?

1. **Data Privacy**: Sensitive information stays encrypted on-chain
2. **Selective Disclosure**: Users control who can see their data
3. **Confidential Operations**: Computations happen on encrypted data
4. **Permission System**: Fine-grained access control for encrypted values

### Best Practices for FHEVM Development

1. **Design with Privacy in Mind**: Decide what needs encryption early
2. **Minimize Decryption**: Keep sensitive data encrypted as long as possible
3. **Permission Management**: Carefully manage who can access encrypted data
4. **Gas Optimization**: FHE operations are more expensive than regular ones
5. **User Experience**: Design UIs that work well with encrypted data

### Common Pitfalls to Avoid

1. **Over-encryption**: Not everything needs to be encrypted
2. **Permission Errors**: Forgetting to grant necessary permissions
3. **Type Mismatches**: Mixing encrypted and plain values incorrectly
4. **Gas Estimation**: FHE operations use more gas than expected

## 🔄 Next Steps

Now that you've built your first FHEVM application:

1. **Experiment**: Try adding new encrypted fields or operations
2. **Optimize**: Look for ways to reduce gas costs
3. **Expand**: Add more complex privacy features
4. **Deploy**: Launch on Zama's testnet and share with others
5. **Learn More**: Explore advanced FHE operations and patterns

## 📖 Additional Resources

- [Zama Documentation](https://docs.zama.ai/)
- [FHEVM GitHub Repository](https://github.com/zama-ai/fhevm)
- [Community Discord](https://discord.gg/zama)
- [Sample Projects](https://github.com/zama-ai/fhevm-examples)

## 🤝 Contributing

This tutorial is open source! If you find improvements or have suggestions:

1. Fork the repository
2. Make your changes
3. Submit a pull request
4. Help other developers learn FHEVM

---

**Congratulations!** 🎉 You've successfully built your first confidential application with FHEVM. You now understand the fundamentals of privacy-preserving smart contracts and can start building more complex confidential applications.

Remember: Privacy is not just a feature—it's a fundamental right. By building with FHEVM, you're helping create a more private and secure decentralized future.