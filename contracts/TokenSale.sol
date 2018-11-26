pragma solidity 0.5.0;

import './SafeMath.sol';
import './ERC20Interface.sol';

// @title MyBit Tokensale
// @notice A tokensale extending for 365 days. (0....364)
// @notice 100,000 MYB are releases everyday and split proportionaly to funders of that day
// @notice Anyone can fund the current or future days with ETH.
// @dev The current day is (timestamp - startTimestamp) / 24 hours
// @author Kyle Dewhurst, MyBit Foundation
contract TokenSale {
  using SafeMath for *;

  ERC20Interface mybToken;

  struct Day {
    uint totalWeiContributed;
    mapping (address => uint) weiContributed;
  }

  // Constants
  uint256 constant internal scalingFactor = 10**32;      // helps avoid rounding errors
  uint256 constant public tokensPerDay = 10**23;    // 100,000 MYB

  // MyBit addresses
  address public owner;
  address payable public mybitFoundation;
  address payable public developmentFund;

  uint256 public start;      // The timestamp when sale starts

  mapping (uint16 => Day) public day;

  constructor(address _mybToken, address payable _mybFoundation, address payable _developmentFund)
  public {
    mybToken = ERC20Interface(_mybToken);
    developmentFund = _developmentFund;
    mybitFoundation = _mybFoundation;
    owner = msg.sender;
  }

  // @notice owner can start the sale by transferring in required amount of MYB
  // @dev the start time is used to determine which day the sale is on (day 0 = first day)
  function startSale(uint _timestamp)
  external
  onlyOwner
  returns (bool){
    require(start == 0, 'Already started');
    require(_timestamp >= now  && _timestamp.sub(now) < 2592000, 'Start time not in range');
    uint saleAmount = tokensPerDay.mul(365);
    require(mybToken.transferFrom(msg.sender, address(this), saleAmount));
    start = _timestamp;
    emit LogSaleStarted(msg.sender, mybitFoundation, developmentFund, saleAmount, _timestamp);
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
  function batchFund(uint16[] calldata _day)
  payable
  external
  returns (bool) {
    require(_day.length <= 50);
    require(msg.value >= _day.length);   // need at least 1 wei per day
    uint256 amountPerDay = msg.value.div(_day.length);
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
      uint256 amount = getTokensOwed(msg.sender, _day);
      delete thisDay.weiContributed[msg.sender];
      mybToken.transfer(msg.sender, amount);
      emit LogTokensCollected(msg.sender, amount, _day);
      return true;
  }

  // @notice Updates claimableTokens, sends all tokens to contributor from previous days
  // @param (uint16[]) _day, list of token sale days msg.sender contributed wei towards
  function batchWithdraw(uint16[] calldata _day)
  external
  returns (bool) {
    uint256 amount;
    require(_day.length <= 50);
    for (uint8 i = 0; i < _day.length; i++){
      require(dayFinished(_day[i]));
      uint256 amountToAdd = getTokensOwed(msg.sender, _day[i]);
      amount = amount.add(amountToAdd);
      delete day[_day[i]].weiContributed[msg.sender];
      emit LogTokensCollected(msg.sender, amountToAdd, _day[i]);
    }
    mybToken.transfer(msg.sender, amount);
    return true;
  }

  // @notice owner can withdraw funds to the foundation wallet and ddf wallet
  // @param (uint) _amount, The amount of wei to withdraw
  // @dev must put in an _amount equally divisible by 2
  function foundationWithdraw(uint _amount)
  external
  onlyOwner
  returns (bool){
    uint256 half = _amount.div(2);
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
    require(_amount > 0, "must send ether with the call");
    require(duringSale(_day), "day is not during the sale");
    require(!dayFinished(_day), "day has already finished");
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
  returns (uint256) {
      Day storage thisDay = day[_day];
      uint256 percentage = thisDay.weiContributed[_contributor].mul(scalingFactor).div(thisDay.totalWeiContributed);
      return percentage.mul(tokensPerDay).div(scalingFactor);
  }

  // @notice gets the total amount of mybit owed to the contributor
  function getTotalTokensOwed(address _contributor, uint16[] memory _days)
  public
  view
  returns (uint256 amount) {
    require(_days.length < 100);
    for (uint16 i = 0; i < _days.length; i++){
      amount = amount.add(getTokensOwed(_contributor, _days[i]));
    }
    return amount;
  }

  // @notice returns the amount of wei contributed by _contributor on _day
  function getWeiContributed(uint16 _day, address _contributor)
  public
  view
  returns (uint256) {
    return day[_day].weiContributed[_contributor];
  }

  function getTotalWeiContributed(uint16 _day)
  public
  view
  returns (uint256) {
    return day[_day].totalWeiContributed;
  }

  // @notice return the day associated with this timestamp
  function dayFor(uint _timestamp)
  public
  view
  returns (uint16) {
      if (_timestamp < start) return 0;
      else return uint16(_timestamp.sub(start).div(86400));
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
    return start > 0 && _day <= uint16(364);
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

  event LogSaleStarted(address _owner, address _mybFoundation, address _developmentFund, uint _totalMYB, uint _startTime);
  event LogFoundationWithdraw(address _mybFoundation, uint _amount, uint16 _day);
  event LogTokensPurchased(address _contributor, uint _amount, uint16 _day);
  event LogTokensCollected(address _contributor, uint _amount, uint16 _day);

}
/*
contract TEST is TokenSale{
  address private alice = 0x00a329c0648769a73afac7f9381e08fb43dbea50;
  address private bob = 0x00a329c0648769a73afac7f9381e08fb43dbea60;
  address private eve = 0x00a329c0648769a73afac7f9381e08fb43dbea70;

  constructor(address _mybToken, address _mybFoundation, address _developmentFund)
  public
  TokenSale(_mybToken, _mybFoundation, _developmentFund){}

  function echidna_userLessThanDay() public returns (bool){
    uint totalOwed_ = getWeiContributed(uint16(0), alice) + getWeiContributed(uint16(0), bob) + getWeiContributed(uint16(0), eve);
    return(totalOwed_ == getTotalWeiContributed(uint16(0)));
  }

  function echidna_testDay() public returns (bool){
    return(currentDay() == uint16(0));
  }
}
*/
