// Contract Configuration
const CONTRACT_ADDRESS = '0xF09C6faDa8879c2f047e21318e41740429cA5D45';
const CONTRACT_ABI = [
    "function owner() external view returns (address)",
    "function nextQuestionId() external view returns (uint32)",
    "function nextAnswerId() external view returns (uint32)",
    "function questions(uint32) external view returns (tuple(uint32 id, string category, string encryptedContent, address author, uint256 timestamp, uint32 answerCount, uint8 reputationRequired, bool isActive, uint256 bounty))",
    "function answers(uint32) external view returns (tuple(uint32 id, uint32 questionId, string encryptedContent, address author, uint256 timestamp, uint32 encryptedScore, bool isVerified, bool isBestAnswer))",
    "function userProfiles(address) external view returns (tuple(uint32 encryptedReputation, uint32 encryptedContributions, bool isExpert, string[] specialties, uint256 joinDate))",
    "function initializeUser(uint32 _initialReputation) external",
    "function postQuestion(string calldata _category, string calldata _encryptedContent, uint8 _reputationRequired) external payable",
    "function submitAnswer(uint32 _questionId, string calldata _encryptedContent) external",
    "function voteOnAnswer(uint32 _answerId, uint32 _score) external",
    "function verifyAnswer(uint32 _answerId, bool _isVerified) external",
    "function selectBestAnswer(uint32 _questionId, uint32 _answerId) external",
    "function closeQuestion(uint32 _questionId) external",
    "function addSpecialty(string calldata _specialty) external",
    "function promoteToExpert(address _user) external",
    "function getQuestionInfo(uint32 _questionId) external view returns (string memory category, string memory encryptedContent, address author, uint256 timestamp, uint32 answerCount, bool isActive, uint256 bounty)",
    "function getAnswerInfo(uint32 _answerId) external view returns (uint32 questionId, string memory encryptedContent, address author, uint256 timestamp, bool isVerified, bool isBestAnswer)",
    "function getUserInfo(address _user) external view returns (bool isExpert, string[] memory specialties, uint256 joinDate)",
    "function getQuestionsByCategory(string calldata _category) external view returns (uint32[] memory)",
    "function getUserQuestions(address _user) external view returns (uint32[] memory)",
    "function getUserAnswers(address _user) external view returns (uint32[] memory)",
    "function getQuestionAnswers(uint32 _questionId) external view returns (uint32[] memory)",
    "function withdrawFunds() external",
    "function updateOwner(address _newOwner) external"
];

// Global Variables
let provider = null;
let signer = null;
let contract = null;
let currentAccount = null;
let currentQuestionId = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    setupEventListeners();
    checkWalletConnection();
}

function setupEventListeners() {
    // Wallet connection
    document.getElementById('connectWallet').addEventListener('click', connectWallet);

    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });

    // Forms
    document.getElementById('askQuestionForm').addEventListener('submit', handleAskQuestion);
    document.getElementById('submitAnswer').addEventListener('click', handleSubmitAnswer);

    // Profile actions
    document.getElementById('initializeUser').addEventListener('click', handleInitializeUser);
    document.getElementById('addSpecialty').addEventListener('click', handleAddSpecialty);

    // Admin actions
    document.getElementById('promoteToExpert').addEventListener('click', handlePromoteToExpert);
    document.getElementById('verifyAnswerBtn').addEventListener('click', handleVerifyAnswer);

    // Other actions
    document.getElementById('refreshQuestions').addEventListener('click', loadQuestions);
    document.getElementById('categoryFilter').addEventListener('change', loadQuestions);

    // Modal
    document.querySelector('.close').addEventListener('click', closeModal);
    document.getElementById('questionModal').addEventListener('click', (e) => {
        if (e.target.id === 'questionModal') closeModal();
    });

    // Status message
    document.getElementById('closeStatus').addEventListener('click', hideStatus);
}

async function checkWalletConnection() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                await connectWallet();
            }
        } catch (error) {
            console.error('Error checking wallet connection:', error);
        }
    }
}

async function connectWallet() {
    try {
        if (typeof window.ethereum === 'undefined') {
            showStatus('Please install MetaMask to use this application', 'error');
            return;
        }

        showLoading();

        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        currentAccount = accounts[0];

        // Initialize ethers provider and signer
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        // Update UI
        updateWalletUI();

        // Load user profile
        await loadUserProfile();

        // Load questions
        await loadQuestions();

        hideLoading();
        showStatus('Wallet connected successfully', 'success');

    } catch (error) {
        hideLoading();
        console.error('Error connecting wallet:', error);
        showStatus('Failed to connect wallet: ' + error.message, 'error');
    }
}

