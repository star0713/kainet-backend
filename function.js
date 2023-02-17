import { SwapRouter } from "./functions/function.js";

async function callIt() {
  // const { TokenContract } = await import("./functions/function.mjs");
  // const myToken = new TokenContract(
  //   "https://mainnet.infura.io/v3/e26a969141a34ca784a0ed9e5c2a1811",
  //   "0xC1bfcCd4c29813eDe019D00D2179Eea838a67703"
  // );
  // console.log((await myToken.getTransferDetails()).length);

  const router = new SwapRouter(
    "https://mainnet.infura.io/v3/e26a969141a34ca784a0ed9e5c2a1811",
    "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
  );
  const factory = await router.getFactory();
  const pair = await factory.getPair(
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "0xC1bfcCd4c29813eDe019D00D2179Eea838a67703"
  );
  console.log(await pair.getSwapEvents());
}
callIt();
