import mongoose from "mongoose";
import { SwapRouter, TokenContract } from "./function.js";
import chain from "./config.js";
import Web3 from "web3";

main().catch((err) => console.log(err));

async function main() {
  console.log("mongoose.connect()");
  await mongoose.connect("mongodb://127.0.0.1:27017/user");
}

const UserSchema = new mongoose.Schema({
  userName: String,
  firstName: String,
  emailAddress: String,
  walletAddress: {
    unique: true,
    type: String,
    required: true,
  },
});

const BlockDataSchema = new mongoose.Schema({
  blockNumber: Number,
  timestamp: Number,
  chainId: Number,
});
BlockDataSchema.index({ blockNumber: 1, chainId: 1 }, { unique: true });

const TransfersSchema = new mongoose.Schema({
  tokenAddress: String,
  chainId: Number,
  blockNumber: Number,
  transactionHash: String,
  from: String,
  to: String,
  value: mongoose.Schema.Types.Decimal128,
});

const LiquidityAddSchema = new mongoose.Schema({
  pairAddress: String,
  chainId: Number,
  blockNumber: Number,
  transactionHash: String,
  sender: String,
  amount0: mongoose.Schema.Types.Decimal128,
  amount1: mongoose.Schema.Types.Decimal128,
});

const LiquidityRemoveSchema = new mongoose.Schema({
  pairAddress: String,
  chainId: Number,
  blockNumber: Number,
  transactionHash: String,
  sender: String,
  amount0: mongoose.Schema.Types.Decimal128,
  amount1: mongoose.Schema.Types.Decimal128,
});

const SwapSchema = new mongoose.Schema({
  pairAddress: String,
  blockNumber: Number,
  transactionHash: String,
  sender: String,
  amount0In: mongoose.Schema.Types.Decimal128,
  amount1In: mongoose.Schema.Types.Decimal128,
  amount0Out: mongoose.Schema.Types.Decimal128,
  amount1Out: mongoose.Schema.Types.Decimal128,
  to: String,
  chainId: Number,
});

const reserveSchema = new mongoose.Schema({
  pairAddress: String,
  blockNumber: Number,
  transactionHash: String,
  chainId: Number,
  reserve0: mongoose.Schema.Types.Decimal128,
  reserve1: mongoose.Schema.Types.Decimal128,
  ethPrice: mongoose.Schema.Types.Decimal128,
});

export const TransferModal = mongoose.model("transfers", TransfersSchema);
export const LiquidityAddModal = mongoose.model(
  "liquidityaddeds",
  LiquidityAddSchema
);
export const LiquidityRemoveModal = mongoose.model(
  "liquidityremoveds",
  LiquidityRemoveSchema
);

export const SwapModal = mongoose.model("swaps", SwapSchema);
export const ReserveModal = mongoose.model("reserves", reserveSchema);
export const BlockDataModal = mongoose.model("blockdatas", BlockDataSchema);
export const UserModal = mongoose.model("users", UserSchema);

export async function updateUser(
  userName,
  firstName,
  emailAddress,
  walletAddress
) {
  const data = await UserModal.updateOne(
    {
      walletAddress,
    },
    {
      $set: {
        firstName,
        userName,
        emailAddress,
        walletAddress,
      },
    },
    {
      upsert: true,
    }
  )

  return data;
}

export async function getUser(walletAddress) {
  const data = await UserModal.findOne({walletAddress}).then(data => data? data: ({walletAddress, firstName: "first Name", userName: "username", emailAddress: "Email Address"}));
  return data;
}


export async function InsertBlockInfo(blockNumbers, chainId) {
  blockNumbers = await filterBlockExist(blockNumbers, chainId);
  const web3 = new Web3(chain[chainId].rpc);
  let batch = new web3.eth.BatchRequest();
  for (let i = 0; i < blockNumbers.length; i++) {
    let executed = false;
    batch.add(
      web3.eth.getBlock.request(blockNumbers[i], (error, data) => {
        if (error) {
          console.log(error.message);
        } else {
          if (!executed) {
            executed = true;
          }
          data = {
            blockNumber: data.number,
            timestamp: data.timestamp,
            chainId,
          };
          BlockDataModal.insertMany([data], { ordered: false }).catch(
            (err) => {}
          );
        }
      })
    );
    if (!(i % 1000)) {
      batch.execute();
      await new Promise(
        (r) => setInterval(() => (executed ? r(true) : "")),
        500
      );
      batch = new web3.eth.BatchRequest();
    }
  }
  batch.execute();
}

