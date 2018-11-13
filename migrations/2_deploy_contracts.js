const fs = require('fs');
const bn = require('bignumber.js');
const SafeMath = artifacts.require("./SafeMath.sol");
const Token = artifacts.require("./ERC20.sol");
const TokenSale = artifacts.require("./TokenSale.sol");

module.exports = function(deployer, network, accounts) {
  const name = "MyBit";
  const symbol = "MYB";
  const WEI = 10**18;

  // Token numbers
  const tokenSupply = 180000000;      // 180 million
  const circulatingSupply = 96000000;
  const foundationSupply = tokenSupply - circulatingSupply;
  const totalSaleAmount = bn(100000).times(365);

  var token, tokensale;

  const foundation = accounts[1];
  const ddf = accounts[2];

  deployer.then(function(){

    return deployer.deploy(SafeMath);

  }).then(function(){

    //Link safemath library
    deployer.link(SafeMath,
                  Token,
                  TokenSale);

    return Token.new(foundationSupply*WEI, "MyBit", 18, "MYB");

  }).then(function(instance) {

    token = instance;
    return TokenSale.new(token.address, foundation, ddf);

  }).then(function(instance) {

    tokensale = instance;
    return token.approve(tokensale.address , WEI*WEI);

  }).then(function(tx) {

    return tokensale.startSale();

  }).then(function() {
    var addresses = {
      "MyBit" : token.address,
      "TokenSale" : tokensale.address
    }

    var addresses_json = JSON.stringify(addresses, null, 4);
    var accounts_json = JSON.stringify(accounts, null, 4);
    fs.writeFile('addresses.json', addresses_json, (err) => {
     if (err) throw err;
     console.log('Contracts Saved');
    });
    fs.writeFile('accounts.json', accounts_json, (err) => {
     if (err) throw err;
     console.log('Accounts Saved');
    });
  });
};
