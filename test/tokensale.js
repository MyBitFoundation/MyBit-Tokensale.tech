var bn = require('bignumber.js');

// Initiate contract artifacts
const Token = artifacts.require("./ERC20.sol");
const TokenSale = artifacts.require("./TokenSale.sol");


contract('TokenSale', async (accounts) => {
  const owner = web3.eth.accounts[0];
  const user1 = web3.eth.accounts[1];
  const user2 = web3.eth.accounts[2];
  const user3 = web3.eth.accounts[3];
  const user4 = web3.eth.accounts[4];
  const user5 = web3.eth.accounts[5];
  const user6 = web3.eth.accounts[6];
  const user7 = web3.eth.accounts[7];
  const user8 = web3.eth.accounts[8];
  const user9 = web3.eth.accounts[9];

  const users = [user1, user2, user3, user4, user5, user6, user7, user8, user9];

  let token;
  let tokenSale;

  const name = "MyBit";
  const symbol = "MYB";
  const WEI = 10**18;



  // Token numbers
  const tokenSupply = 180000000;      // 180 million
  //const circulatingSupply = 10123464384447336;   // This is scaled up by 10^8 to match old tokens 10123464384447336
  const circulatingSupply = 96000000;
  const foundationSupply = tokenSupply - circulatingSupply;
  console.log(foundationSupply);
  const tokenPerUser = (circulatingSupply / users.length)*WEI;
  const totalSaleAmount = bn(25000).times(365);
  console.log(totalSaleAmount);


  it('Deploy MYB token', async() => {
    token = await Token.new(tokenSupply*WEI, "MyBit", 18, "MYB");
  });
/*
  it('Spread tokens to users', async() => {
    for (let i = 0; i < users.length; i++){
      await token.transfer(users[i], tokenPerUser);
      assert.equal(await token.balanceOf(users[i]), tokenPerUser);
    }
  });
*/
  it('Deploy and start TokenSale contract', async() => {
    tokenSale = await TokenSale.new(token.address);
    assert.equal(await tokenSale.start(), 0);
    assert.equal(await tokenSale.owner(), owner);
  })

  it('Start token sale', async() => {
    assert.equal(await token.balanceOf(tokenSale.address), 0);
    await token.approve(tokenSale.address , totalSaleAmount*WEI);
    assert.equal(bn(await token.balanceOf(owner)).gt(totalSaleAmount*WEI), true);
    await tokenSale.startSale(totalSaleAmount*WEI);
    assert.notEqual(await tokenSale.start(), 0);
    assert.equal(bn(await token.balanceOf(tokenSale.address)).eq(totalSaleAmount*WEI), true);
  });

  it('Fund', async() => {
    tx = await tokenSale.fund(0, {from: user1, value: 2*WEI});
    console.log(tx.logs[0].args);
    web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [86401], id: 0
    });
  });

  it('Withdraw', async() => {
    let balanceBefore = await token.balanceOf(user1);
    console.log(Number(balanceBefore));
    tx = await tokenSale.withdraw(0, {from: user1});
    console.log(tx.logs[0].args);
    let balanceAfter = await token.balanceOf(user1);
    console.log(Number(balanceAfter));
    assert.equal(bn(balanceAfter).gt(balanceBefore), true);
  });

  it('Fund double', async() => {
    tx = await tokenSale.fund(1, {from: user1, value: 2*WEI});
    console.log(tx.logs[0].args);
    tx = await tokenSale.fund(1, {from: user2, value: 2*WEI});
    console.log(tx.logs[0].args);
    web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [86401], id: 0
    });
  });

  it('Withdraw', async() => {
    let balanceBefore = await token.balanceOf(user1);
    console.log(Number(balanceBefore));
    tx = await tokenSale.withdraw(1, {from: user1});
    console.log(tx.logs[0].args);
    let balanceAfter = await token.balanceOf(user1);
    console.log(Number(balanceAfter));
    assert.equal(bn(balanceAfter).gt(balanceBefore), true);
  });

});