async function filterBlockExist(blockNumbers, chainId) {
  let data = await BlockDataModal.find({
    blockNumber: { $nin: blockNumbers },
    chainId: chainId,
  });
  data = data.map((value) => value.blockNumber);
  return blockNumbers.filter((value) => !data.includes(value));
}

async function insertToken(
  tokenAddress,
  chainId,
  addLiquidMax,
  removeLiquidMax,
  transferMax,
  swapMax,
  reserveMax
) {
  const router = new SwapRouter(chain[chainId].rpc, chain[chainId].router);
  const weth = await router.contract.methods.WETH().call();
  const factory = await router.getFactory();
  const pair = await factory.getPair(weth, tokenAddress);
  const token = new TokenContract(chain[chainId].rpc, tokenAddress);
  return await Promise.all([
    pair.getLiquidityAdded(addLiquidMax).then((result) => {
      const blockNumbers = result.map((value) => value.blockNumber);
      InsertBlockInfo(blockNumbers, chainId);
      return LiquidityAddModal.insertMany(result, { ordered: false });
    }),
    pair.getLiquidityRemoved(removeLiquidMax).then((result) => {
      const blockNumbers = result.map((value) => value.blockNumber);
      InsertBlockInfo(blockNumbers, chainId);
      return LiquidityRemoveModal.insertMany(result, { ordered: false });
    }),
    pair.getSwapEvents(swapMax).then((result) => {
      const blockNumbers = result.map((value) => value.blockNumber);
      InsertBlockInfo(blockNumbers, chainId);
      return SwapModal.insertMany(result, { ordered: false });
    }),
    pair.getSyncEvents(reserveMax).then((result) => {
      const blockNumber = result.map((value) => value.blockNumber);
      InsertBlockInfo(blockNumber, chainId);
      return ReserveModal.insertMany(result, { ordered: false });
    }),
    token.getTransferDetails(transferMax).then((result) => {
      const blockNumbers = result.map((value) => value.blockNumber);
      InsertBlockInfo(blockNumbers, chainId);
      return TransferModal.insertMany(result, { ordered: false });
    }),
  ]);
}

async function getContracts(tokenAddress, chainId) {
  const router = new SwapRouter(chain[chainId].rpc, chain[chainId].router);
  const weth = await router.contract.methods.WETH().call();
  const factory = await router.getFactory();
  const pair = await factory.getPair(weth, tokenAddress);
  const token = new TokenContract(chain[chainId].rpc, tokenAddress);
  return { router, factory, pair, token };
}

export const syncing = {};

export async function syncToken(tokenAddress, chainId) {
  syncing.tokenAddress = true;
  const pairAddress = (await getContracts(tokenAddress, chainId)).pair.contract
    .options.address;
  const [addLiquidMax, removeLiquidMax, transferMax, swapMax, reserveMax] = [
    await TransferModal.find({ tokenAddress, chainId })
      .sort({ blockNumber: -1 })
      .limit(1)
      .then((results) =>
        results[0] && results[0].blockNumber ? results[0].blockNumber : 1
      ),
    await LiquidityRemoveModal.find({ pairAddress, chainId })
      .sort({ blockNumber: -1 })
      .limit(1)
      .then((results) =>
        results[0] && results[0].blockNumber ? results[0].blockNumber : 1
      ),
    await TransferModal.find({ pairAddress, chainId })
      .sort({ blockNumber: -1 })
      .limit(1)
      .then((results) =>
        results[0] && results[0].blockNumber ? results[0].blockNumber : 1
      ),
    await SwapModal.find({ pairAddress, chainId })
      .sort({ blockNumbers: -1 })
      .limit(1)
      .then((results) =>
        results[0] && results[0].blockNumber ? results[0].blockNumber : 1
      ),
    await ReserveModal.find({ pairAddress, chainId })
      .sort({ blockNumber: -1 })
      .limit(1)
      .then((results) =>
        results[0] && results[0].blockNumber ? results[0].blockNumber : 1
      ),
  ];

  await insertToken(
    tokenAddress,
    chainId,
    addLiquidMax + 1,
    removeLiquidMax + 1,
    transferMax + 1,
    swapMax + 1,
    reserveMax + 1
  );
  syncing.tokenAddress = false;
}

