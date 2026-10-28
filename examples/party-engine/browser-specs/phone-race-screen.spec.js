import {test,expect} from '@playwright/test';
import {lobby} from './helpers/race-lobby.js';
import {mkdir} from 'node:fs/promises';
async function fits(page,locator){
 const box=await locator.boundingBox();const size=page.viewportSize();expect(box).not.toBeNull();
 expect(box.x).toBeGreaterThanOrEqual(-1);expect(box.y).toBeGreaterThanOrEqual(-1);
 expect(box.x+box.width).toBeLessThanOrEqual(size.width+1);expect(box.y+box.height).toBeLessThanOrEqual(size.height+1);
}
async function noScroll(page){
 expect(await page.evaluate(()=>({x:document.documentElement.scrollWidth>innerWidth+1,y:document.documentElement.scrollHeight>innerHeight+1}))).toEqual({x:false,y:false});
 await page.evaluate(()=>window.scrollTo(0,500));expect(await page.evaluate(()=>scrollY)).toBe(0);
}
test('phone racer stays in one viewport through rotation, options and reload',async({browser})=>{
 const f=await lobby(browser,2,{width:320,height:480});try{
 await f.start();const p=f.players[0];
 for(const [width,height] of [[320,480],[320,568],[390,664],[430,932],[568,320],[844,390]]){
  await p.setViewportSize({width,height});await noScroll(p);
  for(const label of ['Steer left','Steer right','Hold drift, release for boost','Use racing item']){
   const button=p.getByRole('button',{name:label,exact:true});await fits(p,button);const box=await button.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await fits(p,p.locator('#race-own-place'));await fits(p,p.locator('#status'));await fits(p,p.locator('#race-own-item'));
  await p.getByLabel('Controller options',{exact:true}).click();await fits(p,p.locator('.race-options-panel'));await fits(p,p.getByRole('button',{name:'Leave party',exact:true}));await noScroll(p);
  await p.getByLabel('Controller options',{exact:true}).click();
 }
 await p.setViewportSize({width:320,height:568});await p.getByLabel('Controller options',{exact:true}).click();await p.getByLabel('Steering assistance',{exact:true}).uncheck();await expect.poll(()=>f.sent[0].filter(m=>m.type==='race_input').at(-1)?.assist).toBe(false);await p.getByLabel('Controller options',{exact:true}).click();
 await p.reload();await expect(p.locator('#race-own-number')).toHaveText('#1');await noScroll(p);await p.getByLabel('Controller options',{exact:true}).click();await expect(p.getByLabel('Steering assistance',{exact:true})).not.toBeChecked();await p.getByLabel('Controller options',{exact:true}).click();
 await p.keyboard.down('KeyA');await p.getByLabel('Controller options',{exact:true}).click();await expect.poll(()=>f.sent[0].filter(m=>m.type==='race_input').at(-1)?.steer).toBe(0);await p.keyboard.up('KeyA');await p.getByLabel('Controller options',{exact:true}).click();
 if(process.env.RACE_SCREENSHOT_DIR){await mkdir(process.env.RACE_SCREENSHOT_DIR,{recursive:true});await p.screenshot({path:process.env.RACE_SCREENSHOT_DIR+'/phone-one-screen-portrait.png'});await p.setViewportSize({width:844,height:390});await p.screenshot({path:process.env.RACE_SCREENSHOT_DIR+'/phone-one-screen-landscape.png'});}
 expect(f.errors).toEqual([]);
 }finally{await f.close();}
});
test('phone results fit one screen and the party layout returns after the race',async({browser})=>{
 test.setTimeout(100000);
 const f=await lobby(browser,3,{width:320,height:480});try{
 await f.start();await expect(f.host.getByRole('heading',{name:'Heat 1 results',exact:true})).toBeVisible({timeout:70000});
 const p=f.players[0];await expect(p.locator('.race-result-list li')).toHaveCount(1);await noScroll(p);await fits(p,p.getByRole('button',{name:'Leave party',exact:true}));
 await expect(f.host.locator('.race-result-list li')).toHaveCount(3);
 await f.host.getByRole('button',{name:'Next',exact:true}).click();await expect(f.host.locator('.race-heat')).toHaveText('HEAT 2 / 3',{timeout:12000});f.host.once('dialog',d=>d.accept());await f.host.getByRole('button',{name:'End this match',exact:true}).click();await expect(p.locator('#heading')).toContainText('finished');await noScroll(p);
 await f.host.getByRole('button',{name:'Return to same party',exact:true}).click();await expect(p.locator('#heading')).toContainText('lobby');await expect(p.locator('body')).not.toHaveClass(/race-phone-results|race-controller-active/);await expect(p.locator('#leave')).toBeVisible();expect(f.errors).toEqual([]);
 }finally{await f.close();}
});
