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
  const owner = accounts[0];
  const user1 = accounts[1];
  const user2 = accounts[2];
  const user3 = accounts[3];
  const user4 = accounts[4];
  const user5 = accounts[5];
  const user6 = accounts[6];
  const user7 = accounts[7];

  const ddf = accounts[8];
  const foundation = accounts[9];

  const users = [user1, user2, user3, user4, user5, user6, user7];

  let token;
  let tokenSale;
  let start;
  let oneDay = 86400;
  let now;
  let noon;

  const name = "MyBit";
  const symbol = "MYB";
  const WEI = 10**18;


  // Token numbers
  const tokenSupply = 180000000;      // 180 million
  const circulatingSupply = 96000000;
  const foundationSupply = tokenSupply - circulatingSupply;
  console.log("foundation supply: " , foundationSupply);
  const tokenPerUser = bn(circulatingSupply).dividedBy(users.length).multipliedBy(WEI);
  const totalSaleAmount = bn(100000).times(365);
  console.log("total sale amount", bn(totalSaleAmount).multipliedBy(WEI));

  let tokensPerDay;

  it('Get time', async() => {
    let block = await web3.eth.getBlock('latest');
    now = bn(block.timestamp);
    let remainder = now.modulo(oneDay);
    noon = now.minus(remainder).plus(oneDay).plus(oneDay/2);
    console.log('Now: ', now);
    console.log('Noon: ', noon);
  });

  it('Deploy MYB token', async() => {
    token = await Token.new(bn(tokenSupply).multipliedBy(WEI), "MyBit", 18, "MYB");
  });

  it('Deploy TokenSale contract', async() => {
    //console.log(token.address);
    tokenSale = await TokenSale.new(token.address, foundation, ddf);
    assert.equal(await tokenSale.start(), 0);
    assert.equal(await tokenSale.owner(), owner);
    assert.equal(await tokenSale.mybitFoundation(), foundation);
    assert.equal(await tokenSale.developmentFund(), ddf);
  });

  it('Try to start sale from non-owner account', async() => {
    await token.transfer(user1, bn(totalSaleAmount).multipliedBy(WEI));
    await token.approve(tokenSale.address, bn(totalSaleAmount).multipliedBy(WEI), {from: user1})
    await rejects(tokenSale.startSale(noon, {from: user1}));
    await token.transfer(owner, bn(totalSaleAmount).multipliedBy(WEI), {from: user1});
  });

  it('Start token sale with not enough MYB', async() => {
    await rejects(tokenSale.startSale(noon));
  });

  it('Try funding before sale', async() => {
    await rejects(tokenSale.fund(0, {from: user1, value: bn(2).multipliedBy(WEI)}));
  });

  it('Try batchfunding before sale', async() => {
    await rejects(tokenSale.fund([0,1], {from: user1, value: bn(2).multipliedBy(WEI)}));
  });

  it("Fail to pay directly (before tokensale)", async() => {
    let err;
    try{
      await web3.eth.sendTransaction({from:user4, to:tokenSale.address, value:1});
    } catch(e){
      err = e;
      //console.log(e);
    }
    assert.notEqual(err, undefined);
  });

  // ------------Day 0----------------
  it('Fail to start sale: past', async() => {
    await rejects(tokenSale.startSale(noon-oneDay));
  });

  it('Fail to start sale: future', async() => {
    await rejects(tokenSale.startSale(noon+(oneDay*30)));
  });

  it('Start token sale', async() => {
    assert.equal(await token.balanceOf(tokenSale.address), 0);
    await token.approve(tokenSale.address , bn(totalSaleAmount).multipliedBy(WEI));
    assert.equal(bn(await token.balanceOf(owner)).gt(bn(totalSaleAmount).multipliedBy(WEI)), true);
    await tokenSale.startSale(noon);
    tokensPerDay = bn(await tokenSale.tokensPerDay());
    start = bn(await tokenSale.start());
    console.log("starting time is ", Number(start));
    console.log("tokens per day: ", Number(tokensPerDay.div(WEI)));
    assert.notEqual(await tokenSale.start(), 0);
    assert.equal(bn(await tokenSale.dayFor(start.plus(1))).eq(0), true);
    assert.equal(bn(await token.balanceOf(tokenSale.address)).eq(bn(totalSaleAmount).multipliedBy(WEI)), true);
  });

  it('Check day length', async() => {
    assert.equal(Number(bn(await tokenSale.dayFor(start.plus(1)))), 0);
    let secondDay = start.plus(oneDay);
    let lastDay = start.plus(oneDay*365);
    console.log("first day ", Number(await tokenSale.dayFor(secondDay)));
    console.log("last day ", Number(await tokenSale.dayFor(lastDay)));
    assert.equal(await tokenSale.dayFor(start.plus(1)), 0);
    assert.equal(await tokenSale.dayFor(secondDay), 1);
  });

  it("Try to check dayFor() for negative day", async() => {
    let negDay = start.minus(oneDay);
    await rejects(tokenSale.dayFor(negDay));
  });

  it('Try starting sale again', async() => {
    assert.equal(bn(await token.balanceOf(owner)).gt(bn(totalSaleAmount).multipliedBy(WEI)), true);
    await token.approve(tokenSale.address, bn(totalSaleAmount).multipliedBy(WEI));
    await rejects(tokenSale.startSale(noon));
  });

  it('Try funding with no WEI', async() => {
    await rejects(tokenSale.fund(0, {from: user1}));
  });

  it('Try funding a negative day', async() => {
    await rejects(tokenSale.fund(-10*WEI, {from: user1}));
  });

  it('Try funding a negative day', async() => {
    await rejects(tokenSale.fund(0, {from: user1, value: -10*WEI}));
  });

  it('Try batch funding with no WEI', async() => {
    await rejects(tokenSale.batchFund([0,1], {from: user1}));
  });

  it("Fail to fund directly with no WEI", async() => {
    let err;
    try{
      await web3.eth.sendTransaction({from:user4, to:tokenSale.address});
    } catch(e){
      err = e;
      //console.log(e);
    }
    assert.notEqual(err, undefined);
  });

  it("Fail to fund directly before start date", async() => {
    let err;
    try{
      await web3.eth.sendTransaction({from:user4, to:tokenSale.address, value: 2});
    } catch(e){
      err = e;
      //console.log(e);
    }
    assert.notEqual(err, undefined);
  });

  it('Funding by two users', async() => {
    let block = await web3.eth.getBlock('latest');
    let now = bn(block.timestamp);
    console.log("timestamp is ", now);
    console.log("start time is ", start);
    tx = await tokenSale.fund(0, {from: user1, value: bn(2).multipliedBy(WEI)});
    tx = await tokenSale.fund(0, {from: user2, value: bn(2).multipliedBy(WEI)});
    // Move to next day
    web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [oneDay*2], id: 0
    }, function(){
      console.log('Move forward in time');
    });
    assert.equal(await tokenSale.currentDay(), 1);
  });

  // ------------ Day 1 ------------

  it('Try funding previous day', async() => {
    await rejects(tokenSale.fund(0, {from: user3, value: bn(2).multipliedBy(WEI)}));
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
    let fundAmount = bn(2).multipliedBy(WEI);
    tx = await tokenSale.fund(1, {from: user1, value: bn(2).multipliedBy(WEI)});
    tx = await tokenSale.fund(1, {from:user2, value: bn(2).multipliedBy(WEI)});
    assert.equal(bn(fundAmount).eq(await tokenSale.getWeiContributed(1, user1)), true);
    assert.equal(bn(fundAmount).eq(await tokenSale.getWeiContributed(1, user2)), true);
    assert.equal(await tokenSale.currentDay(), 1);
    web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [86401], id: 0
    }, function(){
      console.log('Move forward in time');
    });
    assert.equal(await tokenSale.currentDay(), 2);
  });

  // ------------ Day 2 ------------

  it('Withdraw day 1, user2', async() => {
    let amountToReceive = await tokenSale.getTokensOwed(user2, 1);
    let balanceBefore = await token.balanceOf(user2);
    let shouldReceive = tokensPerDay / 2;
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
    console.log('Gas cost: ', tx.receipt.gasUsed);
    let balanceAfter = await token.balanceOf(user1);
    assert.equal(bn(tokensToReceive).eq(balanceAfter), true);
    let totalBalance = bn(await token.balanceOf(user1)).plus(await token.balanceOf(user2));
    assert.equal(bn(totalBalance).eq(tokensPerDay*2), true);
  });

  it("batch withdraw again and receive 0 wei", async() => {
    assert.equal(await tokenSale.getTokensOwed(user1, 0), 0);
    assert.equal(await tokenSale.getTokensOwed(user1, 1), 0);
    let balanceBefore = await token.balanceOf(user1);
    tx = await tokenSale.batchWithdraw([0,1], {from: user1});
    console.log('Gas cost: ', tx.receipt.gasUsed);
    assert.equal(bn(await token.balanceOf(user1)).eq(balanceBefore), true);
  })

  it("Try to withdraw from non-owner account", async() => {
    await rejects(tokenSale.foundationWithdraw(web3.eth.getBalance(tokenSale.address), {from: user1}));
  })

  it("Try to withdraw more wei than contract holds", async() => {
    await rejects(tokenSale.foundationWithdraw(web3.eth.getBalance(tokenSale.address)+1));
  });

  it('Fail owner withdraw', async() => {
    await rejects(tokenSale.foundationWithdraw(1));
  });

  it('Owner withdraws tokens for foundation + ddf', async() => {
    let weiInContract = bn(await web3.eth.getBalance(tokenSale.address));
    console.log(weiInContract);
    let foundationBalance = bn(await web3.eth.getBalance(foundation));
    let ddfBalance = bn(await web3.eth.getBalance(ddf));
    await tokenSale.foundationWithdraw(weiInContract);

    let foundationBalanceDiff = bn(await web3.eth.getBalance(foundation)).minus(foundationBalance);
    let ddfBalanceDiff = bn(await web3.eth.getBalance(ddf)).minus(ddfBalance);
    assert.equal(Number(bn(await web3.eth.getBalance(tokenSale.address))), 0);
    assert.equal(Number(foundationBalanceDiff), Number(weiInContract.dividedBy(2)))
    assert.equal(Number(ddfBalanceDiff), Number(weiInContract.dividedBy(2)));
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
    }, function(){
      console.log('Move forward in time');
    });
    assert.equal(await tokenSale.currentDay(), 5);
  })

  //---------------------Day 5-------------------

  it("Batch withdraw user3", async() => {
    let balanceBefore = await token.balanceOf(user3);
    let mybOwed = await tokenSale.getTotalTokensOwed(user3, [3,4]);
    assert.equal(bn(mybOwed).eq(tokensPerDay*2), true);
    tx = await tokenSale.batchWithdraw([3,4], {from: user3});
    console.log('Gas cost: ', tx.receipt.gasUsed);
    let balanceDiff = bn(await token.balanceOf(user3)).minus(balanceBefore);
    assert.equal(balanceDiff.eq(mybOwed), true);
  });

  it('fund currentDay (5) with user3', async() => {
    assert.equal(await tokenSale.currentDay(), 5);
    await tokenSale.fund(5, {from: user3, value: 13});
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
    }, function(){
      console.log('Move forward in time');
    });
    assert.equal(await tokenSale.currentDay(), 7);
    assert.equal(bn(await tokenSale.getTokensOwed(user3, 5)).eq(tokensPerDay), true);
  })

  it('Fail to batch fund (first day passed)', async() => {
    await rejects(tokenSale.batchFund(batchWithdrawDays, {from:user3, value: batchWithdrawDays.length}));
  });

  it('Fail to batch fund (too many days)', async() => {
    batchWithdrawDays.push(56);
    await rejects(tokenSale.batchFund(batchWithdrawDays, {from:user3, value: batchWithdrawDays.length}));
    batchWithdrawDays = batchWithdrawDays.slice(1,51);
  });

  it('Try to fund 50 days in the future with only 49 WEI', async() => {
    await rejects(tokenSale.batchFund(batchWithdrawDays, {from:user3, value: batchWithdrawDays.length-1}));
  });

  it('Try to fund 50 days in the future with 99 WEI', async() => {
    await rejects(tokenSale.batchFund(batchWithdrawDays, {from:user3, value: 99}));
  });

  it('Fund 50 days in the future', async() => {
    tx = await tokenSale.batchFund(batchWithdrawDays, {from:user3, value: batchWithdrawDays.length});
    console.log('Gas cost: ', tx.receipt.gasUsed);
  });

  it("Move to day 57 (from 7)", async() => {
    assert.equal(await tokenSale.currentDay(), 7);
    web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [86400 * 50],
        id: 0
    }, function(){
      console.log('Move forward in time');
    });
    assert.equal(await tokenSale.currentDay(), 57);
  });

  it("Fail to batch withdraw (too many days)", async() => {
    batchWithdrawDays.push(52);
    await rejects(tokenSale.batchWithdraw(batchWithdrawDays, {from:user3}));
    batchWithdrawDays = batchWithdrawDays.slice(0,50);
  })

  it("batch withdraw 50 days from user3", async() => {
    let balanceBefore = await token.balanceOf(user3);
    let mybOwed = await tokenSale.getTotalTokensOwed(user3, batchWithdrawDays);
    let mybOwedCheck = bn(tokensPerDay).times(50);
    assert.equal(bn(batchWithdrawDays.length).eq(50), true);
    assert.equal(bn(mybOwed).eq(mybOwedCheck), true);
    tx = await tokenSale.batchWithdraw(batchWithdrawDays, {from: user3});
    console.log('Gas cost: ', tx.receipt.gasUsed);
    let balanceDiff = bn(await token.balanceOf(user3)).minus(balanceBefore);
    assert.equal(balanceDiff.eq(mybOwed), true);
  })

  // --------------Day 57------------------

  it("Pay directly", async() => {
    assert.equal(await tokenSale.currentDay(), 57);
    let contributions = await tokenSale.getTotalWeiContributed(57);
    assert.equal(0, contributions);
    await web3.eth.sendTransaction({from:user4, to:tokenSale.address, value:1});
    assert.equal(bn(await tokenSale.getTotalWeiContributed(57)).eq(1), true);
    console.log("user payed directly amount wei: ", await tokenSale.getWeiContributed(57, user4));
  });

  it("Force rounding error on day 58", async() => {
    assert.equal(bn(await tokenSale.getTotalWeiContributed(58)).eq(0), true);
    await tokenSale.fund(58, {from: user5, value: 1});
    await tokenSale.fund(58, {from: user6, value: 1});
    await tokenSale.fund(58, {from: user7, value: 1});

  });

  it("Move to day 59 (from 59)", async() => {
    assert.equal(await tokenSale.currentDay(), 57);
    web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [86400 * 2],
        id: 0
    }, function(){
      console.log('Move forward in time');
    });
    assert.equal(bn(await tokenSale.getTokensOwed(user4, 57)).eq(tokensPerDay), true);
    console.log("user5 is owed ", await tokenSale.getTokensOwed(user5, 58));
    console.log("user6 is owed ", await tokenSale.getTokensOwed(user6, 58));
    console.log("user7 is owed ", await tokenSale.getTokensOwed(user7, 58));
    assert.equal(await tokenSale.currentDay(), 59);
  });

  it('Withdraw with rounding errors', async() => {
    user5Owed = bn(await tokenSale.getTokensOwed(user5, 58));
    user6Owed = bn(await tokenSale.getTokensOwed(user6, 58));
    user7Owed = bn(await tokenSale.getTokensOwed(user7, 58));
    let totalOwed = user5Owed.plus(user6Owed).plus(user7Owed);
    console.log("total owed for 3 users is ", totalOwed);
    let mybSaleBalance = await token.balanceOf(tokenSale.address);
    console.log("mybbalance before withdraw ", mybSaleBalance);
    await tokenSale.withdraw(58, {from: user5});
    await tokenSale.withdraw(58, {from: user6});
    await tokenSale.withdraw(58, {from: user7});
    console.log("mybabalance after withdraw ", await token.balanceOf(tokenSale.address));
    let user5Balance = bn(await token.balanceOf(user5));
    let user6Balance = bn(await token.balanceOf(user6));
    let user7Balance = bn(await token.balanceOf(user7));
    assert.equal(user5Balance.eq(user6Balance), true);
    assert.equal(user6Balance.eq(user7Balance), true);
    let offByWEI = bn(tokensPerDay).minus(1);
    let combinedBalance = user5Balance.plus(user6Balance).plus(user7Balance);
    assert.equal(combinedBalance.eq(offByWEI), true);
  });

  it("Fund last day of tokensale", async() => {
    await tokenSale.fund(364, {from: user4, value:1});
  });

  it("Batch fund last day of tokensale", async() => {
    await tokenSale.batchFund([363,364], {from: user4, value:2});
  });

  it("Move to day 365 (from 59)", async() => {
    assert.equal(await tokenSale.currentDay(), 59);
    web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [86400 * 306],
        id: 0
    }, function(){
      console.log('Move forward in time');
    });
    assert.equal(await tokenSale.currentDay(), 365);
  });

  // --------------Day 365------------------

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

  it("withdraw from last day", async() => {
    await tokenSale.withdraw(364, {from: user4});
  });

  it('Deploy MYB token', async() => {
    token = await Token.new(bn(tokenSupply).multipliedBy(WEI), "MyBit", 18, "MYB");
  });

  it('Deploy TokenSale contract', async() => {
    tokenSale = await TokenSale.new(token.address, foundation, ddf);
    assert.equal(await tokenSale.start(), 0);
    assert.equal(await tokenSale.owner(), owner);
  });

  it('Start token sale', async() => {
    assert.equal(await token.balanceOf(tokenSale.address), 0);
    await token.approve(tokenSale.address , bn(totalSaleAmount).multipliedBy(WEI));
    assert.equal(bn(await token.balanceOf(owner)).gt(bn(totalSaleAmount).multipliedBy(WEI)), true);
    await tokenSale.startSale((noon.plus(bn(366).times(oneDay))));
    // Move to next day
    web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [oneDay], id: 0
    }, function(){
      console.log('Move forward in time');
    });
    assert.equal(bn(await tokenSale.tokensPerDay()).eq(tokensPerDay), true);
  });

  let allDays = [];
  it('Set up funding days)', async() => {
    for (let i = 0; i < 365; i++){
      allDays.push(i);
    }
    assert.equal(bn(allDays.length).eq(365), true);
  });

  it('Fund all 365 days', async() => {
    let batchDays = [];
    let counter = 0;
    for (let i = 50; i < 365; i += 50){
      batchDays = allDays.slice(counter*50, i);
      assert.equal(bn(batchDays.length).eq(50), true);
      counter++;
      await tokenSale.batchFund(batchDays, {from:user5, value:batchDays.length});
    }
    assert.equal(bn(await tokenSale.getTotalWeiContributed(349)).eq(1), true);
    assert.equal(await tokenSale.getTotalWeiContributed(350), 0);
    batchDays = allDays.slice(350, 365);
    await tokenSale.batchFund(batchDays, {from: user5, value:batchDays.length});
  });

  it("Move to day 365 (from 0)", async() => {
    // assert.equal(await tokenSale.currentDay(), 0);
    web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [oneDay * 365],
        id: 0
    }, function(){
      console.log('Move forward in time');
    });
    assert.equal(await tokenSale.currentDay(), 365);
  });

  it('Verify day has finished ', async() => {
    assert.equal(true, await tokenSale.dayFinished(364));

  });

  let totalTokens;
  it('Withdraw from all 365 days', async() => {
    totalTokens = await token.balanceOf(tokenSale.address);
    console.log("total tokens are ", totalTokens);
    let batchDays = [];
    let counter = 0;
    let tokensPer50Days = bn(tokensPerDay).times(50);
    assert.equal(await token.balanceOf(user5), 0);
    for (let i = 50; i < 365; i += 50){
      batchDays = allDays.slice(counter*50, i);
      assert.equal(bn(batchDays.length).eq(50), true);
      counter++;
      await tokenSale.batchWithdraw(batchDays, {from:user5});
      batchDays = allDays.slice(350, 365);
      await tokenSale.batchWithdraw(batchDays, {from: user5});
    }
  });

  it("Verify that all MYB tokens were sold", async() => {
    let randomDay = bn(Math.floor((Math.random() * 364) + 1));
    console.log("random number is ", randomDay);
    assert.equal(bn(await tokenSale.getWeiContributed(randomDay, user5)).eq(0), true);  // wei contributed should be deleted
    assert.equal(bn(await token.balanceOf(user5)).eq(totalTokens), true);
    assert.equal(bn(await token.balanceOf(tokenSale.address)).eq(0), true);
  });

  it("Verify sale days ", async() => {
    assert.equal(true, await tokenSale.duringSale(0));
    assert.equal(true, await tokenSale.duringSale(364));
    assert.equal(false, await tokenSale.duringSale(365));
  });

  it("Try to withdraw Ether that isn't equally divisible by 2", async() => {
    let randomNumber = Math.floor((Math.random() * 242));
    if (randomNumber % 2 == 0) {
      randomNumber++;
    }
    rejects(tokenSale.foundationWithdraw(randomNumber));
  });

  it("Try to get tokens owed for more than 100 days", async() => {
    await rejects(tokenSale.getTotalTokensOwed(user5, allDays));
  });
});