export async function getTransferTransaction(tokenAddress, chainId, limit) {
  return await TransferModal.aggregate([
    { $match: { tokenAddress: tokenAddress, chainId: Number(chainId) } },
    {
      $lookup: {
        from: "blockdatas",
        let: { block: "$blockNumber", chain: "$chainId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$blockNumber", "$$block"] },
                  { $eq: ["$chainId", "$$chain"] },
                ],
              },
            },
          },
        ],
        as: "time",
      },
    },
  ])
    .sort({ blockNumber: -1 })
    .limit(limit)
    .catch((err) => console.log(err.message));
}

export async function getSwaps(tokenAddress, chainId, limit) {
  const pairAddress = (await getContracts(tokenAddress, chainId)).pair.contract
    .options.address;
  return await SwapModal.aggregate([
    { $match: { pairAddress: pairAddress, chainId: Number(chainId) } },
    {
      $lookup: {
        from: "blockdatas",
        let: { block: "$blockNumber", chain: "$chainId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$blockNumber", "$$block"] },
                  { $eq: ["$chainId", "$$chain"] },
                ],
              },
            },
          },
        ],
        as: "time",
      },
    },
  ])
    .sort({ blockNumber: -1 })
    .limit(limit)
    .catch((err) => console.log(err.message));
}

export async function getLiquidityAdded(tokenAddress, chainId, limit) {
  const pairAddress = (await getContracts(tokenAddress, chainId)).pair.contract
    .options.address;
  return await LiquidityAddModal.aggregate([
    { $match: { pairAddress: pairAddress, chainId: Number(chainId) } },
    {
      $lookup: {
        from: "blockdatas",
        let: { block: "$blockNumber", chain: "$chainId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$blockNumber", "$$block"] },
                  { $eq: ["$chainId", "$$chain"] },
                ],
              },
            },
          },
        ],
        as: "time",
      },
    },
  ])
    .sort({ blockNumber: -1 })
    .limit(limit)
    .catch((err) => console.log(err.message));
}

export async function getLiquidityRemoved(tokenAddress, chainId, limit) {
  const pairAddress = (await getContracts(tokenAddress, chainId)).pair.contract
    .options.address;
  return await LiquidityRemoveModal.aggregate([
    { $match: { pairAddress: pairAddress, chainId: Number(chainId) } },
    {
      $lookup: {
        from: "blockdatas",
        let: { block: "$blockNumber", chain: "$chainId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$blockNumber", "$$block"] },
                  { $eq: ["$chainId", "$$chain"] },
                ],
              },
            },
          },
        ],
        as: "time",
      },
    },
  ])
    .sort({ blockNumber: -1 })
    .limit(limit)
    .catch((err) => console.log(err.message));
}

export async function getReserves(tokenAddress, chainId, limit) {
  const pairAddress = (await getContracts(tokenAddress, chainId)).pair.contract
    .options.address;

  return await ReserveModal.aggregate([
    { $match: { pairAddress: pairAddress, chainId: Number(chainId) } },
    {
      $lookup: {
        from: "blockdatas",
        let: { block: "$blockNumber", chain: "$chainId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$blockNumber", "$$block"] },
                  { $eq: ["$chainId", "$$chain"] },
                ],
              },
            },
          },
        ],
        as: "time",
      },
    },
  ])
    .sort({ blockNumber: -1 })
    .limit(limit)
    .catch((err) => console.log(err.message));
}
