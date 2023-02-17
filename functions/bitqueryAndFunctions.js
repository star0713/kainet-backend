import dotenv from "dotenv";
import axios from "axios";
dotenv.config();

async function getBitqueryData(query, variables) {
  // var data = JSON.stringify({
  //   "query": "{ ethereum(network: bsc) { dexTrades( baseCurrency: {is: \"0x8918Bb91882CE41D9D9892246E4B56e4571a9fd5\"} date: {since: \"2022-06-10\"} quoteCurrency: {is: \"0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c\"} ) { timeInterval { minute(count: 5) } baseCurrency { symbol address } baseAmount quoteAmount trades: count quotePrice maximum_price: quotePrice(calculate: maximum) minimum_price: quotePrice(calculate: minimum) median_price: quotePrice(calculate: median) open_price: minimum(of: block, get: quote_price) close_price: maximum(of: block, get: quote_price) quoteCurrency { symbol address } date { date } any(of: time) block { height } } } }",
  //   "variables": "{}"
  // });
  var data = JSON.stringify({
    query,
    variables,
  });

  var config = {
    method: "post",
    url: "https://graphql.bitquery.io/",
    headers: {
      "Content-Type": "application/json",
    //  "X-API-KEY": process.env.bitQueryApiKey,
     "X-API-KEY" : "BQYedS7YfEFrtiYt9KOSezoT6ChtUReU",
    // "X-API-KEY" : "BQYzzsPJUwr9wEcePYEYsrdeou9C5Vvc",
    },
    data: data,
  };

  return await axios(config).then((response) => response.data);
}

export async function getPairCurrencies(chain, pair){
  const query = `{ ethereum(network: ${chain}) { dexTrades( smartContractAddress: {is: \"${pair}\"} options: {limit: 1} ) { exchange { fullName } baseCurrency { symbol address } quoteCurrency { symbol address } } } }`;
  const variables = "{}";
  return await getBitqueryData(query, variables);
}

/*
 * chain---> bsc, ethereum, polygon
 * baseCurrency---> address of the base Currency.
 * quoteCurrency ----> address of the quote Currency.
 * timeInterval -----> minutes
 * since ---> yyyy-mm-dd
 */
export async function getChartData(
  chain,
  pair,
  baseCurrency,
  quoteCurrency,
  intervalName,
  intervalCount,
  from,
  to
) {
  const query = `{ ethereum(network: ${chain}) { dexTrades( options: {asc: \"timeInterval.${intervalName}\"} date: {since: \"${from}\" till: \"${to}\"} smartContractAddress: {is: \"${pair}\"} baseCurrency: {is: \"${baseCurrency}\"} quoteCurrency: {is: \"${quoteCurrency}\"} ) { baseCurrency { symbol address name } timeInterval { ${intervalName}(count: ${intervalCount}, format: "%Y-%m-%dT%H:%M:%SZ") } volume: quoteAmount high: quotePrice(calculate: maximum) low: quotePrice(calculate: minimum) open: minimum(of: block, get: quote_price) close: maximum(of: block, get: quote_price) quoteCurrency { address name symbol } } } }`;
  const variables = "{}";
  return await getBitqueryData(query, variables);
}

export async function getTokenInfo(chain, address) {
 
  const query = `{ ethereum(network: ${chain}) { address(address: {is: \"${address}\"}) { balance smartContract { currency { decimals name symbol } } address } transfers( currency: {is: \"${address}\"} sender: {is: \"0x0000000000000000000000000000000000000000\"} ) { amount } } }`;
  const variables = "{}";
  return await getBitqueryData(query, variables);
}

export async function getDexTrades(chain, address) {
  const query = `{ ethereum(network: ${chain}) { dexTrades( baseCurrency: {is: \"${address}\"} options: {desc: \"block.height\", limit: 50} ) { block { height timestamp { unixtime } } transaction { hash } sellCurrency { symbol } buyCurrency { symbol } buyAmount sellAmount side tradeAmount(in: USD) any(of: price) } } }`;
  const variables = "{}";
  return await getBitqueryData(query, variables);
}

