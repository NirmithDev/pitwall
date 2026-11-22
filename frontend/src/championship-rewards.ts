import {championshipKey,championshipPoints,parseChampionship,type Championship} from "./championship";
import {announceTeam,maximumCredits,maximumRewardClaims,parseTeam,rewardBaseCredits,rewardCreditsPerPoint,teamKey,type RewardReceipt,type Team} from "./recruitment";

export function roundReward(c:Championship,round:number) {
  if(!Number.isInteger(round)||round<0||round>2)throw new Error("Choose a valid championship round.");
  const result=c.results[round];
  if(!result||result.round!==round)throw new Error("Finish and save this round before claiming its reward.");
  const teamPoints=result.classification.reduce((total,r,i)=>total+(c.ownDriverIds.includes(r.driverId)?championshipPoints[i]:0),0);
  return {teamPoints,amount:rewardBaseCredits+teamPoints*rewardCreditsPerPoint};
}
export function readRewardTeam():{team:Team|null;error:string} {
  try {
    const raw=localStorage.getItem(teamKey);
    return raw===null?{team:null,error:"No saved recruiting team is available. Open Driver recruitment first."}:{team:parseTeam(JSON.parse(raw)),error:""};
  }catch{return {team:null,error:"The recruiting account could not be read. Recover it in Driver recruitment before claiming rewards."};}
}
export async function claimRoundReward(championshipId:string,round:number):Promise<{team:Team;receipt:RewardReceipt;alreadyClaimed:boolean}> {
  if(typeof navigator==="undefined"||!navigator.locks)throw new Error("Reward claims require browser Web Locks support to coordinate tabs safely.");
  if(!championshipId||championshipId.length>80||!Number.isInteger(round)||round<0||round>2)throw new Error("Choose a valid championship reward.");
  // Lock order is always team → championship. The balance and receipt use one atomic record write.
  return navigator.locks.request(teamKey,()=>navigator.locks.request(championshipKey,()=>{
    const teamRaw=localStorage.getItem(teamKey);
    if(teamRaw===null)throw new Error("No saved recruiting team is available.");
    const team=parseTeam(JSON.parse(teamRaw));
    const previous=team.rewardClaims.find(r=>r.championshipId===championshipId&&r.round===round);
    if(previous)return {team,receipt:previous,alreadyClaimed:true};
    const cupRaw=localStorage.getItem(championshipKey);
    if(cupRaw===null)throw new Error("The saved championship is no longer available.");
    const cup=parseChampionship(JSON.parse(cupRaw));
    if(cup.id!==championshipId)throw new Error("The saved championship changed. Load it again before claiming.");
    if(!cup.rewardTeamId)throw new Error("Link this older cup to its original recruiting team before claiming rewards.");
    if(cup.rewardTeamId!==team.id)throw new Error("This championship belongs to a different recruiting team. Start a new cup for this team.");
    const payout=roundReward(cup,round);
    if(team.rewardClaims.length>=maximumRewardClaims)throw new Error("The 1,000-receipt history limit has been reached. No credits or receipts were changed.");
    if(team.credits+payout.amount>maximumCredits)throw new Error("Spend some credits before claiming; the balance cap is 1,000,000.");
    const receipt:RewardReceipt={version:1,championshipId:cup.id,championshipName:cup.name,venueLabel:cup.venues[round].label,round,...payout,claimedAt:new Date().toISOString()};
    const saved=parseTeam({...team,revision:team.revision+1,credits:team.credits+payout.amount,rewardClaims:[...team.rewardClaims,receipt]});
    localStorage.setItem(teamKey,JSON.stringify(saved));
    announceTeam();
    return {team:saved,receipt,alreadyClaimed:false};
  }));
}
