const hre = require("hardhat");

async function main() {
  console.log("Deploying Privacy Q&A Platform with FHE...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

  // Deploy the PrivacyQA contract
  const PrivacyQA = await hre.ethers.getContractFactory("PrivacyQA");
  const privacyQA = await PrivacyQA.deploy();

  await privacyQA.waitForDeployment();
  const contractAddress = await privacyQA.getAddress();

  console.log("PrivacyQA contract deployed to:", contractAddress);
  console.log("Contract owner:", await privacyQA.owner());

  // Verify deployment
  const nextQuestionId = await privacyQA.nextQuestionId();
  const nextAnswerId = await privacyQA.nextAnswerId();

  console.log("Initial nextQuestionId:", nextQuestionId.toString());
  console.log("Initial nextAnswerId:", nextAnswerId.toString());

  console.log("Deployment completed successfully!");
  console.log(`
    Contract Address: ${contractAddress}
    Network: ${hre.network.name}
    Deployer: ${deployer.address}
  `);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });