# Delta Neutral Portfolio

This repository demonstrates a straightforward **delta neutral portfolio** on Ethereum, the project deploys a smart contract on a Hardhat in-memory network (`npx hardhat node`) that automatically rebalances ETH positions to maintain a delta-neutral state for a short option position.

## Quick Start

### Install Dependencies
```shell
npm install --save-dev hardhat jstat
```

### Bring Up Local Hardhat Test Network
(On a new Terminal)
```shell
npx hardhat node
```

### Run Simulation
```shell
./simulate.sh
```

## Overview
The implementation features three key ideas:

1. **Off-Chain Delta Computation**  
   To save on gas costs and reduce on-chain complexity, the option delta is calculated off-chain using the Black–Scholes model. The JavaScript statistical library [JStat](https://github.com/jstat/jstat) is used in `src/deltaCalculator.js` to compute the delta for a European call option.

2. **Smart Contract Rebalancing**
   The smart contract ([`DeltaNeutralPortfolio.sol`](https://github.com/Angold-4/DNP/blob/main/contracts/DeltaNeutralPortfolio.sol)) maintains:
   - **Underlying Position:** The amount of ETH held.
   - **Option Position:** The number of shorted options with a defined strike price.
   - **Computed Option Delta:** Updated on-chain by an off-chain service.
   
   Based on the computed net delta, the contract automatically triggers buy/sell trades:
   - **Net Delta > 0:** Excess long exposure leads to selling ETH.
   - **Net Delta < 0:** Excess short exposure leads to buying ETH.

3. **Real-World Simulation**
   A simulation script mimics live market conditions by updating the ETH price every 10 seconds. For each price change:
   - The off-chain system calculates the current option delta.
   - The contract's `updateOptionDelta()` and `rebalance()` methods are called to adjust the portfolio.
   
   This dynamic rebalancing demonstrates how small fluctuations in ETH price can be mitigated to maintain a delta-neutral position.

## Demo
Here are the parameters of our on-chain option:
```javascript
const optionCount = 5;
const optionStrike = 2000 * 1e8; // Strike price (8 decimals)
const r = 0.01;                  // Risk-free rate (1%)
const sigma = 0.5;               // Volatility (50%)
const T = 30 / 365;              // Time to expiration: 30 days
```

![demo](demo.gif)

### Explanation of a Simulation Output

```
Depositing 2.5 ETH into the portfolio...
Deposit complete.
Current underlying position (ETH): 2.5
Opening a short option position...
Short option position opened.
Initial net delta (1e18 fixed point): 2500000000000000000
```
### Example 1: ETH Price Increase (2000 to 2025 USD)

```
--- Price Update Triggered ---
New simulated ETH price (8 decimals): 202500000000
Price updated in aggregator.
Computed off-chain option delta (call): 0.5651611759884737
Option delta in 1e18 fixed point: 565161175988473700

--- RebalanceTrade Event (Live) ---
Action (buy/sell): buy
Trade Amount: 0.3258058799423685 ETH
Net Delta: -0.3258058799423685
Current Option Delta: 0.5651611759884737
Underlying Position: 2.8258058799423685 ETH
-------------------------------------
```

- **Scenario:**  
  When ETH’s price increases to 2025 USD, the option delta rises. The computed delta for our short option is now larger, causing our overall net delta to become negative.

- **Action:**  
  **Buy ETH.**  
  - **Why?** A negative net delta indicates that our portfolio is too short relative to the option’s delta. By buying ETH, we increase our underlying position to counteract the increased option delta.

### Example 2: ETH Price Decrease (2025 to 1922 USD)
```
--- Price Update Triggered ---
New simulated ETH price (8 decimals): 192200000000
Price updated in aggregator.
Computed off-chain option delta (call): 0.4206969963533221
Option delta in 1e18 fixed point: 420696996353322100

--- RebalanceTrade Event (Live) ---
Action (buy/sell): sell
Trade Amount: 0.722320898175758 ETH
Net Delta: 0.722320898175758
Current Option Delta: 0.4206969963533221
Underlying Position: 2.1034849817666105 ETH
-------------------------------------
```
- **Scenario:**  
  When ETH's price falls to 1922 USD, the option delta decreases. The computed delta for our short option is now lower, making the overall net delta positive.

- **Action:**  
  **Sell ETH.**  
  - **Why?** A positive net delta indicates that we are too long on the underlying asset relative to the option’s lower delta. By selling ETH, we reduce our underlying position to match the lower option delta.

These examples demonstrate that our implementation correctly monitors changes in the option delta and executes rebalancing trades (buy/sell) to ensure the overall portfolio remains delta neutral. This dynamic adjustment is crucial to protect the portfolio’s net income from the impact of small underlying price movements.


## Delta: A Measure of Price Sensitivity
**Delta** is a measure of how much the price of a derivative (like an option) changes when the price of the underlying asset (like a stock) changes.
* The delta of an option (for a call, between 0 and 1) tells you approximately how much the option’s price will change for a \$1 change in the underlying asset's price.
* For example, a delta of 0.4 means that for every \$1 increase in ETH, the call's value increases by about \$0.40. (Since you sold the call, you have a negative delta exposure of –0.4.)
* The delta is calculated using a pricing model to compute both the option's price (premium) and its sensitivities (the "Greeks").

## Delta Neutral: Balancing Out Risk
Delta neutral means the overall portfolio delta is zero, so the gains and losses from price movements of the underlying asset cancel each other out.

If you sell 1 at-the-money call that has a delta of +0.5 (0.50), you might buy 0.5 units of the underlying to hedge.
This way, if the underlying goes up a little, the call you sold loses (because calls gain value when price goes up).
but the underlying you hold gains—and ideally, these small movements offset each other.

### Example On Blockchain
Suppose you hold a call option on ETH that has a delta of 0.5. This means the option's price will move about half as much as ETH's price.
To achieve a delta neutral position, you could short (sell) a certain amount of ETH such that the loss from the short position offsets the gain from the call option when ETH's price moves.
If you do this correctly, **small moves in ETH's price won't change the overall value of your combined positions**.

## Rebalancing
The delta of options isn't static; it changes as the price of the underlying asset changes. This is why traders often need to rebalance their portfolio to maintain delta neutrality.
In blockchain environments, rebalancing can be complex and may involve transaction costs, so automated systems are often used to manage this.

## Make Money?
Even though the portfolio is hedged against small directional moves, the idea isn't to "do nothing" but rather to profit from factors other than simple price movement, such as:

### 1. Option Premium
**Option Premium** is the price the buyer pays (and the seller receives) for the right/option on an underlying asset.  
Because short options can gain or lose value if the underlying moves significantly, traders will hedge their position in the underlying (for instance, by buying or selling shares of the underlying stock or by using other options/futures).

> An option is a financial contract that gives the holder (the buyer of the option) the right (but not the obligation) to buy or sell an underlying asset (such as a stock or an index) at a specified price (called the strike price) on or before a certain date (the expiration date).

There are two basic types of options:
1. **Call Option:** Gives the buyer the right (but not the obligation) to buy the underlying asset at a set strike price by (or on) the expiration.  
2. **Put Option:** Gives the buyer the right (but not the obligation) to sell the underlying asset at a set strike price by (or on) the expiration.

When you purchase (go long) an option, you pay a cost called the premium to the seller. When you sell (or short) an option, you receive the premium from the buyer.

#### Do You Need To Own (Buy) the Option Before You Short It?
Generally, no. You can open a short option position in the market without first buying it. In options terminology, we call this an "opening sale" transaction. You collect the premium from the buyer immediately.

However, when you open a short position, your broker will typically require sufficient margin or collateral in your account to cover potential losses. This is because short options have theoretically unlimited risk if you sold calls, or potentially large risk if you sold puts.

### Example: How Sellers of Option Make Money
When you short an option, you receive the premium up front. One basic strategy is to let the option expire worthless, allowing you (the seller) to keep the entire premium.

- Suppose a stock is trading at \$100.  
- You sell (short) a call option at a \$105 strike and receive \$2 per share as premium (an option usually represents 100 shares, so you'd collect \$200 total, ignoring commissions).  
  - If, at expiration, the stock is below \$105, the call buyer will not exercise the call (it would be cheaper to buy shares in the market below \$105). The option expires worthless, and you keep your \$200.  
  - If, at expiration, the stock is above \$105 (say \$110), you are obligated to deliver shares at \$105, even though the market price is \$110. You face a potential loss on the difference, though your net loss is offset by the \$2 premium you collected.

### Example: How Delta Neutral Hedge Make Money
- The current stock price is \$100, and the strike price of our option is also \$100 (at-the-money).  
- The call option's delta is about +0.525. We receive a premium of about \$3.50 per share.

1. We sell (write) one call option on a stock. We receive a premium of about \$3.50 per share.  
   Since we are short one call, our position has a delta of -0.525.  
2. To be delta-neutral, we need a long stock position with delta +0.525. Since each share of the stock has a delta of 1, we buy 0.525 shares for each call option we just sold.  
   At a price of \$100, this costs 0.525 * \$100 = \$52.50.

Let's look at two small moves: one where the stock price increases slightly, and one where it decreases slightly.

#### Stock Price Increases Slightly
Suppose the stock moves from \$100 to \$101.

1. **Call Option Effect**:  
   - The call is now slightly more in-the-money, so its price might rise from \$3.50 to about \$4.00.  
   - As a short call, you lose \$0.50 per share on this position.

2. **Stock Position Effect**:  
   - Your 0.525 shares are now worth 0.525 * \$101 = \$53.03 instead of \$52.50.  
   - That's a gain of about \$0.53.

3. **Net Result**:  
   - Option loss: -\$0.50  
   - Stock gain: +\$0.53  
   - Total gain: +\$0.03 per share

#### Stock Price Decreases Slightly
Now suppose the stock falls from \$100 to \$99.

1. **Call Option Effect**:  
   - The call option's price might drop from \$3.50 to about \$3.00.  
   - Since you are short the call, you gain \$0.50 per share.

2. **Stock Position Effect**:  
   - Your 0.525 shares are now worth 0.525 * \$99 = \$51.98 instead of \$52.50.  
   - That's a loss of about \$0.52 on your stock.

3. **Net Result**:  
   - Option gain: +\$0.50  
   - Stock loss: -\$0.52  
   - Total loss: -\$0.02 per share

*(Note: The exact numbers depend on how the option's delta changes and how quickly you rebalance. In a dynamic delta–hedging strategy, you would adjust your stock position as the delta changes. And remember, you originally collected \$3.50 per share premium when you sold the call.)*
