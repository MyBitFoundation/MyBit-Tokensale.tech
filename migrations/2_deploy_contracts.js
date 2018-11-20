const fs = require('fs');
const bn = require('bignumber.js');
const SafeMath = artifacts.require("./SafeMath.sol");
const Token = artifacts.require("./ERC20.sol");
const TokenSale = artifacts.require("./TokenSale.sol");

module.exports = function(deployer, network, accounts) {
  const name = "MyBit";
  const symbol = "MYB";
  const WEI = bn(10**18);

  // Token numbers
  const tokenSupply = bn(180000000);      // 180 million
  const circulatingSupply = bn(96000000);
  const foundationSupply = tokenSupply.minus(circulatingSupply);
  const totalSaleAmount = bn(100000).times(365);
  const oneDay = 86400;

  var token, tokensale, now, midnight;

  const foundation = accounts[1];
  const ddf = accounts[2];

  deployer.then(function(){

    return deployer.deploy(SafeMath);

  }).then(function(){

    //Link safemath library
    deployer.link(SafeMath,
                  Token,
                  TokenSale);

    return Token.new(foundationSupply.times(WEI), "MyBit", 18, "MYB");

  }).then(function(instance) {

    token = instance;

    return web3.eth.getBlock('latest');

  }).then(function(instance) {

    now = instance.timestamp;
    midnight = (now - (now % oneDay)) + (oneDay / 2);
    console.log('Now: ', now);
    console.log('Midnight: ', midnight);

    return TokenSale.new(token.address, foundation, ddf);

  }).then(function(instance) {

    tokensale = instance;
    return token.approve(tokensale.address , WEI.times(WEI));

  }).then(function(tx) {

    return tokensale.startSale(midnight);

  }).then(function() {
    var addresses = {
      "MyBit" : token.address,
      "TokenSale" : tokensale.address
    }

    var contracts_json = JSON.stringify(addresses, null, 4);
    var accounts_json = JSON.stringify(accounts, null, 4);
    fs.writeFile('networks/' + network + '/contracts.json', contracts_json, (err) => {
      if (err) throw err;
      console.log('Contracts Saved');
    });
    fs.writeFile('networks/' + network + '/accounts.json', accounts_json, (err) => {
      if (err) throw err;
      console.log('Accounts Saved');
    });

    instanceList = [token, tokensale];

    for(var i=0; i<instanceList.length; i++){
      var instanceName = instanceList[i].constructor._json.contractName;
      var instance_json = JSON.stringify(instanceList[i].abi, null, 4);
      fs.writeFile('networks/' + network + '/' + instanceName + '.json', instance_json, (err) => {
        if (err) throw err;
      });
    }
  });
};
