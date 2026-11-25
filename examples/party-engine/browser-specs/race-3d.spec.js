import { test, expect } from '@playwright/test';
import { lobby } from './helpers/race-lobby.js';

test('3D host renders real WebGL karts; phones never download the 3D bundle', async ({browser,browserName}) => {
  const f=await lobby(browser);
  try {
    await f.start();
    if(browserName==='chromium') {
      await expect(f.host.locator('#race-track')).toHaveAttribute('data-renderer','3d',{timeout:15000});
      await expect(f.host.locator('#race-track')).toHaveAttribute('data-karts','2');
      const calls=Number(await f.host.locator('#race-track').getAttribute('data-draw-calls'));
      // Original two-player scene used 202 draw calls in the measured CI baseline.
      // Require a meaningful reduction without changing the race or phone client.
      expect(calls).toBeGreaterThan(0); expect(calls).toBeLessThan(160);
    } else {
      await expect(f.host.locator('.race-view-status')).not.toContainText('Loading');
      expect(['2d','3d']).toContain(await f.host.locator('#race-track').getAttribute('data-renderer'));
    }
    expect(f.requests[0].some(u=>u.endsWith('/race-3d.bundle.js'))).toBe(true);
    expect(f.requests.slice(1).flat().some(u=>u.endsWith('/race-3d.bundle.js'))).toBe(false);
    expect(f.errors).toEqual([]);
  } finally {await f.close();}
});

test('host switches between 3D and 2D without losing the room or controllers', async ({browser,browserName}) => {
  test.skip(browserName!=='chromium','Real WebGL switching is asserted in Chromium; fallback is exercised in every engine.');
  const f=await lobby(browser);
  try {
    await f.start();
    await expect(f.host.locator('#race-track')).toHaveAttribute('data-renderer','3d',{timeout:15000});
    const room=await f.host.locator('#heading').innerText();
    await f.host.getByRole('button',{name:'Use 2D view',exact:true}).click();
    await expect(f.host.locator('#race-track')).toHaveAttribute('data-renderer','2d');
    await expect(f.host.locator('.race-screen canvas:visible')).toHaveCount(1);
    await f.host.getByRole('button',{name:'Use 3D view',exact:true}).click();
    await expect(f.host.locator('#race-track')).toHaveAttribute('data-renderer','3d');
    await expect(f.host.locator('#heading')).toHaveText(room);
    await expect(f.players[0].locator('#race-own-number')).toHaveText('#1');
    await f.host.getByLabel('Race display', {exact:true}).selectOption('director');
    await expect(f.host.locator('#race-track')).toHaveAttribute('data-camera','director');
    await expect(f.host.locator('.race-minimap')).toBeVisible();
    if (process.env.RACE_SCREENSHOT_DIR) {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(process.env.RACE_SCREENSHOT_DIR,{recursive:true});
      await f.host.locator('.race-game').screenshot({path:process.env.RACE_SCREENSHOT_DIR+'/party-grand-prix-director.png'});
    }
    expect(f.errors).toEqual([]);
  } finally {await f.close();}
});

test('WebGL failure keeps the live 2D race and phone controls available', async ({browser}) => {
  const f=await lobby(browser,2,{width:390,height:844},()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'||type==='webgl' ? null : original.call(this,type,...args);};
  });
  try {
    await f.start();
    await expect(f.host.locator('.race-view-status')).toContainText('3D is unavailable');
    await expect(f.host.locator('#race-track')).toHaveAttribute('data-renderer','2d');
    await expect(f.host.getByRole('button',{name:'Use 3D view',exact:true})).toBeEnabled();
    await expect(f.players[0].locator('#race-own-place')).toContainText('/ 2');
    expect(f.errors).toEqual([]);
  } finally {await f.close();}
});

