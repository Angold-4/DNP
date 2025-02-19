require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: "0.8.28",
    mocha: {
	reporter: "spec",
    },
    networks: {
	hardhat: {
	    loggingEnabled: true, // Disable JSON-RPC logging
	},
    },
};
