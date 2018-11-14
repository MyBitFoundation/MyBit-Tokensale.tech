pragma solidity 0.4.24;

import './SafeMath.sol';
import './ERC20Interface.sol';


contract TokenSale {
  using SafeMath for *;

  ERC20Interface mybToken;

  struct Day {
    uint totalWeiContributed;
    mapping (address => uint) weiContributed;
  }


  // Constants
  uint constant internal scalingFactor = 10e32;
  uint constant public tokensPerDay = uint(10e22);

  // MyBit addresses
  address public owner;
  address public mybitFoundation;
  address public developmentFund;

  uint public start;      // The timestamp when sale starts

  mapping (uint16 => Day) public day;

  constructor(address _mybToken, address _mybFoundation, address _developmentFund)
  public {
    mybToken = ERC20Interface(_mybToken);
    developmentFund = _developmentFund;
    mybitFoundation = _mybFoundation;
    owner = msg.sender;
  }

  // @notice owner can start the sale by transferring in required amount of MYB
  // @dev the start time is used to determine which day the sale is on (day 0 = first day)
  function startSale()
  external
  onlyOwner
  returns (bool){
    require(start == 0);
    uint saleAmount = tokensPerDay.mul(365);
    require(mybToken.transferFrom(msg.sender, address(this), saleAmount));
    start = now;
    emit LogSaleStarted(msg.sender, mybitFoundation, developmentFund, saleAmount);
    return true;
  }

  // @notice contributor can contribute wei to sale on any current/future _day
  // @dev only accepts contributions between days 0 - 365
  function fund(uint16 _day)
  payable
  public
  returns (bool) {
      require(addContribution(msg.sender, msg.value, _day));
      return true;
  }

  // @notice Send an index of days and your payment will be divided equally among them
  // @dev WEI sent must divide equally into number of days.
  function batchFund(uint16[] _day)
  payable
  external
  returns (bool) {
    require(_day.length <= 50);
    require(msg.value >= _day.length);   // need at least 1 wei per day
    uint amountPerDay = msg.value.div(_day.length);
    assert (amountPerDay.mul(_day.length) == msg.value);   // Don't allow any rounding error 
    for (uint8 i = 0; i < _day.length; i++){
      require(addContribution(msg.sender, amountPerDay, _day[i]));
    }
    return true;
  }


  // @notice Updates claimableTokens, sends all wei to the token holder
  function withdraw(uint16 _day)
  external
  returns (bool) {
      require(dayFinished(_day), "day has not finished funding");
      Day storage thisDay = day[_day];
      uint amount = getTokensOwed(msg.sender, _day);
      delete thisDay.weiContributed[msg.sender];
      require(mybToken.transfer(msg.sender, amount), "couldnt transfer MYB to contributor");
      emit LogTokensCollected(msg.sender, amount, _day);
      return true;
  }

  // @notice Updates claimableTokens, sends all tokens to contributor from previous days
  // @param (uint16[]) _day, list of token sale days msg.sender contributed wei towards
  function batchWithdraw(uint16[] _day)
  external
  returns (bool) {
    uint amount;
    require(_day.length <= 50);
    for (uint8 i = 0; i < _day.length; i++){
      require(dayFinished(_day[i]));
      uint amountToAdd = getTokensOwed(msg.sender, _day[i]);
      amount = amount.add(amountToAdd);
      delete day[_day[i]].weiContributed[msg.sender];
      emit LogTokensCollected(msg.sender, amountToAdd, _day[i]);
    }
    require(mybToken.transfer(msg.sender, amount));
    return true;
  }

  // @notice owner can withdraw funds to the foundation wallet and ddf wallet
  // @param (uint) _amount, The amount of wei to withdraw
  // @dev must put in an _amount equally divisible by 2
  function foundationWithdraw(uint _amount)
  external
  onlyOwner
  returns (bool){
    uint half = _amount.div(2);
    assert (half.mul(2) == _amount);   // check for rounding error
    mybitFoundation.transfer(half);
    developmentFund.transfer(half);
    emit LogFoundationWithdraw(msg.sender, _amount, dayFor(now));
    return true;
  }

  // @notice updates ledger with the contribution from _investor
  // @param (address) _investor: The sender of WEI to the contract
  // @param (uint) _amount: The amount of WEI to add to _day
  // @param (uint16) _day: The day to fund
  function addContribution(address _investor, uint _amount, uint16 _day)
  internal
  returns (bool) {
    require(_amount > 0);
    require(duringSale(_day));
    require(!dayFinished(_day));
    Day storage today = day[_day];
    today.totalWeiContributed = today.totalWeiContributed.add(_amount);
    today.weiContributed[_investor] = today.weiContributed[_investor].add(_amount);
    emit LogTokensPurchased(_investor, _amount, _day);
    return true;
  }

  // @notice Calculates how many tokens user is owed. (new income + claimableTokens) / 10**32
  function getTokensOwed(address _contributor, uint16 _day)
  public
  view
  returns (uint) {
      Day storage thisDay = day[_day];
      uint percentage = thisDay.weiContributed[_contributor].mul(scalingFactor).div(thisDay.totalWeiContributed);
      return percentage.mul(tokensPerDay).div(scalingFactor);
  }

  // @notice gets the total amount of mybit owed to the contributor
  function getTotalTokensOwed(address _contributor, uint16[] _days)
  public
  view
  returns (uint amount) {
    for (uint16 i = 0; i < _days.length; i++){
      amount = amount.add(getTokensOwed(_contributor, _days[i]));
    }
    return amount;
  }

  // @notice returns the amount of wei contributed by _contributor on _day
  function getWeiContributed(uint16 _day, address _contributor)
  public
  view
  returns (uint) {
    return day[_day].weiContributed[_contributor];
  }

  function getTotalWeiContributed(uint16 _day)
  public
  view
  returns (uint) {
    return day[_day].totalWeiContributed;
  }

  // @notice return the day associated with this timestamp
  function dayFor(uint _timestamp)
  public
  view
  returns (uint16) {
      return uint16(_timestamp.sub(start).div(86400));
  }

  // @notice returns true if _day is finished
  function dayFinished(uint16 _day)
  public
  view
  returns (bool) {
    return dayFor(now) > _day;
  }

  // @notice reverts if the current day isn't less than 365
  function duringSale(uint16 _day)
  public
  view
  returns (bool){
    return (start > 0 && _day < uint16(365));
  }


  // @notice return the current day
  function currentDay()
  public
  view
  returns (uint16) {
    return dayFor(now);
  }

  // @notice Fallback function: Purchases contributor stake in the tokens for the current day
  function ()
  external
  payable {
      require(addContribution(msg.sender, msg.value, currentDay()));
  }



  // @notice only owner address can call
  modifier onlyOwner {
    require(msg.sender == owner);
    _;
  }

  event LogSaleStarted(address _owner, address _mybFoundation, address _developmentFund, uint _totalMYB);
  event LogFoundationWithdraw(address _mybFoundation, uint _amount, uint16 _day);
  event LogTokensPurchased(address _contributor, uint _amount, uint16 _day);
  event LogTokensCollected(address _contributor, uint _amount, uint16 _day);

}
