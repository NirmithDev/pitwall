import {newTrack, validateTrack, type CustomTrack, type Point} from "./custom-track";
const distance = (a: Point,b: Point) => Math.hypot(a[0]-b[0],a[1]-b[1]);
function segmentDistance(p: Point,a: Point,b: Point) {
  const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)):0;
  return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);
}
function simplify(points: Point[], tolerance: number): Point[] {
  if(points.length<=2)return points;
  let farthest=0,index=0;
  for(let i=1;i<points.length-1;i++){
    const d=segmentDistance(points[i],points[0],points.at(-1)!);
    if(d>farthest){farthest=d;index=i;}
  }
  return farthest>tolerance
    ? [...simplify(points.slice(0,index+1),tolerance).slice(0,-1),...simplify(points.slice(index),tolerance)]
    : [points[0],points.at(-1)!];
}
export function circuitFromReplay(outline: Point[], label: string): CustomTrack {
  if(outline.length<6||outline.length>5000||outline.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n))))
    throw new Error("This replay needs a finite circuit outline of 6–5,000 points before it can become a sandbox track.");
  const xs=outline.map(p=>p[0]),ys=outline.map(p=>p[1]);
  const minX=Math.min(...xs),minY=Math.min(...ys),width=Math.max(...xs)-minX,height=Math.max(...ys)-minY;
  if(width<1||height<1)throw new Error("This replay's outline has no usable enclosed circuit.");
  const scale=Math.min(680/width,400/height);
  const normalized=outline.map(p=>[Math.round((p[0]-minX)*scale+(800-width*scale)/2),Math.round((p[1]-minY)*scale+(520-height*scale)/2)] as Point);
  if(distance(normalized[0],normalized.at(-1)!)<1)normalized.pop();
  let split=1;
  for(let i=2;i<normalized.length;i++)if(distance(normalized[0],normalized[i])>distance(normalized[0],normalized[split]))split=i;
  const template={...newTrack(),name:label.trim().slice(0,48)||"Replay circuit",cornerRadius:0};
  for(const tolerance of [0,.5,1,2,3,4,6,8]){
    const simplified=tolerance===0?normalized:[...simplify(normalized.slice(0,split+1),tolerance).slice(0,-1),...simplify([...normalized.slice(split),normalized[0]],tolerance).slice(0,-1)];
    const points: Point[]=[];
    for(const p of simplified)if(!points.length||distance(points.at(-1)!,p)>=8)points.push(p);
    if(points.length>1&&distance(points.at(-1)!,points[0])<8)points.pop();
    const track={...template,points,sectorEnds:[Math.floor(points.length/3),Math.floor(points.length*2/3)] as [number,number]};
    if(points.length>=6 && points.length<=120 && !validateTrack(track).length)return track;
  }
  throw new Error("This outline cannot form a valid sandbox circuit without more editing. Copy/edit an outline or choose another replay.");
}
