pragma solidity 0.4.24;

import './SafeMath.sol';
import './ERC20Interface.sol';

// TODO: add mechanism for situation nobody funds in a day
contract TokenSale {
  using SafeMath for *;


  struct Day {
    uint weiPerToken;       // // amount of wei received per MYB token
    uint dayIncome;
    mapping (address => uint) previousWeiPerToken;
    mapping (address => uint) weiContributed;
    mapping (address => uint) claimableTokens;
  }

  address public owner;
  uint constant scalingFactor = 1e32;
  uint constant decimals = 100000000000000000000;
  uint16 constant numDays = uint16(365);
  ERC20Interface mybToken;

  uint public start;
  uint public tokensPerDay;

  mapping (uint16 => Day) public day;

  constructor(address _mybToken)
  public {
    mybToken = ERC20Interface(_mybToken);
    owner = msg.sender;

  }

  function startSale(uint _totalAmount)
  external
  returns (bool){
    require(msg.sender == owner);
    // uint totalAmount = tokensPerDay.mul(356);
    require(mybToken.transferFrom(msg.sender, address(this), _totalAmount));
    tokensPerDay = _totalAmount.div(numDays);
    start = now;
    return true;
  }

  function fund(uint16 _day)
  payable
  duringSale
  public {
      require(dayFor(now) <= _day);
      Day storage today = day[_day];
      today.dayIncome = today.dayIncome.add(msg.value);
      //today.weiPerToken = today.weiPerToken.add(msg.value.mul(scalingFactor).div(tokensPerDay));
      today.weiPerToken = today.dayIncome.mul(decimals).div(tokensPerDay);
      today.weiContributed[msg.sender] = today.weiContributed[msg.sender].add(msg.value);
      emit LogTokensPurchased(msg.sender, msg.value, _day, today.weiPerToken, today.weiContributed[msg.sender]);
  }


  // @notice Updates claimableTokens, sends all wei to the token holder
  function withdraw(uint16 _day)
  public
  returns (bool) {
      require(dayFinished(_day), 'Day not finished');
      require(updateclaimableTokens(msg.sender, _day), 'Cannot update claimable tokens');
      Day storage thisDay = day[_day];
      uint _amount = thisDay.claimableTokens[msg.sender];
      delete thisDay.claimableTokens[msg.sender];
      require(mybToken.transfer(msg.sender, _amount), 'Cannot transfer tokens');
      emit LogTokensCollected(msg.sender, _amount, _day, thisDay.weiPerToken, thisDay.weiContributed[msg.sender]);
      return true;
  }

  // @notice Updates claimableTokens, sends all wei to the token holder
  function batchWithdraw(uint16[] _day)
  public
  returns (bool) {
    uint amount;
    require(_day.length < 100);
      for (uint i = 0; i < _day.length; i++){
        require(dayFinished(_day[i]));
        require(updateclaimableTokens(msg.sender, _day[i]));
        Day storage thisDay = day[_day[i]];
        uint amountToAdd = thisDay.claimableTokens[msg.sender].div(scalingFactor);
        amount = amount.add(amountToAdd);
        delete thisDay.claimableTokens[msg.sender];
        emit LogTokensCollected(msg.sender, amountToAdd, _day[i], thisDay.weiPerToken, thisDay.weiContributed[msg.sender]);
      }
      require(mybToken.transfer(msg.sender, amount));
      return true;
  }

  // @notice Calculates how much value _user holds
  function getTokensForContribution(address _user, uint16 _day)
  public
  view
  returns (uint) {
      Day storage thisDay = day[_day];
      uint weiPerTokenDifference = thisDay.weiPerToken.sub(thisDay.previousWeiPerToken[_user]);
      return weiPerTokenDifference.mul(thisDay.weiContributed[_user]);
  }

  // @notice Calculates how much wei user is owed. (new income + claimableTokens) / 10**32
  function getUnclaimedAmount(address _user, uint16 _day)
  public
  view
  returns (uint) {
      return (getTokensForContribution(_user, _day).add(day[_day].claimableTokens[_user]).div(scalingFactor));
  }

  // @notice update the amount claimable by this user
  function updateclaimableTokens(address _user, uint16 _day)
  internal
  returns (bool) {
      Day storage thisDay = day[_day];
      thisDay.claimableTokens[msg.sender] = thisDay.weiContributed[msg.sender].mul(decimals).div(thisDay.weiPerToken);
      //thisDay.claimableTokens[_user] = thisDay.claimableTokens[_user].add(getTokensForContribution(_user, _day));
      //thisDay.previousWeiPerToken[_user] = thisDay.weiPerToken;
      return true;
  }

  // @notice return the day associated with this timestamp
  function dayFor(uint _timestamp)
  public
  view
  returns (uint16) {
      return uint16(_timestamp.sub(start).div(24 hours));
  }

  // @notice reverts if the current day is greater than 365
  modifier duringSale() {
    require(dayFor(now) < uint16(365) && start > 0);
    _;
  }

  // @notice returns true if _day is finished
  function dayFinished(uint16 _day)
  internal
  view
  returns (bool) {
    require(dayFor(now) > _day);
    return true;
  }

  // @notice Fallback function: Accepts Ether and updates ledger (issues dividends)
  function ()
  public {
      revert();
  }

  event LogTokensPurchased(address _contributor, uint _amount, uint16 _day, uint weiPerToken, uint weiContributed);
  event LogTokensCollected(address _contributor, uint _amount, uint16 _day, uint weiPerToken, uint weiContributed);

}
