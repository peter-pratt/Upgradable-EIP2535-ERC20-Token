/* global ethers */
/* eslint prefer-const: "off" */
const { ethers } = require('hardhat')
const { FacetCutAction } = require('./libraries/diamond.js')

// Add the Storage ABI directly in the script
const STORAGE_ABI = [
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "_name",
        "type": "string"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "retrieve",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "num",
        "type": "uint256"
      }
    ],
    "name": "store",
    "outputs": [],
    "stateMutability": "nonpayable",
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

async function deployDiamond() {
  try {
    const accounts = await ethers.getSigners()
    const contractOwner = accounts[0]

    // Get the existing diamond proxy contract
    const diamond = await ethers.getContractAt('IDiamondCut', '0x43fBA1315c258Db85FCbED7253E3A11305430F5d')

    // Get the existing DiamondInit contract
    const diamondInit = await ethers.getContractAt('DiamondInit', '0x93AD5be6E1352c6Bf9a0d92b328A85869A1dDAf9')

    console.log('Preparing diamond cut for Storage facet')

    // Get the current state of the diamond
    const loupe = await ethers.getContractAt('DiamondLoupeFacet', diamond.address)
    const existingSelectors = new Set()
    
    try {
      const facets = await loupe.facets()
      for (const facet of facets) {
        facet.functionSelectors.forEach(selector => {
          existingSelectors.add(selector)
        })
      }
    } catch (err) {
      console.log('Could not fetch existing selectors:', err.message)
    }

    // Filter out any selectors that already exist
    const newSelectors = getSelectors(STORAGE_ABI).filter(
      selector => !existingSelectors.has(selector)
    )

    if (newSelectors.length === 0) {
      console.log('No new selectors to add')
      return
    }

    // Create cut array using filtered selectors
    const cut = [{
      facetAddress: '0x1Dd5bE88733Fb38bA0DF277CeD962929665af93d',
      action: FacetCutAction.Add,
      functionSelectors: newSelectors
    }]

    console.log('Diamond Cut:', cut)

    // Prepare initialization call
    const functionCall = diamondInit.interface.encodeFunctionData('init')

    // Estimate gas for the transaction
    const gasEstimate = await diamond.estimateGas.diamondCut(
      cut,
      diamondInit.address,
      functionCall
    ).catch(err => {
      console.log('Gas estimation failed:', err.message)
      return ethers.BigNumber.from('8000000') // fallback gas limit
    })

    // Add 20% buffer to gas estimate
    const gasLimit = gasEstimate.mul(120).div(100)

    // Execute the diamond cut with optimized gas settings
    const tx = await diamond.diamondCut(
      cut,
      diamondInit.address,
      functionCall,
      {
        gasLimit,
        gasPrice: await ethers.provider.getGasPrice()
      }
    )

    console.log('Diamond cut tx: ', tx.hash)
    const receipt = await tx.wait()
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

    // Verify ERC20 functionality is still intact
    const token = await ethers.getContractAt("ERC20Facet", diamond.address)
    const tokenName = await token.name()
    const balance = await token.balanceOf(contractOwner.address)
    console.log('Token name:', tokenName)
    console.log('Balance:', Number(balance))

  } catch (error) {
    console.error('Deployment failed:', error)
    throw error
  }     
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