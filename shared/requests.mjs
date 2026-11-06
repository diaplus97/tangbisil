import {GameError} from './errors.mjs';

export function objectInput(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new GameError('요청 형식을 확인해 주세요.',400);
  return value;
}
export function actionInput(value){
  const input=objectInput(value);
  if(typeof input.type!=='string'||!/^[a-z][a-z-]{0,39}$/.test(input.type))throw new GameError('행동을 다시 확인해 주세요.',400);
  // Contact packets use their own gesture/sequence validator and have no receipt.
  if(input.type!=='sand-contact'&&(typeof input.requestId!=='string'||!/^[\w-]{8,80}$/.test(input.requestId)))throw new GameError('요청 번호를 확인해 주세요.',400);
  for(const field of ['servingId','offerId','itemId','gestureId','sessionId'])if(input[field]!==undefined&&(typeof input[field]!=='string'||input[field].length<1||input[field].length>80))throw new GameError('대상의 번호를 확인해 주세요.',400);
  return input;
}