function updateWalletUI() {
    const connectBtn = document.getElementById('connectWallet');
    const userInfo = document.getElementById('userInfo');
    const userAddress = document.getElementById('userAddress');

    if (currentAccount) {
        connectBtn.classList.add('hidden');
        userInfo.classList.remove('hidden');
        userAddress.textContent = `${currentAccount.slice(0, 6)}...${currentAccount.slice(-4)}`;
    } else {
        connectBtn.classList.remove('hidden');
        userInfo.classList.add('hidden');
    }
}

async function loadUserProfile() {
    if (!contract || !currentAccount) return;

    try {
        const userInfo = await contract.getUserInfo(currentAccount);
        const profileInfo = document.getElementById('profileInfo');
        const initBtn = document.getElementById('initializeUser');

        if (Number(userInfo.joinDate) === 0) {
            profileInfo.innerHTML = `
                <p class="text-muted">Profile not initialized. Click below to create your profile.</p>
            `;
            initBtn.classList.remove('hidden');
        } else {
            const joinDate = new Date(Number(userInfo.joinDate) * 1000);
            const specialties = userInfo.specialties.length > 0 ? userInfo.specialties.join(', ') : 'None';

            profileInfo.innerHTML = `
                <div class="profile-info">
                    <p><strong>Expert Status:</strong> ${userInfo.isExpert ? 'Yes' : 'No'}</p>
                    <p><strong>Specialties:</strong> ${specialties}</p>
                    <p><strong>Member Since:</strong> ${joinDate.toLocaleDateString()}</p>
                </div>
            `;
            initBtn.classList.add('hidden');
        }

        // Load user's questions and answers
        await loadUserQuestions();
        await loadUserAnswers();

    } catch (error) {
        console.error('Error loading user profile:', error);
        document.getElementById('profileInfo').innerHTML = '<p class="text-muted">Error loading profile information</p>';
    }
}

async function loadUserQuestions() {
    if (!contract || !currentAccount) return;

    try {
        const questionIds = await contract.getUserQuestions(currentAccount);
        const myQuestions = document.getElementById('myQuestions');

        if (questionIds.length === 0) {
            myQuestions.innerHTML = '<p class="text-muted">No questions posted yet</p>';
            return;
        }

        let questionsHTML = '';
        for (let i = 0; i < questionIds.length; i++) {
            const questionInfo = await contract.getQuestionInfo(Number(questionIds[i]));
            const timestamp = new Date(Number(questionInfo.timestamp) * 1000);

            questionsHTML += `
                <div class="question-card" onclick="openQuestionDetail(${Number(questionIds[i])})">
                    <div class="question-header">
                        <span class="question-category">${questionInfo.category}</span>
                        <div class="question-meta">
                            <span>ID: ${Number(questionIds[i])}</span>
                            <span>${timestamp.toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div class="question-content">
                        ${questionInfo.encryptedContent.substring(0, 200)}${questionInfo.encryptedContent.length > 200 ? '...' : ''}
                    </div>
                    <div class="question-stats">
                        <span>Answers: ${Number(questionInfo.answerCount)}</span>
                        <span>Status: ${questionInfo.isActive ? 'Active' : 'Closed'}</span>
                        ${Number(questionInfo.bounty) > 0 ? `<span class="bounty">${ethers.utils.formatEther(questionInfo.bounty)} ETH</span>` : ''}
                    </div>
                </div>
            `;
        }

        myQuestions.innerHTML = questionsHTML;

    } catch (error) {
        console.error('Error loading user questions:', error);
        document.getElementById('myQuestions').innerHTML = '<p class="text-muted">Error loading questions</p>';
    }
}