export async function getPairs(chain, address) {
  const query = `{ ethereum(network: ${chain}) { dexTrades( baseCurrency: {is: \"${address}\"} options: {desc: \"trades\"} ) { poolToken: smartContract { address { address } } exchange { fullName } pair: quoteCurrency { symbol } trades: count } } }`;
  const variables = "{}";
  return await getBitqueryData(query, variables);
}

export async function getNewListedPairs(chain) {
  const query = `{ ethereum(network: ${chain}) { arguments( smartContractEvent: {is: \"PairCreated\"} options: {desc: \"block.height\", limit: 6} ) { block { height } argument { name } reference { address } } } }`;
  const variables = "{}";
  return await getBitqueryData(query, variables);
}

export const getTopTrades = async (chain) =>
  getBitqueryData(
    `{ ethereum(network: ${chain}) { dexTrades( options: {desc: [\"tradeAmount\", \"trades\"], limit: 50} time: {since: \"2022-09-16T06:16:18.416Z\"} ) { token: smartContract { address { address } } exchange { fullName } trades: count tradeAmount(in: USD) any(of: price) baseCurrency { address symbol name } } } }`,
    "{}"
  );

export const getTokenBalances = async (chain, address) => getBitqueryData(
  `{\n  ethereum(network: ${chain}) {\n    address(address: {is: \"${address}\"}) {\n      balances {\n        value\n        currency {\n          address\n          symbol\n          tokenType\n          tokenId\n        }\n      }\n    }\n  }\n}\n`,
  "{}"
)

export const getTokenCreated = (chain, address) => getBitqueryData(
  `{\n  ethereum(network: ${chain}) {\n    transactions(txSender: {is: \"${address}\"}) {\n      creates {\n        smartContract {\n          currency {\n            name\n            symbol\n            tokenType\n          }\n          contractType\n        }\n        address\n      }\n    }\n  }\n}\n`,
  "{}"
)

export const getOwnershipTrasnferred = (chain, addresses) => getBitqueryData(
  `{\n  ethereum(network: ethereum) {\n    smartContractEvents(\n      smartContractAddress: {in: ${addresses}}\n      smartContractEvent: {is: \"OwnershipTransferred\"}\n    ) {\n      arguments {\n        argument\n        argumentType\n        index\n        value\n      }\n      smartContract {\n        address {\n          address\n        }\n      }\n    }\n  }\n}\n`,
  "{}"
)

export const getPriceVariation = (chain, addresses) => {
  const query = `{
    ethereum(network: ${chain}) {
      ${addresses.map((value, index) => `
        variation${index}: dexTrades(
          options: {asc: \"timeInterval.hour\"}
          baseCurrency: {is: \"${value.baseCurrency}\"}
          quoteCurrency: {is: \"${value.quoteCurrency}\"}
          time: {since: \"${new Date(new Date().getTime() - 86400000).toISOString()}\"}
        ) {
          quotePrice
          timeInterval {
            hour(count: 24)
          }
        }
      `).join("")}
    }
  }`
  return getBitqueryData(
    query,
    "{}"
  )

}

export const get24HourVolume = (chain, pair) => getBitqueryData(
  `{ ethereum(network: ${chain}) { dexTrades( date: {since: \"${new Date(new Date().getTime() - 86400000).toISOString()}\"} smartContractAddress: {is: \"${pair}\"} ) { tradeAmount(in: USDT, calculate: sum) } } }`,
  "{}"
)

export const getCirculatedSupply = (chain, currency) => getBitqueryData(
  `{ ethereum(network: ${chain}) { transfers(date: {}, amount: {gt: 0}) { burned: amount( calculate: sum receiver: {in: [\"0x0000000000000000000000000000000000000000\", \"0x000000000000000000000000000000000000dead\"]} ) minted: amount( calculate: sum sender: {in: [\"0x0000000000000000000000000000000000000000\"]} ) contractMints: amount( calculate: sum sender: {in: [\"0x0000000000000000000000000000000000000000\"]} ) currency(currency: {is: \"${currency}\"}) { symbol name decimals address } } } }`,
  "{}"
)

