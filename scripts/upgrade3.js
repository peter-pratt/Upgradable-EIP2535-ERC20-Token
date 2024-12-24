/* global ethers */
/* eslint prefer-const: "off" */
const { ethers } = require('hardhat')
const { FacetCutAction } = require('./libraries/diamond.js')

// Add the Storage ABI directly in the script
const STORAGE_ABI = [
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "a",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "b",
                    "type": "uint256"
                }
            ],
            "name": "add",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "pure",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "a",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "b",
                    "type": "uint256"
                }
            ],
            "name": "mul",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "pure",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "a",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "b",
                    "type": "uint256"
                }
            ],
            "name": "sub",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "pure",
            "type": "function"
        }
];

// Helper function to get function selectors from ABI
function getSelectors(abi) {
  const selectors = [];
  const iface = new ethers.utils.Interface(abi);
  for (const fragment of Object.values(iface.functions)) {
    selectors.push(iface.getSighash(fragment));
  }
  return selectors;
}

async function deployDiamond () {
  const accounts = await ethers.getSigners()
  const contractOwner = accounts[0]
  
  // Get the existing diamond proxy contract
  const diamond = await ethers.getContractAt('IDiamondCut', '0x43fBA1315c258Db85FCbED7253E3A11305430F5d')
  
  // Get the existing DiamondInit contract
  const diamondInit = await ethers.getContractAt('DiamondInit', '0x93AD5be6E1352c6Bf9a0d92b328A85869A1dDAf9')
  
  console.log('Preparing diamond cut for Storage facet')
  
  // Create cut array using the ABI directly
  const cut = [{
    facetAddress: '0xe852f073e8714e35e11d940aced15b88cd0827f5',
    action: FacetCutAction.Add,
    functionSelectors: getSelectors(STORAGE_ABI)
  }]
  
  console.log('Diamond Cut:', cut)
  
  // Prepare initialization call
  let functionCall = diamondInit.interface.encodeFunctionData('init')
  
  // Execute the diamond cut
  let tx = await diamond.diamondCut(
    cut,
    diamondInit.address,
    functionCall,
    { gasLimit: 8000000 }
  )
  
  console.log('Diamond cut tx: ', tx.hash)
  let receipt = await tx.wait()
  if (!receipt.status) {
    throw Error(`Diamond upgrade failed: ${tx.hash}`)
  }
  
  console.log('Completed diamond cut')
  
  // Verify the upgrade by connecting to the Storage facet through the diamond
  const storageFacet = new ethers.Contract(diamond.address, STORAGE_ABI, contractOwner)
  try {
    const name = await storageFacet.name()
    console.log('Storage name:', name)
  } catch (err) {
    console.log('Could not fetch storage name:', err.message)
  }
  
  // Keep the existing ERC20 verification
  const token = await ethers.getContractAt("ERC20Facet", "0x949A361DaF4834efd7C764a227928bC1dc6423f4")
  const tokenName = await token.name()
  const balance = await token.balanceOf(contractOwner.address)
  console.log('Token name:', tokenName)
  console.log('Balance:', Number(balance))
}

// We recommend this pattern to be able to use async/await everywhere
if (require.main === module) {
  deployDiamond()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}

exports.deployDiamond = deployDiamond