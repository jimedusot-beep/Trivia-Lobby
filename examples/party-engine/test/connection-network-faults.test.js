import test from "node:test";
import assert from "node:assert/strict";
import { createRecoveringConnection } from "../public/connection-recovery.js";

// In-process, deterministic fault injector. No network or production endpoints.
function harness() {
  let now=0, next=0, visible=true;
  const timers=new Map(), sockets=[], statuses=[], received=[], opens=[], closes=[];
  const setTimer=(fn,ms)=>{const id=++next;timers.set(id,{at:now+ms,fn});return id;};
  const clearTimer=id=>timers.delete(id);
  function advance(ms) {
    const end=now+ms;
    for(let n=0;n<1000;n++) {
      const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];
      if(!due){now=end;return;}
      timers.delete(due[0]);now=due[1].at;due[1].fn();
    }
    throw new Error("Infinite fault-clock timer loop");
  }
  const lifecycle=new EventTarget(),visibility=new EventTarget();
  const connection=createRecoveringConnection("ws://127.0.0.1:1/socket",{
    createSocket(address){
      assert.equal(address,"ws://127.0.0.1:1/socket");
      const ws={readyState:0,sent:[],
        open(){this.readyState=1;this.onopen?.({});},
        send(raw){this.sent.push(JSON.parse(raw));},
        receive(value){this.onmessage?.({data:JSON.stringify(value)});},
        close(code=1006,reason=""){if(this.readyState===3)return;this.readyState=3;this.onclose?.({code,reason});}
      };
      sockets.push(ws);return ws;
    },
    onOpen:ws=>opens.push(ws),
    onClose:(event,retry)=>closes.push({code:event.code,retry}),
    onMessage:event=>received.push(JSON.parse(event.data)),
    onStatus:status=>statuses.push(status),
    setTimer,clearTimer,random:()=>0.5,lifecycle,visibility,isVisible:()=>visible
  });
  return {advance,sockets,statuses,received,opens,closes,connection,lifecycle,visibility,
    setVisible(value){visible=value;},
    get pendingTimers(){return timers.size;}
  };
}

test("opening timeout retries after 500 ms and ignores old-socket events",()=>{
  const h=harness(),old=h.sockets[0];
  h.advance(9999);assert.equal(h.sockets.length,1);
  h.advance(1);assert.equal(old.readyState,3);
  assert.deepEqual(h.closes,[{code:4000,retry:true}]);
  h.advance(499);assert.equal(h.sockets.length,1);
  h.advance(1);assert.equal(h.sockets.length,2);
  old.open();old.receive({type:"state",revision:999});
  assert.equal(h.opens.length,0);assert.equal(h.received.length,0);
  h.sockets[1].open();h.connection.ready();
  assert.equal(h.statuses.at(-1),"connected");h.connection.stop();
});

test("missing heartbeat pong closes a stalled socket and valid pong allows recovery",()=>{
  const h=harness(),first=h.sockets[0];
  first.open();h.connection.ready();
  assert.deepEqual(first.sent,[{type:"ping"}]);
  h.advance(9999);assert.equal(first.readyState,1);
  h.advance(1);assert.equal(first.readyState,3);
  assert.deepEqual(h.closes[0],{code:4000,retry:true});
  h.advance(500);const second=h.sockets[1];
  second.open();second.receive({type:"pong",serverNow:1234});
  h.connection.ready();h.advance(10000);
  assert.equal(second.readyState,1);h.connection.stop();
});

test("late state after close is ignored and policy failures never retry",()=>{
  const h=harness(),first=h.sockets[0];
  first.open();h.connection.ready();
  first.receive({type:"state",revision:1});
  first.close(1006,"lost connection");
  first.receive({type:"state",revision:999});
  h.advance(500);const fresh=h.sockets[1];fresh.open();
  fresh.receive({type:"state",revision:2});h.connection.ready();
  assert.deepEqual(h.received.map(x=>x.revision),[1,2]);
  fresh.close(1008,"policy rejected");
  h.advance(60000);assert.equal(h.sockets.length,2);
  assert.equal(h.statuses.at(-1),"closed");
  assert.deepEqual(h.closes.map(x=>x.retry),[true,false]);h.connection.stop();
});

test("hidden pages ignore online refresh but visible ones reconnect",()=>{
  const h=harness(),original=h.sockets[0];
  original.open();h.connection.ready();
  h.setVisible(false);h.lifecycle.dispatchEvent(new Event("online"));
  assert.equal(original.readyState,1);
  h.setVisible(true);h.visibility.dispatchEvent(new Event("visibilitychange"));
  assert.equal(original.readyState,3);
  h.advance(500);assert.equal(h.sockets.length,2);
  h.sockets[1].open();h.connection.ready();h.connection.stop();
});

test("stopping cancels all retries and prevents later online reconnects",()=>{
  const h=harness();
  h.sockets[0].close();h.advance(500);h.sockets[1].close();
  h.connection.stop();assert.equal(h.pendingTimers,0);
  h.advance(60000);h.lifecycle.dispatchEvent(new Event("online"));
  assert.equal(h.sockets.length,2);
});
