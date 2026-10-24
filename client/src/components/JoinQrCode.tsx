import { useMemo } from "react";
import { qrcodegen } from "@/lib/vendor/qrcodegen";

/**
 * QR encoding stays in the browser. The URL is never sent to a third-party
 * QR API, and it deliberately contains only the public join code.
 */
export function JoinQrCode({url,code}:{url:string;code:string}) {
  const qr=useMemo(()=>{
    try {return qrcodegen.QrCode.encodeText(url,qrcodegen.QrCode.Ecc.MEDIUM);}
    catch {return null;}
  },[url]);
  const geometry=useMemo(()=>{
    if(!qr)return "";
    let path="";
    for(let y=0;y<qr.size;y++){
      for(let x=0;x<qr.size;x++){
        if(qr.getModule(x,y)) path+="M"+(x+4)+","+(y+4)+"h1v1h-1z";
      }
    }
    return path;
  },[qr]);
  if(!qr)return <p role="status">QR code unavailable. Use the invitation link or room code instead.</p>;
  const size=qr.size+8;
  return <div className="flex flex-col items-center gap-2">
    <svg role="img" aria-label={"Scan QR code to join room "+code} viewBox={"0 0 "+size+" "+size}
      className="w-52 h-52 sm:w-60 sm:h-60 rounded-xl border-4 border-white shadow-xl"
      shapeRendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
      <title>Scan QR code to join Trivia Lobby room {code}</title>
      <rect width={size} height={size} fill="white"/>
      <path d={geometry} fill="#101827"/>
    </svg>
    <p className="text-sm text-white/90">Scan with your phone to join · No account required</p>
  </div>;
}
