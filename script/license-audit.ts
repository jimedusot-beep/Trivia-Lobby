import { readFile, writeFile } from "node:fs/promises";
const lock=JSON.parse(await readFile("package-lock.json","utf8"));
const entries=[];
for(const [path,pkg] of Object.entries<any>(lock.packages)){
 if(!path||pkg.dev)continue;
 let metadata:any={};try{metadata=JSON.parse(await readFile(path+"/package.json","utf8"));}catch{}
 const license=metadata.license??pkg.license??"UNKNOWN";
 entries.push({name:metadata.name??path.split("node_modules/").pop(),version:pkg.version,license,integrity:pkg.integrity??null,
  reviewRequired:typeof license!=="string"||/UNKNOWN|AGPL|GPL|UNLICENSED|SEE LICENSE/i.test(license)});
}
entries.sort((a,b)=>String(a.name).localeCompare(String(b.name)));
await writeFile("docs/DEPENDENCY_LICENSES.json",JSON.stringify({scope:"Installed production npm dependencies; review actual license files before redistribution",packages:entries},null,2)+"\n");
console.log(JSON.stringify({packages:entries.length,reviewRequired:entries.filter(e=>e.reviewRequired).map(e=>({name:e.name,license:e.license}))}));
