import {test,expect} from '@playwright/test';
import {lobby} from './helpers/race-lobby.js';
import {mkdir} from 'node:fs/promises';
async function sensor(page,beta,gamma){await page.evaluate(({beta,gamma})=>{const event=new Event('deviceorientation');Object.assign(event,{beta,gamma});window.dispatchEvent(event);},{beta,gamma});}
async function lean(page,beta,gamma){for(let i=0;i<5;i++){await sensor(page,beta,gamma);await page.waitForTimeout(40);}}
function mock(permission='granted'){
 return `window.DeviceOrientationEvent=class {static requestPermission(){window.motionRequests=(window.motionRequests||0)+1;return Promise.resolve('${permission}')}};Object.defineProperty(screen,'orientation',{configurable:true,value:{angle:0}});`;
}
async function fixture(browser,permission='granted'){
 const f=await lobby(browser,2,{width:320,height:568});for(const p of f.players){await p.addInitScript({content:mock(permission)});await p.reload();}await f.start();return f;
}
const last=f=>f.sent[0].filter(m=>m.type==='race_input').at(-1);
test('tilt permission, analog steering, center, drift/item and touch fallback stay in one screen',async({browser})=>{
 const f=await fixture(browser);try{const p=f.players[0];expect(await p.evaluate(()=>window.motionRequests||0)).toBe(0);
 await p.getByRole('button',{name:'Tilt steering',exact:true}).click();await lean(p,60,0);
 await lean(p,60,30);await expect.poll(()=>last(f)?.steer).toBeGreaterThan(0.1);expect(last(f).steer).toBeLessThanOrEqual(1);
 await p.getByRole('button',{name:'Hold drift, release for boost',exact:true}).dispatchEvent('pointerdown',{pointerId:3,pointerType:'touch',buttons:1});await expect.poll(()=>last(f)?.drift).toBe(true);await p.getByRole('button',{name:'Hold drift, release for boost',exact:true}).dispatchEvent('pointerup',{pointerId:3,pointerType:'touch'});
 await p.getByRole('button',{name:'Use racing item',exact:true}).click();await expect.poll(()=>f.sent[0].some(m=>m.type==='race_input'&&m.item)).toBe(true);
 await p.getByRole('button',{name:'Center',exact:true}).click();await lean(p,60,30);await expect.poll(()=>last(f)?.steer).toBe(0);await lean(p,60,-20);await expect.poll(()=>last(f)?.steer).toBeLessThan(-0.1);
 for(const size of [{width:320,height:480},{width:568,height:320},{width:844,height:390}]){await p.setViewportSize(size);expect(await p.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);for(const name of ['Center','Touch','Hold drift, release for boost','Use racing item']){const b=await p.getByRole('button',{name,exact:true}).boundingBox();expect(b.height).toBeGreaterThanOrEqual(44);expect(b.y+b.height).toBeLessThanOrEqual(size.height+1);}}
 if(process.env.RACE_SCREENSHOT_DIR){await mkdir(process.env.RACE_SCREENSHOT_DIR,{recursive:true});await p.screenshot({path:process.env.RACE_SCREENSHOT_DIR+'/tilt-controller-landscape.png'});await p.setViewportSize({width:320,height:568});await p.screenshot({path:process.env.RACE_SCREENSHOT_DIR+'/tilt-controller-portrait.png'});}
 await p.getByRole('button',{name:'Touch',exact:true}).click();await expect(p.getByRole('button',{name:'Steer left',exact:true})).toBeVisible();await lean(p,60,30);await expect.poll(()=>last(f)?.steer).toBe(0);expect(await p.evaluate(()=>motionRequests)).toBe(1);expect(f.errors).toEqual([]);
 }finally{await f.close();}
});
test('stale data, dialogs, blur and screen rotation neutralize tilt until a fresh center',async({browser})=>{
 const f=await fixture(browser);try{const p=f.players[0];await p.getByRole('button',{name:'Tilt steering',exact:true}).click();await lean(p,60,0);await lean(p,60,30);await expect.poll(()=>last(f)?.steer).toBeGreaterThan(.1);
 await expect.poll(()=>last(f)?.steer,{timeout:2000}).toBe(0);
 await lean(p,60,0);await lean(p,60,30);await p.getByRole('button',{name:'Options',exact:true}).click();await lean(p,60,-30);await expect.poll(()=>last(f)?.steer).toBe(0);await p.getByRole('button',{name:'Back to game',exact:true}).click();await sensor(p,60,-30);await expect.poll(()=>last(f)?.steer).toBe(0);
 await p.evaluate(()=>{screen.orientation.angle=90;});await expect.poll(()=>last(f)?.steer).toBe(0);await sensor(p,0,-60);await lean(p,20,-60);await expect.poll(()=>last(f)?.steer).toBeGreaterThan(.1);
 await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await lean(p,30,-60);await expect.poll(()=>last(f)?.steer).toBe(0);await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await sensor(p,30,-60);await expect.poll(()=>last(f)?.steer).toBe(0);expect(f.errors).toEqual([]);
 }finally{await f.close();}
});
test('denied access keeps touch controls; missing readings time out without fake steering',async({browser})=>{
 const f=await fixture(browser,'denied');try{const p=f.players[0];await p.getByRole('button',{name:'Tilt steering',exact:true}).click();await expect(p.locator('.race-tilt-enable')).toContainText('Motion denied');await expect(p.getByRole('button',{name:'Steer left',exact:true})).toBeVisible();
 await p.evaluate(()=>{window.DeviceOrientationEvent.requestPermission=()=>Promise.resolve('granted');});await p.locator('.race-tilt-enable').click();await sensor(p,null,null);await expect(p.locator('.race-tilt-enable')).toContainText('No motion data',{timeout:5000});await expect.poll(()=>last(f)?.steer).toBe(0);await p.evaluate(()=>{window.DeviceOrientationEvent=undefined;});await p.locator('.race-tilt-enable').click();await expect(p.locator('.race-tilt-enable')).toContainText('Tilt unavailable');expect(f.errors).toEqual([]);
 }finally{await f.close();}
});
test('permission completing after a heat ends cannot recreate tilt controls',async({browser})=>{
 const f=await fixture(browser);try{const p=f.players[0];await p.evaluate(()=>{window.DeviceOrientationEvent.requestPermission=()=>new Promise(resolve=>{window.finishMotion=resolve;});});await p.getByRole('button',{name:'Tilt steering',exact:true}).click();f.host.once('dialog',d=>d.accept());await f.host.getByRole('button',{name:'End this match',exact:true}).click();await expect(p.locator('.race-controls')).toHaveCount(0);await p.evaluate(()=>finishMotion('granted'));await sensor(p,60,20);await expect(p.locator('.race-controls')).toHaveCount(0);expect(f.errors).toEqual([]);
 }finally{await f.close();}
});
