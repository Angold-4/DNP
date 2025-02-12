// deltaCalculator.js
const { jStat } = require("jstat");

/**
 * Calculate the Black–Scholes delta for a European call option.
 *
 * @param {number} S - Underlying asset price.
 * @param {number} K - Option strike price.
 * @param {number} T - Time to expiration in years.
 * @param {number} r - Risk-free interest rate (annualized, e.g., 0.01 for 1%).
 * @param {number} sigma - Volatility of the underlying asset (annualized).
 * @returns {number} Delta (a number between 0 and 1).
 */
function calculateOptionDelta(S, K, T, r, sigma) {
    // Calculate d1 using the Black–Scholes formula.
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    // For a call option, delta is the cumulative normal distribution of d1.
    return jStat.normal.cdf(d1, 0, 1);
}

module.exports = { calculateOptionDelta };
