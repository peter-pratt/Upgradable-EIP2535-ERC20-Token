require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan")
require("dotenv").config({ path: ".env" });

const AMOY_API_KEY_URL = process.env.AMOY_API_KEY_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const API_TOKEN = process.env.API_TOKEN;

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.26",
      },
      {
        version: "0.8.10",
      }
    ],
  },
  networks: {
    amoy: {
      url: AMOY_API_KEY_URL,
      accounts: [PRIVATE_KEY],
      chainId: 80002  // Added chainId for Amoy network
    }
  },
  etherscan: {
    apiKey: {
      amoy: API_TOKEN  // Using API_TOKEN for Polygonscan verification
    },
    customChains: [
      {
        network: "amoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com/"
        }
      }
    ]
  },
  lockGasLimit: 200000000000,
  gasPrice: 10000000000
};