test('actual WebGL context loss falls back locally without reloading the party', async ({browser,browserName}) => {
  test.skip(browserName!=='chromium','WebGL loss extension is verified in Chromium.');
  const f=await lobby(browser);
  try {
    await f.start();
    await expect(f.host.locator('#race-track')).toHaveAttribute('data-renderer','3d',{timeout:15000});
    const room=await f.host.locator('#heading').innerText();
    const lost=await f.host.locator('#race-track').evaluate(c=>{const gl=c.getContext('webgl2');const ext=gl.getExtension('WEBGL_lose_context');if(!ext)return false;ext.loseContext();return true;});
    expect(lost).toBe(true);
    await expect(f.host.locator('#race-track')).toHaveAttribute('data-renderer','2d');
    await expect(f.host.locator('.race-view-status')).toContainText('Racing continues in 2D');
    await expect(f.host.locator('#heading')).toHaveText(room);
    expect(f.errors).toEqual([]);
  } finally {await f.close();}
});

test('context loss during 3D startup cannot replace the live 2D race', async ({browser,browserName}) => {
  test.skip(browserName!=='chromium','WebGL context-loss timing is verified in Chromium.');
  const f=await lobby(browser,2,undefined,()=>{
    const addEventListener=HTMLCanvasElement.prototype.addEventListener;
    HTMLCanvasElement.prototype.addEventListener=function(type,...args){
      const result=addEventListener.call(this,type,...args);
      if(type==='webglcontextlost') this.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));
      return result;
    };
  });
  try {
    await f.start();
    await expect(f.host.getByRole('button',{name:'Use 3D view',exact:true})).toBeEnabled();
    await f.host.waitForTimeout(300);
    await expect(f.host.locator('#race-track')).toHaveAttribute('data-renderer','2d');
    await expect(f.host.locator('.race-view-status')).toContainText('Racing continues in 2D');
    await expect(f.host.locator('.race-screen canvas:visible')).toHaveCount(1);
    await expect(f.players[0].locator('#race-own-number')).toHaveText('#1');
    expect(f.errors).toEqual([]);
  } finally {await f.close();}
});

test('remembered 2D choice avoids loading the 3D bundle at all', async ({browser}) => {
  const f=await lobby(browser,2,{width:390,height:844},()=>sessionStorage.setItem('party-race-view','2d'));
  try {
    await f.start();
    await expect(f.host.locator('#race-track')).toHaveAttribute('data-renderer','2d');
    await expect(f.host.getByRole('button',{name:'Use 3D view',exact:true})).toBeEnabled();
    expect(f.requests.flat().some(u=>u.endsWith('/race-3d.bundle.js'))).toBe(false);
    expect(f.errors).toEqual([]);
  } finally {await f.close();}
});

test('hidden hosts stop drawing; reduced motion uses the stable overview camera', async ({browser,browserName}) => {
  test.skip(browserName!=='chromium','GPU frame diagnostics verified in Chromium.');
  const f=await lobby(browser);
  try {
    await f.start();
    await expect(f.host.locator('#race-track')).toHaveAttribute('data-renderer','3d',{timeout:15000});
    await f.host.getByLabel('Race display',{exact:true}).selectOption('director');
    await expect(f.host.locator('#race-track')).toHaveAttribute('data-camera','director');
    await f.host.emulateMedia({reducedMotion:'reduce'});
    await expect(f.host.locator('#race-track')).toHaveAttribute('data-camera','overview');
    await expect(f.host.getByLabel('Race display',{exact:true})).toBeDisabled();
    const stopped=await f.host.evaluate(()=>{
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
      return document.getElementById('race-track').dataset.renderFrame;
    });
    await f.host.waitForTimeout(250);
    await expect(f.host.locator('#race-track')).toHaveAttribute('data-render-frame',stopped);
    await f.host.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>false}));
    await expect.poll(async()=>Number(await f.host.locator('#race-track').getAttribute('data-render-frame'))).toBeGreaterThan(Number(stopped));
    expect(f.errors).toEqual([]);
  } finally {await f.close();}
});

test('missing 3D bundle offers a working 2D race without automatic retry loops', async ({browser}) => {
  const f=await lobby(browser); let attempts=0;
  try {
    await f.host.route('**/race-3d.bundle.js',route=>{attempts++;return route.fulfill({status:404,body:'Unavailable'});});
    await f.start();
    await expect(f.host.locator('.race-view-status')).toContainText('3D is unavailable');
    await expect(f.host.locator('#race-track')).toHaveAttribute('data-renderer','2d');
    await expect(f.players[0].locator('#race-own-number')).toHaveText('#1');
    expect(attempts).toBe(1); expect(f.errors).toEqual([]);
  } finally {await f.close();}
});