async function loadUserAnswers() {
    if (!contract || !currentAccount) return;

    try {
        const answerIds = await contract.getUserAnswers(currentAccount);
        const myAnswers = document.getElementById('myAnswers');

        if (answerIds.length === 0) {
            myAnswers.innerHTML = '<p class="text-muted">No answers submitted yet</p>';
            return;
        }

        let answersHTML = '';
        for (let i = 0; i < answerIds.length; i++) {
            const answerInfo = await contract.getAnswerInfo(Number(answerIds[i]));
            const questionInfo = await contract.getQuestionInfo(Number(answerInfo.questionId));
            const timestamp = new Date(Number(answerInfo.timestamp) * 1000);

            answersHTML += `
                <div class="answer-card ${answerInfo.isVerified ? 'verified' : ''} ${answerInfo.isBestAnswer ? 'best' : ''}">
                    <div class="answer-header">
                        <span>Question: ${questionInfo.category} (ID: ${Number(answerInfo.questionId)})</span>
                        <div class="answer-badges">
                            ${answerInfo.isVerified ? '<span class="badge verified">Verified</span>' : ''}
                            ${answerInfo.isBestAnswer ? '<span class="badge best">Best Answer</span>' : ''}
                        </div>
                    </div>
                    <div class="answer-content">
                        ${answerInfo.encryptedContent.substring(0, 150)}${answerInfo.encryptedContent.length > 150 ? '...' : ''}
                    </div>
                    <div class="answer-meta">
                        <span>Answered: ${timestamp.toLocaleDateString()}</span>
                        <span>Answer ID: ${Number(answerIds[i])}</span>
                    </div>
                </div>
            `;
        }

        myAnswers.innerHTML = answersHTML;

    } catch (error) {
        console.error('Error loading user answers:', error);
        document.getElementById('myAnswers').innerHTML = '<p class="text-muted">Error loading answers</p>';
    }
}

async function loadQuestions() {
    if (!contract) return;

    try {
        showLoading();
        const nextId = await contract.nextQuestionId();
        const categoryFilter = document.getElementById('categoryFilter').value;
        const questionsList = document.getElementById('questionsList');

        let questionsHTML = '';
        let questionsFound = 0;

        // Load recent questions (last 50)
        const nextIdNum = Number(nextId);
        const startId = Math.max(1, nextIdNum - 50);

        for (let i = nextIdNum - 1; i >= startId; i--) {
            try {
                const questionInfo = await contract.getQuestionInfo(i);

                // Apply category filter
                if (categoryFilter && questionInfo.category !== categoryFilter) {
                    continue;
                }

                const timestamp = new Date(Number(questionInfo.timestamp) * 1000);
                const authorShort = `${questionInfo.author.slice(0, 6)}...${questionInfo.author.slice(-4)}`;

                questionsHTML += `
                    <div class="question-card" onclick="openQuestionDetail(${i})">
                        <div class="question-header">
                            <span class="question-category">${questionInfo.category}</span>
                            <div class="question-meta">
                                <span>By: ${authorShort}</span>
                                <span>${timestamp.toLocaleDateString()}</span>
                                <span>ID: ${i}</span>
                            </div>
                        </div>
                        <div class="question-content">
                            ${questionInfo.encryptedContent.substring(0, 200)}${questionInfo.encryptedContent.length > 200 ? '...' : ''}
                        </div>
                        <div class="question-stats">
                            <span>Answers: ${Number(questionInfo.answerCount)}</span>
                            <span>Status: ${questionInfo.isActive ? 'Active' : 'Closed'}</span>
                            ${Number(questionInfo.bounty) > 0 ? `<span class="bounty">${ethers.utils.formatEther(questionInfo.bounty)} ETH</span>` : ''}
                        </div>
                    </div>
                `;

                questionsFound++;
            } catch (error) {
                // Question might not exist, continue
                continue;
            }
        }

        if (questionsFound === 0) {
            questionsHTML = '<p class="text-center text-muted">No questions found</p>';
        }

        questionsList.innerHTML = questionsHTML;
        hideLoading();

    } catch (error) {
        hideLoading();
        console.error('Error loading questions:', error);
        document.getElementById('questionsList').innerHTML = '<p class="text-center text-muted">Error loading questions</p>';
    }
}

