<p align="center">
  <a href="https://mybit.io/">
    <img alt="MyBit Logo" src="https://files.mybit.io/favicons/favicon-96x96.png" width="90">
  </a>
</p>

# MyBit-Tokensale

[![CircleCI](https://circleci.com/gh/MyBitFoundation/MyBit-Tokensale.tech.svg?style=shield)](https://circleci.com/gh/MyBitFoundation/MyBit-Tokensale.tech) [![Coverage Status](https://coveralls.io/repos/github/MyBitFoundation/MyBit-Tokensale/badge.svg)](https://coveralls.io/github/MyBitFoundation/MyBit-Tokensale)

The contracts handing the token-sale for the MYB token.

## Details
The contracts release 100,000 MYB tokens everyday. Investors can contribute Ether at any day and they will split the days release of MYB in proportion to the Ether they contributed. Investors can withdraw their purchased MYB the next day. 50% of the received Ether will go towards the MyBit decentralized development fund, and the other 50% will go towards the MyBit foundation to be used for development.

* Length: 365 days
* Tokens: 100,000 MYB released every day
* Funding Currency: Ether
* Distribution: 50% DDF, 50% MyBit Foundation

## Guide

The contract keeps track of how much WEI it has received for a certain 24 hour period. An investor can choose any future day he wishes, or else send Ether into the current days funding period.

To get the current day pass in the current timestamp:

```javascript
function dayFor(uint _timestamp)
public
view
returns (uint16)
```

To send funds call fund() with the partiuclar day you wish to fund
```javascript
function fund(uint16 _day)
payable
duringSale(_day)
public
returns (bool) {
    require(!dayFinished(_day));
    require(msg.value > 0);
    Day storage today = day[_day];
    today.totalWeiContributed = today.totalWeiContributed.add(msg.value);
    today.weiContributed[msg.sender] = today.weiContributed[msg.sender].add(msg.value);
    emit LogTokensPurchased(msg.sender, msg.value, _day);
    return true;
}
```

To withdraw tokens call withdraw() from the funders account
```javascript
function withdraw(uint16 _day)
public
returns (bool) {
    require(dayFinished(_day), "day has not finished funding");
    Day storage thisDay = day[_day];
    uint amount = getTokensOwed(msg.sender, _day);
    delete thisDay.weiContributed[msg.sender];
    require(mybToken.transfer(msg.sender, amount), "couldnt transfer MYB to contributor");
    emit LogTokensCollected(msg.sender, amount, _day);
    return true;
}
```

To withdraw tokens from several days call batchWithdraw from the contributors account
```javascript
function batchWithdraw(uint16[] _day)
external
returns (bool) {
  uint amount;
  require(_day.length <= 50);
    for (uint i = 0; i < _day.length; i++){
      require(dayFinished(_day[i]));
      uint amountToAdd = getTokensOwed(msg.sender, _day[i]);
      amount = amount.add(amountToAdd);
      delete day[_day[i]].weiContributed[msg.sender];
      emit LogTokensCollected(msg.sender, amountToAdd, _day[i]);
    }
    require(mybToken.transfer(msg.sender, amount));
    return true;
}
```

To see a contributors current amount of MYB tokens owed:
```javascript
function getTokensOwed(address _contributor, uint16 _day)
public
view
returns (uint);
```

Or to see the total amount for a list of days:
```javascript
function getTotalTokensOwed(address _contributor, uint16[] _days)
public
view
returns (uint amount);
```

You can see the day for a given timestamp using:
```javascript
function dayFor(uint _timestamp)
public
view
returns (uint16) {
    return uint16(_timestamp.sub(start).div(24 hours));
}
```

To find the current day call:
```javascript
function currentDay()
public
view
returns (uint16) {
  return dayFor(now);
}
```


⚠️ This application is unstable and has not undergone any rigorous security audits. Use at your own risk.

 MyBit Platform™ CHE-177.186.963  
