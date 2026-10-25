export type GameMode="classic"|"teams"|"buzzer"|"wager"|"workshop"|"party"|"odd_one_out";
export const UPGRADE_COST={focus:60,guard:40} as const;
/** Original virtual classroom rules. Game points never change study mastery or review schedules. */
export function scoreRound(input:{mode:GameMode;correct:boolean;streak:number;score:number;wager:number;focus:number;guard:number;round:number;pointsFactor?:number}){
 const {mode,correct,streak,score,focus,guard,round}=input;
 if(mode==="odd_one_out")return {awarded:correct?1:0,streak:0,coins:0,focus,guard};
 const wager=mode==="wager"?input.wager:0;
 if(!Number.isInteger(wager)||wager<0||wager>Math.min(score,100))throw new Error("Wager exceeds available points (maximum 100)");
 const bonus=mode==="workshop"&&focus>0?50:0;
 const multiplier=mode==="party"&&round%3===2?2:1;
 return {awarded:correct?(100+streak*10+bonus)*multiplier*(input.pointsFactor??1)+wager:-wager,
  streak:correct?streak+1:mode==="workshop"&&guard>0?streak:0,
  coins:correct?20:0,focus:mode==="workshop"&&correct?Math.max(0,focus-1):focus,
  guard:mode==="workshop"&&!correct?Math.max(0,guard-1):guard};
}