async function openQuestionDetail(questionId) {
    if (!contract) return;

    try {
        showLoading();
        currentQuestionId = questionId;

        // Get question details
        const questionInfo = await contract.getQuestionInfo(questionId);
        const timestamp = new Date(Number(questionInfo.timestamp) * 1000);
        const authorShort = `${questionInfo.author.slice(0, 6)}...${questionInfo.author.slice(-4)}`;

        // Get answers
        const answerIds = await contract.getQuestionAnswers(questionId);
        let answersHTML = '';

        if (answerIds.length > 0) {
            answersHTML = '<div class="answers-section"><h3>Answers</h3>';

            for (let i = 0; i < answerIds.length; i++) {
                const answerInfo = await contract.getAnswerInfo(Number(answerIds[i]));
                const answerTimestamp = new Date(Number(answerInfo.timestamp) * 1000);
                const answerAuthorShort = `${answerInfo.author.slice(0, 6)}...${answerInfo.author.slice(-4)}`;

                answersHTML += `
                    <div class="answer-card ${answerInfo.isVerified ? 'verified' : ''} ${answerInfo.isBestAnswer ? 'best' : ''}">
                        <div class="answer-header">
                            <span>By: ${answerAuthorShort} on ${answerTimestamp.toLocaleDateString()}</span>
                            <div class="answer-badges">
                                ${answerInfo.isVerified ? '<span class="badge verified">Verified</span>' : ''}
                                ${answerInfo.isBestAnswer ? '<span class="badge best">Best Answer</span>' : ''}
                            </div>
                        </div>
                        <div class="answer-content">${answerInfo.encryptedContent}</div>
                        <div class="answer-actions">
                            ${currentAccount && answerInfo.author !== currentAccount ? `
                                <div class="vote-section">
                                    <span>Vote (0-10):</span>
                                    <input type="number" id="vote-${Number(answerIds[i])}" min="0" max="10" value="5">
                                    <button class="btn btn-secondary" onclick="voteOnAnswer(${Number(answerIds[i])})">Vote</button>
                                </div>
                            ` : ''}
                            ${currentAccount === questionInfo.author ? `
                                <button class="btn btn-primary" onclick="selectBestAnswer(${questionId}, ${Number(answerIds[i])})">Select Best</button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }

            answersHTML += '</div>';
        } else {
            answersHTML = '<div class="answers-section"><p class="text-muted">No answers yet. Be the first to answer!</p></div>';
        }

        const questionDetailHTML = `
            <div class="question-detail-header">
                <h2>${questionInfo.category}</h2>
                <div class="question-meta">
                    <span>By: ${authorShort}</span>
                    <span>Posted: ${timestamp.toLocaleDateString()}</span>
                    <span>ID: ${questionId}</span>
                    ${Number(questionInfo.bounty) > 0 ? `<span class="bounty">${ethers.utils.formatEther(questionInfo.bounty)} ETH Bounty</span>` : ''}
                </div>
            </div>
            <div class="question-detail-content">
                ${questionInfo.encryptedContent}
            </div>
            ${answersHTML}
        `;

        document.getElementById('questionDetail').innerHTML = questionDetailHTML;
        document.getElementById('questionModal').classList.remove('hidden');

        hideLoading();

    } catch (error) {
        hideLoading();
        console.error('Error loading question details:', error);
        showStatus('Error loading question details', 'error');
    }
}

function closeModal() {
    document.getElementById('questionModal').classList.add('hidden');
    currentQuestionId = null;
}

async function handleAskQuestion(e) {
    e.preventDefault();

    if (!contract || !signer) {
        showStatus('Please connect your wallet first', 'error');
        return;
    }

    try {
        showLoading();

        const category = document.getElementById('questionCategory').value;
        const content = document.getElementById('questionContent').value;
        const reputationRequired = document.getElementById('reputationRequired').value;
        const bounty = document.getElementById('bounty').value;

        const bountyWei = bounty ? ethers.utils.parseEther(bounty) : ethers.BigNumber.from(0);

        const tx = await contract.postQuestion(
            category,
            content,
            parseInt(reputationRequired),
            { value: bountyWei }
        );

        await tx.wait();

        // Reset form
        document.getElementById('askQuestionForm').reset();

        // Refresh questions
        await loadQuestions();

        // Switch to questions tab
        switchTab('questions');

        hideLoading();
        showStatus('Question posted successfully!', 'success');

    } catch (error) {
        hideLoading();
        console.error('Error posting question:', error);
        showStatus('Error posting question: ' + error.message, 'error');
    }
}

async function handleSubmitAnswer() {
    if (!contract || !currentQuestionId) return;

    const content = document.getElementById('answerContent').value.trim();
    if (!content) {
        showStatus('Please enter your answer', 'error');
        return;
    }

    try {
        showLoading();

        const tx = await contract.submitAnswer(currentQuestionId, content);
        await tx.wait();

        document.getElementById('answerContent').value = '';

        // Refresh question details
        await openQuestionDetail(currentQuestionId);

        hideLoading();
        showStatus('Answer submitted successfully!', 'success');

    } catch (error) {
        hideLoading();
        console.error('Error submitting answer:', error);
        showStatus('Error submitting answer: ' + error.message, 'error');
    }
}

async function voteOnAnswer(answerId) {
    if (!contract) return;

    const voteInput = document.getElementById(`vote-${answerId}`);
    const score = parseInt(voteInput.value);

    if (score < 0 || score > 10) {
        showStatus('Vote must be between 0 and 10', 'error');
        return;
    }

    try {
        showLoading();

        const tx = await contract.voteOnAnswer(answerId, score);
        await tx.wait();

        hideLoading();
        showStatus('Vote submitted successfully!', 'success');

    } catch (error) {
        hideLoading();
        console.error('Error voting on answer:', error);
        showStatus('Error voting: ' + error.message, 'error');
    }
}

