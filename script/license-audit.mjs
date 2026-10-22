import {readFile,mkdir,writeFile} from "node:fs/promises";
const lock=JSON.parse(await readFile("package-lock.json","utf8"));
const allowed=new Set(["MIT","ISC","Apache-2.0","BSD-2-Clause","BSD-3-Clause","0BSD","BlueOak-1.0.0","CC0-1.0","Unlicense","Python-2.0"]);
const packages=[];
for(const [path,entry] of Object.entries(lock.packages??{})){
  if(!path)continue;
  let metadata={};try{metadata=JSON.parse(await readFile(path+"/package.json","utf8"));}catch{/* platform-specific optional package */}
  const license=typeof metadata.license==="string"?metadata.license:entry.license??"UNKNOWN";
  const candidates=license.replace(/[()]/g,"").split(/\s+(?:OR|AND)\s+/);
  const acceptable=candidates.every(x=>allowed.has(x)) || (license.includes(" OR ")&&candidates.some(x=>allowed.has(x)));
  packages.push({name:metadata.name??path.split("node_modules/").pop(),version:entry.version,license,development:!!entry.dev,
    repository:typeof metadata.repository==="string"?metadata.repository:metadata.repository?.url??null,integrity:entry.integrity??null,reviewRequired:!acceptable});
}
await mkdir("reports",{recursive:true});await writeFile("reports/dependency-licenses.json",JSON.stringify({lockfileVersion:lock.lockfileVersion,packages},null,2));
const review=packages.filter(x=>x.reviewRequired&&!x.development);
console.log(JSON.stringify({packages:packages.length,productionReviewRequired:review},null,2));
if(review.length)process.exitCode=1;
