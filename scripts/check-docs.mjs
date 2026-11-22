import {access,readFile,readdir} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {updatedGuide} from "./update-guide-index.mjs";
const root=fileURLToPath(new URL("../",import.meta.url));
const errors=[],texts=new Map();
function inside(relative){
  const absolute=path.resolve(root,relative),local=path.relative(root,absolute);
  if(local.startsWith(".."+path.sep)||local===".."||path.isAbsolute(local))throw new Error(`Path leaves repository: ${relative}`);
  return absolute;
}
async function exists(relative){try{await access(inside(relative));return true;}catch{return false;}}
async function text(relative){if(!texts.has(relative))texts.set(relative,await readFile(inside(relative),"utf8"));return texts.get(relative);}
function anchors(markdown){
  const result=new Set([...markdown.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]));
  const used=new Map();
  for(const m of markdown.matchAll(/^#{1,6}\s+(.+)$/gm)){
    const slug=m[1].replace(/\[([^\]]+)\]\([^)]+\)/g,"$1").replace(/<[^>]*>/g,"").toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu,"").trim().replace(/\s/g,"-");
    const count=used.get(slug)??0;used.set(slug,count+1);result.add(count?`${slug}-${count}`:slug);
  }
  return result;
}
const registry=JSON.parse(await text("docs/flows.json")),pkg=JSON.parse(await text("frontend/package.json"));
const lock=JSON.parse(await text("frontend/package-lock.json"));
const apiVersion=(await text("backend/Pitwall.Api/Pitwall.Api.csproj")).match(/<Version>([^<]+)<\/Version>/)?.[1];
if(lock.version!==pkg.version||lock.packages?.[""]?.version!==pkg.version)errors.push("Frontend package and lockfile versions differ.");
if(apiVersion!==pkg.version)errors.push(`API version ${apiVersion??"missing"} does not match frontend ${pkg.version}.`);
if(registry.schemaVersion!==1)errors.push("Unsupported flow registry schemaVersion.");
if(registry.productVersion!==pkg.version)errors.push(`Guide version ${registry.productVersion} does not match frontend ${pkg.version}. Review the guide and update registry metadata.`);
if(!/^\d{4}-\d{2}-\d{2}$/.test(registry.lastReviewed)||!Number.isFinite(Date.parse(registry.lastReviewed+"T00:00:00Z")))errors.push("Use an actual ISO guide review date.");
const guide=await text("docs/USER-GUIDE.md");
if(updatedGuide(guide,registry)!==guide)errors.push("Guide index/metadata is stale. Run node scripts/update-guide-index.mjs.");
const ids=new Set(),registeredSources=new Set(),chapterPaths=new Set(registry.chapters.map(c=>c.path));
const sections=new Map();
for(const chapter of registry.chapters){
  if(!await exists(chapter.path)){errors.push(`Missing guide chapter: ${chapter.path}`);continue;}
  const content=await text(chapter.path),matches=[...content.matchAll(/^## ([A-Z]+-\d{2}) — (.+)$/gm)];
  if(!matches.length)errors.push(`No flow sections in ${chapter.path}.`);
  for(let i=0;i<matches.length;i++){
    const m=matches[i],key=`${chapter.path}#${m[1]}`;
    if(sections.has(key))errors.push(`Duplicate flow heading: ${key}`);
    sections.set(key,{title:m[2].trim(),body:content.slice(m.index,matches[i+1]?.index??content.length)});
  }
}
for(const flow of registry.flows){
  if(!/^[A-Z]+-\d{2}$/.test(flow.id)||ids.has(flow.id))errors.push(`Invalid/duplicate flow ID: ${flow.id}`);ids.add(flow.id);
  if(!chapterPaths.has(flow.guide))errors.push(`${flow.id}: guide is not a registered chapter.`);
  const section=sections.get(`${flow.guide}#${flow.id}`);
  if(!section){errors.push(`${flow.id}: missing flow heading.`);continue;}
  if(section.title!==flow.title)errors.push(`${flow.id}: registry title differs from guide heading.`);
  if(!anchors(await text(flow.guide)).has(flow.anchor))errors.push(`${flow.id}: missing anchor ${flow.anchor}.`);
  for(const label of ["What","How","Result and storage","Recovery and limits"])if(!section.body.includes(`**${label}:**`))errors.push(`${flow.id}: missing ${label} section.`);
  if(!Array.isArray(flow.sources)||!flow.sources.length)errors.push(`${flow.id}: add implementation source paths.`);
  for(const source of flow.sources??[]){registeredSources.add(source);if(!await exists(source))errors.push(`${flow.id}: source path is missing: ${source}`);}
}
for(const key of sections.keys())if(!ids.has(key.split("#")[1]))errors.push(`Guide flow is not registered: ${key}`);
for(const item of registry.sharedComponents??[]){
  if(!item.reason||item.reason.trim().length<20)errors.push(`Explain shared UI component: ${item.path}`);
  if(!await exists(item.path))errors.push(`Missing shared UI component: ${item.path}`);
  registeredSources.add(item.path);
}
const uiFiles=(await readdir(inside("frontend/src"),{recursive:true})).map(p=>p.replaceAll("\\","/")).filter(p=>p.endsWith(".tsx")&&!/\.(test|spec)\.tsx$/.test(p));
for(const file of uiFiles)if(!registeredSources.has(`frontend/src/${file}`))errors.push(`Unclassified UI component frontend/src/${file}: add a flow source or explain it under sharedComponents.`);
const docFiles=["README.md","AGENTS.md","CONTRIBUTING.md",...(await readdir(inside("docs"),{recursive:true})).map(p=>`docs/${p.replaceAll("\\","/")}`).filter(p=>p.endsWith(".md"))];
let links=0;
for(const file of docFiles){
  const content=(await text(file)).replace(/```[\s\S]*?```/g,"").replace(/`[^`\n]*`/g,"");
  for(const m of content.matchAll(/!?\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+["'][^"']*["'])?\)/g)){
    let destination=m[1].replace(/^<|>$/g,"");if(/^[a-z][a-z\d+.-]*:/i.test(destination)||destination.startsWith("//"))continue;
    links++;
    try{
      const hash=destination.indexOf("#"),target=decodeURIComponent(hash<0?destination:destination.slice(0,hash)),anchor=hash<0?null:decodeURIComponent(destination.slice(hash+1));
      const relative=target?(target.startsWith("/")?target.slice(1):path.relative(root,path.resolve(path.dirname(inside(file)),target)).replaceAll("\\","/")):file;
      if(!await exists(relative)){errors.push(`${file}: broken local link ${destination}`);continue;}
      if(anchor&&relative.endsWith(".md")&&!anchors(await text(relative)).has(anchor))errors.push(`${file}: missing link anchor ${destination}`);
    }catch(error){errors.push(`${file}: invalid link ${destination} (${error.message})`);}
  }
}
if(errors.length){console.error("Guide checks failed:\n"+errors.map(e=>`- ${e}`).join("\n"));process.exitCode=1;}
else console.log(`PASS: ${registry.flows.length} guide flows, ${registry.chapters.length} chapters, ${uiFiles.length} classified UI components, ${links} local links; product ${registry.productVersion}.`);
