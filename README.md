# MyBit-Tokensale

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
duringSale
public {
    require(dayFor(now) <= _day);
    Day storage today = day[_day];
    today.weiPerToken = today.weiPerToken.add(msg.value.mul(scalingFactor).div(tokensPerDay));
    today.dayIncome = today.dayIncome.add(msg.value);
    today.weiContributed[msg.sender] = today.weiContributed[msg.sender].add(msg.value);
    emit LogTokensPurchased(msg.sender, msg.value, _day);
}
```

To withdraw tokens call withdraw() from the funders account
```javascript
function withdraw(uint16 _day)
public
returns (bool) {
    require(dayFinished(_day));
    require(updateclaimableTokens(msg.sender, _day));
    Day storage thisDay = day[_day];
    uint _amount = thisDay.claimableTokens[msg.sender].div(scalingFactor);
    delete thisDay.claimableTokens[msg.sender];
    require(mybToken.transfer(msg.sender, _amount));
    emit LogTokensCollected(msg.sender, _amount, _day);
    return true;
}
```

To see an investors current amount of tokens owed on a particular day
```javascript
function getUnclaimedAmount(address _user, uint16 _day)
public
view
returns (uint) {
    return (getTokensForContribution(_user, _day).add(day[_day].claimableTokens[_user]).div(scalingFactor));
}
```

⚠️ This application is unstable and has not undergone any rigorous security audits. Use at your own risk.

 MyBit Platform™ CHE-177.186.963  
