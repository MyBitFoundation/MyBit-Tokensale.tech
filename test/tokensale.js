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
  let currentDate;

  const name = "MyBit";
  const symbol = "MYB";
  const WEI = 10**18;



  // Token numbers
  const tokenSupply = 180000000;      // 180 million
  //const circulatingSupply = 10123464384447336;   // This is scaled up by 10^8 to match old tokens 10123464384447336
  const circulatingSupply = 96000000;
  const foundationSupply = tokenSupply - circulatingSupply;
  console.log("foundation supply: " , foundationSupply);
  const tokenPerUser = (circulatingSupply / users.length)*WEI;
  const totalSaleAmount = bn(100000).times(365);
  console.log("total sale amount", totalSaleAmount*WEI);

  let tokensPerDay;

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
    await tokenSale.startSale();
    tokensPerDay = await tokenSale.tokensPerDay();
    console.log("tokens per day: ", tokensPerDay);
    assert.notEqual(await tokenSale.start(), 0);
    assert.equal(bn(await token.balanceOf(tokenSale.address)).eq(totalSaleAmount*WEI), true);
  });

  it('Funding by two users', async() => {
    assert.equal(await tokenSale.currentDay(), 0);
    tx = await tokenSale.fund(0, {from: user1, value: 2*WEI});
    tx = await tokenSale.fund(0, {from: user2, value: 2*WEI});
    // Move to next day
    web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [86401], id: 0
    });
    assert.equal(await tokenSale.currentDay(), 1);
  });

  it('Withdraw day 0, user2', async() => {
    let amountToReceive = await tokenSale.getTokensOwed(user2, 0);
    let shouldReceive = tokensPerDay / 2;
    assert.equal(shouldReceive, amountToReceive);

    tx = await tokenSale.withdraw(0, {from: user2});
    let balanceAfter = await token.balanceOf(user2);
    assert.equal(bn(balanceAfter).eq(amountToReceive), true);
  });

  it('Fund', async() => {
    let fundAmount = 2*WEI;
    tx = await tokenSale.fund(1, {from: user1, value: 2*WEI});
    assert.equal(bn(fundAmount).eq(await tokenSale.getWeiContributed(1, user1)), true);
    assert.equal(await tokenSale.currentDay(), 1);
    web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [86401], id: 0
    });
    assert.equal(await tokenSale.currentDay(), 2);
  });

  it('Batch Withdraw user1', async() => {
    let days = [0, 1];
    let expectedTokens = bn(tokensPerDay).plus(tokensPerDay / 2);
    let day0Tokens = await tokenSale.getTokensOwed(user1, 0);
    let day1Tokens = await tokenSale.getTokensOwed(user1, 1);
    let tokensToReceive = bn(day0Tokens).plus(day1Tokens);
    console.log("expectedTokens: ", expectedTokens);
    console.log("tokens to be received : ", tokensToReceive);
    assert.equal(bn(expectedTokens).eq(tokensToReceive), true);
    tx = await tokenSale.batchWithdraw(days, {from: user1});
    let balanceAfter = await token.balanceOf(user1);
    console.log("balance after: ", balanceAfter);
    console.log("tokensToReceive: ", tokensToReceive);
    assert.equal(bn(tokensToReceive).eq(balanceAfter), true);
    let totalBalance = bn(await token.balanceOf(user1)).plus(await token.balanceOf(user2));
    console.log("user1 balance ", await token.balanceOf(user1));
    console.log("user2 balance ", await token.balanceOf(user2));
    console.log("total balance of user1 and user2: ", totalBalance);
    console.log("200000 tokens: " , tokensPerDay*2);
    assert.equal(bn(totalBalance).eq(tokensPerDay*2), true);
  });

  it('Foundation withdraws tokens', async() => {
    let weiInContract = web3.eth.getBalance(tokenSale.address);
    console.log("weiInContract ", weiInContract);
    await tokenSale.foundationWithdraw(weiInContract);
    assert.equal(web3.eth.getBalance(tokenSale.address), 0); 
  });
});
