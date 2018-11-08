var bn = require('bignumber.js');

// Initiate contract artifacts
const Token = artifacts.require("./ERC20.sol");
const TokenSale = artifacts.require("./TokenSale.sol");

async function rejects (promise) {
  let err;
  try {
    await promise;
  } catch (e) {
    err = e;
  }
  assert.notEqual(err, undefined);
}

contract('TokenSale', async (accounts) => {
  const owner = web3.eth.accounts[0];
  const user1 = web3.eth.accounts[1];
  const user2 = web3.eth.accounts[2];
  const user3 = web3.eth.accounts[3];
  const user4 = web3.eth.accounts[4];
  const user5 = web3.eth.accounts[5];
  const user6 = web3.eth.accounts[6];
  const user7 = web3.eth.accounts[7];

  const ddf = web3.eth.accounts[8];
  const foundation = web3.eth.accounts[9];

  const users = [user1, user2, user3, user4, user5, user6, user7];

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

  it('Deploy TokenSale contract', async() => {
    tokenSale = await TokenSale.new(token.address, foundation, ddf);
    assert.equal(await tokenSale.start(), 0);
    assert.equal(await tokenSale.owner(), owner);
  });

  it('Try to start sale from non-owner account', async() => {
    await token.transfer(user1, totalSaleAmount*WEI);
    await token.approve(tokenSale.address, totalSaleAmount*WEI, {from: user1})
    await rejects(tokenSale.startSale({from: user1}));
    await token.transfer(owner, totalSaleAmount*WEI, {from: user1});
  });

  it('Start token sale with not enough MYB', async() => {
    await rejects(tokenSale.startSale());
  });

  it('Try funding before sale', async() => {
    await rejects(tokenSale.fund(0, {from: user1, value: 2*WEI}));
  });

  // ------------Day 0----------------

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


  it('Try starting sale again', async() => {
    assert.equal(bn(await token.balanceOf(owner)).gt(totalSaleAmount*WEI), true);
    await token.approve(tokenSale.address, totalSaleAmount*WEI);
    await rejects(tokenSale.startSale());
  });

  it('Try funding with no WEI', async() => {
    await rejects(tokenSale.fund(0, {from: user1}));
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

  // ------------ Day 1 ------------

  it('Try funding previous day', async() => {
    await rejects(tokenSale.fund(0, {from: user3, value: 2*WEI}));
  });

  it('Withdraw day 0, user2', async() => {
    let amountToReceive = await tokenSale.getTokensOwed(user2, 0);
    let shouldReceive = tokensPerDay / 2;
    assert.equal(shouldReceive, amountToReceive);
    tx = await tokenSale.withdraw(0, {from: user2});
    let balanceAfter = await token.balanceOf(user2);
    assert.equal(bn(balanceAfter).eq(amountToReceive), true);
    assert.equal(await tokenSale.getWeiContributed(0, user2), 0);
  });

  it('Fund day 1 by two users', async() => {
    let fundAmount = 2*WEI;
    tx = await tokenSale.fund(1, {from: user1, value: 2*WEI});
    tx = await tokenSale.fund(1, {from:user2, value: 2*WEI});
    assert.equal(bn(fundAmount).eq(await tokenSale.getWeiContributed(1, user1)), true);
    assert.equal(bn(fundAmount).eq(await tokenSale.getWeiContributed(1, user2)), true);
    assert.equal(await tokenSale.currentDay(), 1);
    web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [86401], id: 0
    });
    assert.equal(await tokenSale.currentDay(), 2);
  });

  // ------------ Day 2 ------------

  it('Withdraw day 1, user2', async() => {
    let amountToReceive = await tokenSale.getTokensOwed(user2, 1);
    let balanceBefore = await token.balanceOf(user2);
    let shouldReceive = tokensPerDay / 2;
    console.log("amount to receive" , amountToReceive);
    console.log("should receive : ", shouldReceive);
    assert.equal(shouldReceive, amountToReceive);
    tx = await tokenSale.withdraw(1, {from: user2});
    let balanceDiff = bn(await token.balanceOf(user2)).minus(balanceBefore);
    assert.equal(balanceDiff.eq(amountToReceive), true);
  });

  it('Batch Withdraw user1', async() => {
    let days = [0, 1];
    let expectedTokens = bn(tokensPerDay);
    let day0Tokens = await tokenSale.getTokensOwed(user1, 0);
    let day1Tokens = await tokenSale.getTokensOwed(user1, 1);
    let tokensToReceive = bn(day0Tokens).plus(day1Tokens);
    assert.equal(bn(expectedTokens).eq(tokensToReceive), true);
    tx = await tokenSale.batchWithdraw(days, {from: user1});
    let balanceAfter = await token.balanceOf(user1);
    assert.equal(bn(tokensToReceive).eq(balanceAfter), true);
    let totalBalance = bn(await token.balanceOf(user1)).plus(await token.balanceOf(user2));
    assert.equal(bn(totalBalance).eq(tokensPerDay*2), true);
  });

  it("batch withdraw again and receive 0 wei", async() => {
    assert.equal(await tokenSale.getTokensOwed(user1, 0), 0);
    assert.equal(await tokenSale.getTokensOwed(user1, 1), 0);
    let balanceBefore = await token.balanceOf(user1);
    await tokenSale.batchWithdraw([0,1], {from: user1});
    assert.equal(bn(await token.balanceOf(user1)).eq(balanceBefore), true);
  })

  it("Try to withdraw from non-owner account", async() => {
    await rejects(tokenSale.foundationWithdraw(web3.eth.getBalance(tokenSale.address), {from: user1}));
  })

  it("Try to withdraw more wei than contract holds", async() => {
    await rejects(tokenSale.foundationWithdraw(web3.eth.getBalance(tokenSale.address)+1));
  })

  it('Owner withdraws tokens for foundation + ddf', async() => {
    let weiInContract = web3.eth.getBalance(tokenSale.address);
    let foundationBalance = web3.eth.getBalance(foundation);
    let ddfBalance = web3.eth.getBalance(ddf);
    await tokenSale.foundationWithdraw(weiInContract);

    let foundationBalanceDiff = bn(web3.eth.getBalance(foundation)).minus(foundationBalance);
    let ddfBalanceDiff = bn(web3.eth.getBalance(ddf)).minus(ddfBalance);
    assert.equal(web3.eth.getBalance(tokenSale.address), 0);
    assert.equal(foundationBalanceDiff, weiInContract / 2)
    assert.equal(ddfBalanceDiff, weiInContract / 2);
  });

  it("Try to fund for days outside sale", async() => {
    await rejects(tokenSale.fund(365, {from: user3, value: 1}));
  });

  it("Fund with 1 wei for day 3 and day 4" , async() => {
    assert.equal(await tokenSale.currentDay(), 2);
    await tokenSale.fund(3, {from: user3, value:1});
    await tokenSale.fund(4, {from: user3, value:1});
  });

  it("Try to withdraw from future day", async() => {
    assert.equal(await tokenSale.currentDay(), 2);
    await rejects(tokenSale.withdraw(3, {from: user3}));
  });

  it("Try to batch withdraw from future days", async() => {
    assert.equal(await tokenSale.currentDay(), 2);
    await rejects(tokenSale.batchWithdraw([3,4], {from: user3}));
  });

  it("Move to day 5 (from 2)", async() => {
    assert.equal(await tokenSale.currentDay(), 2);
    web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [86401 * 3],
        id: 0
    });
    assert.equal(await tokenSale.currentDay(), 5);
  })

  //---------------------Day 5-------------------

  it("Batch withdraw user3", async() => {
    let balanceBefore = await token.balanceOf(user3);
    let mybOwed = await tokenSale.getTotalTokensOwed(user3, [3,4]);
    assert.equal(bn(mybOwed).eq(tokensPerDay*2), true);
    console.log("mybit owed to user 3: ", mybOwed);
    await tokenSale.batchWithdraw([3,4], {from: user3});
    let balanceDiff = bn(await token.balanceOf(user3)).minus(balanceBefore);
    assert.equal(balanceDiff.eq(mybOwed), true);
  });

  it('fund currentDay (5) with user3', async() => {
    assert.equal(await tokenSale.currentDay(), 5);
    await tokenSale.fund(5, {from: user3, value: 13});
    assert.equal(bn(await tokenSale.getTokensOwed(user3, 5)).eq(tokensPerDay), true);
  });

  it('Try to withdraw from the current day', async() => {
    await rejects(tokenSale.withdraw(5, {from: user3}));
  })

  let batchWithdrawDays = [];
  it('Set up batch days)', async() => {
    for (let i = 6; i < 56; i++){
      //await tokenSale.fund(i, {from: user3, value: 1});
      batchWithdrawDays.push(i);
    }
    assert.equal(bn(batchWithdrawDays.length).eq(50), true);
  });

  it

  it('Fail to batch fund (no payment)', async() => {
    await rejects(tokenSale.batchFund(batchWithdrawDays, {from:user3, value: 0}));
  });

  it("Move to day 7 (from 5)", async() => {
    assert.equal(await tokenSale.currentDay(), 5);
    web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [86400*2],
        id: 0
    });
    assert.equal(await tokenSale.currentDay(), 7);
  })

  it('Fail to batch fund (first day passed)', async() => {
    await rejects(tokenSale.batchFund(batchWithdrawDays, {from:user3, value: batchWithdrawDays.length}));
  });

  it('Fail to batch fund (too many days)', async() => {
    batchWithdrawDays.push(56);
    await rejects(tokenSale.batchFund(batchWithdrawDays, {from:user3, value: batchWithdrawDays.length}));
    batchWithdrawDays = batchWithdrawDays.slice(1,51);
  });

  it('Fund 50 days in the future', async() => {
    await tokenSale.batchFund(batchWithdrawDays, {from:user3, value: batchWithdrawDays.length});
  });

  it("Move to day 57 (from 7)", async() => {
    assert.equal(await tokenSale.currentDay(), 7);
    web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [86400 * 50],
        id: 0
    });
    assert.equal(await tokenSale.currentDay(), 57);
  });

  it("Fail to batch withdraw (too many days)", async() => {
    batchWithdrawDays.push(57);
    await rejects(tokenSale.batchWithdraw(batchWithdrawDays, {from:user3}));
    batchWithdrawDays = batchWithdrawDays.slice(0,50);
  })

  it("batch withdraw 50 days from user3", async() => {
    let balanceBefore = await token.balanceOf(user3);
    let mybOwed = await tokenSale.getTotalTokensOwed(user3, batchWithdrawDays);
    let mybOwedCheck = bn(tokensPerDay).times(50);
    assert.equal(bn(batchWithdrawDays.length).eq(50), true);
    assert.equal(bn(mybOwed).eq(mybOwedCheck), true);
    console.log("mybit owed to user 3: ", mybOwed);
    await tokenSale.batchWithdraw(batchWithdrawDays, {from: user3});
    let balanceDiff = bn(await token.balanceOf(user3)).minus(balanceBefore);
    assert.equal(balanceDiff.eq(mybOwed), true);
  })

  // --------------Day 57------------------

  it("Pay directly", async() => {
    await web3.eth.sendTransaction({from:user4, to:tokenSale.address, value:1});
  });

  it("Move to day 366 (from 57)", async() => {
    assert.equal(await tokenSale.currentDay(), 57);
    web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [86400 * 309],
        id: 0
    });
    assert.equal(await tokenSale.currentDay(), 366);
  });

  // --------------Day 366------------------

  it("Fail to pay directly (past tokensale)", async() => {
    let err;
    try{
      await web3.eth.sendTransaction({from:user4, to:tokenSale.address, value:1});
    } catch(e){
      err = e;
      //console.log(e);
    }
    assert.notEqual(err, undefined);
  });
});
