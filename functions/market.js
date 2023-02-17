import chain from "../config.js";
import { getReserves, getSwaps } from "./database.js";
import { TokenContract } from "./function.js";

export async function getChartData(tokenAddress, chainId, interval){
  const reserves = await getReserves(tokenAddress, chainId, 1000);
  let initialBlockTime = reserves[0].time[0].timestamp;
  let intervalArray = [];
  let innerArray = [];
  for(let i; i < reserves.length; i++){
    if(reserves[i].time[0].timestamp > initialBlockTime + interval){
      
    }
    else {
      innerArray.push(reserves[i]);
    }
  }
}
