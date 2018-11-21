var bn = require('bignumber.js');

const Token = artifacts.require("./ERC20");

const tokenSupply = 180000000000000000000000000;
const tokenPerAccount = 1000000000000000000000;


contract('Token', async(accounts) => {
  const owner = accounts[0];
  const user1 = accounts[1];
  const user2 = accounts[2];
  const tokenHolders = [user1, user2];

  let token;

  it('Deploy Token', async() => {
    token = await Token.new(bn(tokenSupply), "MyBit", 18, "MYB");
  });

  it("Spread tokens to users", async() => {
    for (var i = 0; i < tokenHolders.length; i++) {
      //console.log(web3.eth.accounts[i]);
      //console.log(tokenHolders[i]);
      await token.transfer(tokenHolders[i], bn(tokenPerAccount));
      let userBalance = await token.balanceOf(tokenHolders[i]);
      assert.equal(Number(bn(userBalance)), Number(bn(tokenPerAccount)));
    }
    // Check token ledger is correct
    let totalTokensCirculating = bn(tokenHolders.length).multipliedBy(tokenPerAccount);
    let remainingTokens = bn(tokenSupply).minus(totalTokensCirculating);
    let ownerTokens = bn(await token.balanceOf(owner));
    console.log(ownerTokens);
    assert.equal(Number(ownerTokens), Number(remainingTokens));
  });

  it('Fail to send ether to token contract', async() => {
    let err;
    try{
      await web3.eth.sendTransaction({from:user1, to: token.address, value: 10000})
    } catch(e){
      err = e;
    }
    assert.notEqual(err, undefined);
  });

  it('Fail to transfer', async() => {
    let err;
    try{
      await token.transfer(token.address, 1000);
    } catch(e){
      err = e;
    }
    assert.notEqual(err, undefined);
  });

  it('Fail to transfer', async() => {
    let err;
    try{
      await token.transfer(0, 1000);
    } catch(e){
      err = e;
    }
    assert.notEqual(err, undefined);
  });

  it('Fail to transfer from', async() => {
    let err;
    try{
      await token.transferFrom(user1, token.address, 1000);
    } catch(e){
      err = e;
    }
    assert.notEqual(err, undefined);
  });

  it('Fail to transfer from', async() => {
    let err;
    try{
      await token.transferFrom(user1, 0, 1000);
    } catch(e){
      err = e;
    }
    assert.notEqual(err, undefined);
  });

  it('Get totalSupply', async() => {
    let supply = await token.totalSupply();
    assert.equal(supply, tokenSupply);
  });

  it('Approve user', async() => {
    await token.approve(user1, 10000, {from: user2});
    assert.equal(await token.allowance(user2, user1), 10000);
  });

  it('Transfer From', async() => {
    await token.transferFrom(user2, user1, 5000, {from: user1});
    assert.equal(await token.allowance(user2, user1), 5000);
  });



});
