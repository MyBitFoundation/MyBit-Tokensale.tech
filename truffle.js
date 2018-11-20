/*
 * NB: since truffle-hdwallet-provider 0.0.5 you must wrap HDWallet providers in a
 * function when declaring them. Failure to do so will cause commands to hang. ex:
 * ```
 * mainnet: {
 *     provider: function() {
 *       return new HDWalletProvider(mnemonic, 'https://mainnet.infura.io/<infura-key>')
 *     },
 *     network_id: '1',
 *     gas: 4500000,
 *     gasPrice: 10000000000,
 *   },
 */
 var HDWalletProvider = require("truffle-hdwallet-provider");
 var fs = require('fs');
 if (fs.existsSync('mnemonic.json')) {
   var json = JSON.parse(fs.readFileSync('mnemonic.json', 'utf8'));
   var mnemonic = json.mnemonic;
   var portal = json.portal;
 }

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      gas: 6500000,
      network_id: "*",
      gasPrice: 1
    },
    ropsten: {
      provider: function() {
        return new HDWalletProvider(mnemonic, portal)
      },
      network_id: 3,
      gas: 6500000,
      gasPrice: 1
    }
  },

  compilers: {
    solc: {
      version: "/home/peter/Documents/Work/MyBit/MyBit-Tokensale.tech/node_modules/solc"
    }
  }
};
