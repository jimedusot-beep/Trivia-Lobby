export async function readBoundedJson(response:Response,maxBytes=128*1024):Promise<unknown> {
  if(!response.body)throw new Error("Provider returned no body");
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
      if(size>maxBytes){await reader.cancel();throw new Error("Provider response exceeds its limit");}chunks.push(value);}
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }finally{reader.releaseLock();}
}
