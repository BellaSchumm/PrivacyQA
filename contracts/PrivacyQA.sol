// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint8, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract PrivacyQA is SepoliaConfig {

    address public owner;
    uint32 public nextQuestionId;
    uint32 public nextAnswerId;

    struct Question {
        uint32 id;
        string category;
        string encryptedContent;
        address author;
        uint256 timestamp;
        uint32 answerCount;
        euint8 reputationRequired;
        bool isActive;
        uint256 bounty;
    }

    struct Answer {
        uint32 id;
        uint32 questionId;
        string encryptedContent;
        address author;
        uint256 timestamp;
        euint32 encryptedScore;
        bool isVerified;
        bool isBestAnswer;
    }

    struct UserProfile {
        euint32 encryptedReputation;
        euint32 encryptedContributions;
        bool isExpert;
        string[] specialties;
        uint256 joinDate;
    }

    mapping(uint32 => Question) public questions;
    mapping(uint32 => Answer) public answers;
    mapping(address => UserProfile) public userProfiles;
    mapping(uint32 => uint32[]) public questionAnswers;
    mapping(address => uint32[]) public userQuestions;
    mapping(address => uint32[]) public userAnswers;
    mapping(string => uint32[]) public categoryQuestions;

    event QuestionPosted(uint32 indexed questionId, address indexed author, string category);
    event AnswerSubmitted(uint32 indexed answerId, uint32 indexed questionId, address indexed author);
    event AnswerVerified(uint32 indexed answerId, bool isVerified);
    event ReputationUpdated(address indexed user, uint256 timestamp);
    event BestAnswerSelected(uint32 indexed questionId, uint32 indexed answerId);
    event BountyPaid(uint32 indexed questionId, address indexed recipient, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    modifier questionExists(uint32 _questionId) {
        require(_questionId > 0 && _questionId < nextQuestionId, "Question does not exist");
        _;
    }

    modifier answerExists(uint32 _answerId) {
        require(_answerId > 0 && _answerId < nextAnswerId, "Answer does not exist");
        _;
    }

    constructor() {
        owner = msg.sender;
        nextQuestionId = 1;
        nextAnswerId = 1;
    }

    function initializeUser(uint32 _initialReputation) external {
        require(userProfiles[msg.sender].joinDate == 0, "User already initialized");

        euint32 encryptedReputation = FHE.asEuint32(_initialReputation);
        euint32 encryptedContributions = FHE.asEuint32(0);

        userProfiles[msg.sender] = UserProfile({
            encryptedReputation: encryptedReputation,
            encryptedContributions: encryptedContributions,
            isExpert: false,
            specialties: new string[](0),
            joinDate: block.timestamp
        });

        FHE.allowThis(encryptedReputation);
        FHE.allowThis(encryptedContributions);
        FHE.allow(encryptedReputation, msg.sender);
        FHE.allow(encryptedContributions, msg.sender);
    }

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

    function submitAnswer(
        uint32 _questionId,
        string calldata _encryptedContent
    ) external questionExists(_questionId) {
        require(userProfiles[msg.sender].joinDate != 0, "User not initialized");
        require(questions[_questionId].isActive, "Question is not active");
        require(bytes(_encryptedContent).length > 0, "Answer content cannot be empty");

        Question storage question = questions[_questionId];
        UserProfile storage userProfile = userProfiles[msg.sender];

        // Check if user meets reputation requirement (simplified for demo)
        // In real implementation, use FHE comparison

        euint32 initialScore = FHE.asEuint32(0);

        answers[nextAnswerId] = Answer({
            id: nextAnswerId,
            questionId: _questionId,
            encryptedContent: _encryptedContent,
            author: msg.sender,
            timestamp: block.timestamp,
            encryptedScore: initialScore,
            isVerified: false,
            isBestAnswer: false
        });

        questionAnswers[_questionId].push(nextAnswerId);
        userAnswers[msg.sender].push(nextAnswerId);
        question.answerCount++;

        FHE.allowThis(initialScore);
        FHE.allow(initialScore, msg.sender);

        // Update user contributions
        euint32 newContributions = FHE.add(userProfile.encryptedContributions, FHE.asEuint32(1));
        userProfile.encryptedContributions = newContributions;

        FHE.allowThis(newContributions);
        FHE.allow(newContributions, msg.sender);

        emit AnswerSubmitted(nextAnswerId, _questionId, msg.sender);
        nextAnswerId++;
    }

    function voteOnAnswer(uint32 _answerId, uint32 _score) external answerExists(_answerId) {
        require(userProfiles[msg.sender].joinDate != 0, "User not initialized");
        require(_score <= 10, "Score must be between 0-10");

        Answer storage answer = answers[_answerId];
        require(answer.author != msg.sender, "Cannot vote on own answer");

        euint32 encryptedVote = FHE.asEuint32(_score);
        euint32 newScore = FHE.add(answer.encryptedScore, encryptedVote);
        answer.encryptedScore = newScore;

        FHE.allowThis(newScore);
        FHE.allow(newScore, answer.author);

        // Update voter's reputation (small increase for participation)
        UserProfile storage voterProfile = userProfiles[msg.sender];
        euint32 newVoterReputation = FHE.add(voterProfile.encryptedReputation, FHE.asEuint32(1));
        voterProfile.encryptedReputation = newVoterReputation;

        FHE.allowThis(newVoterReputation);
        FHE.allow(newVoterReputation, msg.sender);

        emit ReputationUpdated(msg.sender, block.timestamp);
    }

    function verifyAnswer(uint32 _answerId, bool _isVerified) external onlyOwner answerExists(_answerId) {
        Answer storage answer = answers[_answerId];
        answer.isVerified = _isVerified;

        if (_isVerified) {
            // Increase author's reputation for verified answer
            UserProfile storage authorProfile = userProfiles[answer.author];
            euint32 newReputation = FHE.add(authorProfile.encryptedReputation, FHE.asEuint32(10));
            authorProfile.encryptedReputation = newReputation;

            FHE.allowThis(newReputation);
            FHE.allow(newReputation, answer.author);

            emit ReputationUpdated(answer.author, block.timestamp);
        }

        emit AnswerVerified(_answerId, _isVerified);
    }

    function selectBestAnswer(uint32 _questionId, uint32 _answerId) external questionExists(_questionId) answerExists(_answerId) {
        Question storage question = questions[_questionId];
        require(msg.sender == question.author, "Only question author can select best answer");
        require(answers[_answerId].questionId == _questionId, "Answer does not belong to this question");

        // Clear previous best answer if any
        uint32[] storage qAnswers = questionAnswers[_questionId];
        for (uint i = 0; i < qAnswers.length; i++) {
            answers[qAnswers[i]].isBestAnswer = false;
        }

        // Set new best answer
        Answer storage bestAnswer = answers[_answerId];
        bestAnswer.isBestAnswer = true;

        // Pay bounty if available
        if (question.bounty > 0) {
            uint256 bounty = question.bounty;
            question.bounty = 0;
            payable(bestAnswer.author).transfer(bounty);
            emit BountyPaid(_questionId, bestAnswer.author, bounty);
        }

        // Increase best answer author's reputation significantly
        UserProfile storage authorProfile = userProfiles[bestAnswer.author];
        euint32 newReputation = FHE.add(authorProfile.encryptedReputation, FHE.asEuint32(25));
        authorProfile.encryptedReputation = newReputation;

        FHE.allowThis(newReputation);
        FHE.allow(newReputation, bestAnswer.author);

        emit BestAnswerSelected(_questionId, _answerId);
        emit ReputationUpdated(bestAnswer.author, block.timestamp);
    }

    function closeQuestion(uint32 _questionId) external questionExists(_questionId) {
        Question storage question = questions[_questionId];
        require(msg.sender == question.author || msg.sender == owner, "Not authorized to close question");

        question.isActive = false;
    }

    function addSpecialty(string calldata _specialty) external {
        require(userProfiles[msg.sender].joinDate != 0, "User not initialized");
        userProfiles[msg.sender].specialties.push(_specialty);
    }

    function promoteToExpert(address _user) external onlyOwner {
        require(userProfiles[_user].joinDate != 0, "User not initialized");
        userProfiles[_user].isExpert = true;
    }

    function getQuestionInfo(uint32 _questionId) external view questionExists(_questionId) returns (
        string memory category,
        string memory encryptedContent,
        address author,
        uint256 timestamp,
        uint32 answerCount,
        bool isActive,
        uint256 bounty
    ) {
        Question storage question = questions[_questionId];
        return (
            question.category,
            question.encryptedContent,
            question.author,
            question.timestamp,
            question.answerCount,
            question.isActive,
            question.bounty
        );
    }

    function getAnswerInfo(uint32 _answerId) external view answerExists(_answerId) returns (
        uint32 questionId,
        string memory encryptedContent,
        address author,
        uint256 timestamp,
        bool isVerified,
        bool isBestAnswer
    ) {
        Answer storage answer = answers[_answerId];
        return (
            answer.questionId,
            answer.encryptedContent,
            answer.author,
            answer.timestamp,
            answer.isVerified,
            answer.isBestAnswer
        );
    }

    function getUserInfo(address _user) external view returns (
        bool isExpert,
        string[] memory specialties,
        uint256 joinDate
    ) {
        UserProfile storage profile = userProfiles[_user];
        return (
            profile.isExpert,
            profile.specialties,
            profile.joinDate
        );
    }

    function getQuestionsByCategory(string calldata _category) external view returns (uint32[] memory) {
        return categoryQuestions[_category];
    }

    function getUserQuestions(address _user) external view returns (uint32[] memory) {
        return userQuestions[_user];
    }

    function getUserAnswers(address _user) external view returns (uint32[] memory) {
        return userAnswers[_user];
    }

    function getQuestionAnswers(uint32 _questionId) external view returns (uint32[] memory) {
        return questionAnswers[_questionId];
    }

    // Emergency functions
    function withdrawFunds() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    function updateOwner(address _newOwner) external onlyOwner {
        owner = _newOwner;
    }

    // Allow contract to receive ETH for bounties
    receive() external payable {}
}