async function selectBestAnswer(questionId, answerId) {
    if (!contract) return;

    try {
        showLoading();

        const tx = await contract.selectBestAnswer(questionId, answerId);
        await tx.wait();

        // Refresh question details
        await openQuestionDetail(questionId);

        hideLoading();
        showStatus('Best answer selected successfully!', 'success');

    } catch (error) {
        hideLoading();
        console.error('Error selecting best answer:', error);
        showStatus('Error selecting best answer: ' + error.message, 'error');
    }
}

async function handleInitializeUser() {
    if (!contract) return;

    try {
        showLoading();

        const tx = await contract.initializeUser(10); // Initial reputation of 10
        await tx.wait();

        await loadUserProfile();

        hideLoading();
        showStatus('Profile initialized successfully!', 'success');

    } catch (error) {
        hideLoading();
        console.error('Error initializing user:', error);
        showStatus('Error initializing profile: ' + error.message, 'error');
    }
}

async function handleAddSpecialty() {
    if (!contract) return;

    const specialty = document.getElementById('specialty').value.trim();
    if (!specialty) {
        showStatus('Please enter a specialty', 'error');
        return;
    }

    try {
        showLoading();

        const tx = await contract.addSpecialty(specialty);
        await tx.wait();

        document.getElementById('specialty').value = '';
        await loadUserProfile();

        hideLoading();
        showStatus('Specialty added successfully!', 'success');

    } catch (error) {
        hideLoading();
        console.error('Error adding specialty:', error);
        showStatus('Error adding specialty: ' + error.message, 'error');
    }
}

async function handlePromoteToExpert() {
    if (!contract) return;

    const userAddress = document.getElementById('promoteUser').value.trim();
    if (!userAddress || !ethers.utils.isAddress(userAddress)) {
        showStatus('Please enter a valid address', 'error');
        return;
    }

    try {
        showLoading();

        const tx = await contract.promoteToExpert(userAddress);
        await tx.wait();

        document.getElementById('promoteUser').value = '';

        hideLoading();
        showStatus('User promoted to expert successfully!', 'success');

    } catch (error) {
        hideLoading();
        console.error('Error promoting user:', error);
        showStatus('Error promoting user: ' + error.message, 'error');
    }
}

async function handleVerifyAnswer() {
    if (!contract) return;

    const answerId = document.getElementById('verifyAnswerId').value;
    const isVerified = document.getElementById('verifyStatus').value === 'true';

    if (!answerId || isNaN(answerId)) {
        showStatus('Please enter a valid answer ID', 'error');
        return;
    }

    try {
        showLoading();

        const tx = await contract.verifyAnswer(parseInt(answerId), isVerified);
        await tx.wait();

        document.getElementById('verifyAnswerId').value = '';

        hideLoading();
        showStatus('Answer verification updated successfully!', 'success');

    } catch (error) {
        hideLoading();
        console.error('Error verifying answer:', error);
        showStatus('Error verifying answer: ' + error.message, 'error');
    }
}

function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab content
    document.getElementById(tabName).classList.add('active');

    // Add active class to selected tab button
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Load data for specific tabs
    if (tabName === 'questions') {
        loadQuestions();
    } else if (tabName === 'profile' && currentAccount) {
        loadUserProfile();
    }
}

function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showStatus(message, type = 'success') {
    const statusDiv = document.getElementById('statusMessage');
    const statusText = document.getElementById('statusText');

    statusText.textContent = message;
    statusDiv.className = `status-message ${type}`;
    statusDiv.classList.remove('hidden');

    // Auto hide after 5 seconds
    setTimeout(() => {
        hideStatus();
    }, 5000);
}

function hideStatus() {
    document.getElementById('statusMessage').classList.add('hidden');
}

// Handle account changes
if (typeof window.ethereum !== 'undefined') {
    window.ethereum.on('accountsChanged', function (accounts) {
        if (accounts.length === 0) {
            // User disconnected wallet
            currentAccount = null;
            provider = null;
            signer = null;
            contract = null;
            updateWalletUI();
        } else {
            // User switched accounts
            connectWallet();
        }
    });

    window.ethereum.on('chainChanged', function (chainId) {
        // Reload the page when chain changes
        window.location.reload();
    });
}