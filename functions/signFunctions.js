import { verifyMessage } from "ethers/lib/utils.js";


export function verifyMessages(signature, message){
  const account =  verifyMessage(message, signature);
  console.log(account);
  return account;
}