test('a late 3D module cannot resurrect a scene after the host ends the heat', async ({browser}) => {
  const f=await lobby(browser); let release;
  try {
    await f.host.route('**/race-3d.bundle.js',async route=>{await new Promise(resolve=>{release=resolve;});await route.continue();});
    await f.start(); await expect.poll(()=>!!release).toBe(true);
    f.host.once('dialog',dialog=>dialog.accept());
    await f.host.getByRole('button',{name:'End this match',exact:true}).click();
    await expect(f.host.locator('#heading')).toContainText('finished');
    const loaded=f.host.waitForResponse(r=>r.url().endsWith('/race-3d.bundle.js'));
    release(); await loaded; await f.host.waitForLoadState('networkidle');
    await expect(f.host.locator('#race-track')).toHaveCount(0);
    await expect(f.host.locator('.race-view-controls')).toHaveCount(0);
    expect(f.errors).toEqual([]);
  } finally {release?.();await f.close();}
});

test('a terminal disconnect stops the race loop and controller input', async ({browser,browserName}) => {
  test.skip(browserName === 'firefox', 'Firefox CI runs without WebGL, so the 3D race loop is unavailable.');
  const f = await lobby(browser, 2, undefined, () => {
    window.__raceSockets = [];
    const Native = window.WebSocket;
    window.WebSocket = class extends Native {
      constructor(...args) { super(...args); window.__raceSockets.push(this); }
    };
  });
  try {
    await f.start();
    const canvas = f.host.locator('#race-track');
    await expect(canvas).toHaveAttribute('data-renderer','3d',{timeout:15000});
    const closeTerminal = page => page.evaluate(() => {
      const sockets = window.__raceSockets || [];
      sockets[sockets.length - 1]?.close(1000, 'QA terminal close');
      return sockets.length > 0;
    });
    expect(await closeTerminal(f.host)).toBe(true);
    expect(await closeTerminal(f.players[0])).toBe(true);
    await expect(f.host.locator('#status')).toHaveText('QA terminal close');
    await expect(f.players[0].locator('#status')).toHaveText('QA terminal close');
    await expect(canvas).toHaveCount(0);
    const sentAfterClose = f.sent[0].length;
    await f.players[0].waitForTimeout(400);
    expect(f.sent[0].length).toBe(sentAfterClose);
    expect(f.errors).toEqual([]);
  } finally {await f.close({ endMatch: false });}
});

test('a renderer setup failure releases the WebGL context and keeps 2D racing', async ({browser,browserName}) => {
  test.skip(browserName === 'firefox', 'Firefox CI has no WebGL context to release; verified in Chromium/WebKit.');
  const f = await lobby(browser, 2, undefined, () => {
    window.__raceLoseCalls = 0;
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(...args) {
      if (this.canvas.width === 1024 && this.canvas.height === 256)
        throw new Error('QA renderer setup failure');
      return fillText.apply(this, args);
    };
    for (const type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!type) continue;
      const getExtension = type.prototype.getExtension;
      type.prototype.getExtension = function(name) {
        if (name === 'WEBGL_lose_context') window.__raceLoseCalls++;
        return getExtension.call(this, name);
      };
    }
  });
  try {
    await f.start();
    const canvas = f.host.locator('#race-track');
    await expect(canvas).toHaveAttribute('data-renderer', '2d');
    await expect(f.host.locator('.race-view-status')).toContainText('3D is unavailable');
    expect(await f.host.evaluate(() => window.__raceLoseCalls)).toBeGreaterThan(0);
    await expect(f.host.locator('.race-screen canvas:visible')).toHaveCount(1);
    await expect(f.players[0].locator('#race-own-number')).toHaveText('#1');
    expect(f.errors).toEqual([]);
  } finally {await f.close();}
});
