import Web3 from "web3";
import { readFile } from "fs/promises";
import getPastEventsTree from "./getPastEvents.js";

const tokenAbi = JSON.parse(
  await readFile(new URL("../abi/tokenAbi.json", import.meta.url))
);
const pairAbi = JSON.parse(
  await readFile(new URL("../abi/PairAbi.json", import.meta.url))
);
const RouterAbi = JSON.parse(
  await readFile(new URL("../abi/RouterAbi.json", import.meta.url))
);
const factoryAbi = JSON.parse(
  await readFile(new URL("../abi/FactoryAbi.json", import.meta.url))
);

export class TokenContract {
  constructor(rpc, tokenContractAddress) {
    this.rpc = rpc;
    this.tokenContractAddress = tokenContractAddress;
    this.web3 = new Web3(rpc);
    this.contract = new this.web3.eth.Contract(tokenAbi, tokenContractAddress);
  }

  async getBlock() {
    return (await this.web3.eth.getBlock("latest")).number;
  }

  async getTransferDetails(fromBlock) {
    const blockNumber = await this.getBlock();
    const data = await getPastEventsTree(
      fromBlock ? fromBlock : 0,
      blockNumber,
      this.contract,
      "Transfer",
      {}
    );

    return data.map((value) => ({
      blockNumber: value.blockNumber,
      transactionHash: value.transactionHash,
      from: value.returnValues.from,
      to: value.returnValues.to,
      value: value.returnValues.value,
      tokenAddress: this.tokenContractAddress,
      chainId: 1,
    }));
  }

  async getInfo() {
    return {
      name: await this.contract.methods.name().call(),
      symbol: await this.contract.methods.symbol().call(),
      decimals: await this.contract.methods.decimals().call(),
      totalSupply: await this.contract.methods.totalSupply().call(),
    };
  }
}

export class SwapRouter {
  constructor(rpc, routerAddress) {
    this.rpc = rpc;
    this.web3 = new Web3(rpc);
    this.contract = new this.web3.eth.Contract(RouterAbi, routerAddress);
  }

  async getFactory() {
    const factoryAddress = await this.contract.methods.factory().call();
    return new Factory(this.rpc, factoryAddress);
  }
}

export class Factory {
  constructor(rpc, factoryAddress) {
    this.rpc = rpc;
    this.web3 = new Web3(rpc);
    this.contract = new this.web3.eth.Contract(factoryAbi, factoryAddress);
  }

  async getBlock() {
    return (await this.web3.eth.getBlock("latest")).number;
  }

  async getPair(token0, token1) {
    const pairAddress = await this.contract.methods
      .getPair(token0, token1)
      .call();
    return new Pair(this.rpc, pairAddress);
  }
}

export class Pair extends TokenContract {
  constructor(rpc, pairAddress) {
    super(rpc, pairAddress);
    this.rpc = rpc;
    this.web3 = new Web3(rpc);
    this.contract = new this.web3.eth.Contract(pairAbi, pairAddress);
  }

  async getSwapEvents(fromBlock) {
    const data = await getPastEventsTree(
      fromBlock ? fromBlock : 0,
      await this.getBlock(),
      this.contract,
      "Swap",
      {}
    );

    
    return data.map((value) => ({
      pairAddress: this.contract.options.address,
      blockNumber: value.blockNumber,
      transactionHash: value.transactionHash,
      sender: value.returnValues.sender,
      amount0In: value.returnValues.amount0In,
      amount1In: value.returnValues.amount1In,
      amount0Out: value.returnValues.amount0Out,
      amount1Out: value.returnValues.amount1Out,
      to: value.returnValues.to,
      chainId: 1
    }));
  }

  async getSyncEvents(fromBlock) {
    const data = await getPastEventsTree(
      fromBlock ? fromBlock : 0,
      await this.getBlock(),
      this.contract,
      "Sync",
      {}
    );

    const token0Address = await this.contract.methods.token0().call();
    const token1Address = await this.contract.methods.token1().call();
    
    const token0deciamls = await (new TokenContract(this.rpc, token0Address)).contract.methods.decimals().call();
    const token1deciamls = await (new TokenContract(this.rpc, token1Address)).contract.methods.decimals().call();
    
    
    return data.map((value) => ({
      pairAddress: this.contract.options.address,
      blockNumber: value.blockNumber,
      transactionHash: value.transactionHash,
      chainId: 1,
      reserve0: value.returnValues.reserve0,
      reserve1: value.returnValues.reserve1,
      ethPrice: (Number(value.returnValues.reserve0)/(10**token0deciamls))/((value.returnValues.reserve1)/(10**token1deciamls))
    }));
  }



  async getLiquidityAdded(fromBlock) {
    const data = await getPastEventsTree(
      fromBlock ? fromBlock : 0,
      await this.getBlock(),
      this.contract,
      "Mint",
      {}
    );
    return data.map((value) => ({
      pairAddress: this.tokenContractAddress,
      chainId: 1,
      blockNumber: value.blockNumber,
      transactionHash: value.transactionHash,
      sender: value.returnValues.sender,
      amount0: value.returnValues.amount0,
      amount1: value.returnValues.amount1,
    }));
  }

  async getLiquidityRemoved(fromBlock) {
    const data = await getPastEventsTree(
      fromBlock ? fromBlock : 0,
      await this.getBlock(),
      this.contract,
      "Burn",
      {}
    );
    console.log(data.length);
    return data.map((value) => ({
      pairAddress: this.tokenContractAddress,
      chainId: 1,
      blockNumber: value.blockNumber,
      transactionHash: value.transactionHash,
      sender: value.returnValues.sender,
      amount0: value.returnValues.amount0,
      amount1: value.returnValues.amount1,
      to: value.returnValues.to,
    }));
  }
}

