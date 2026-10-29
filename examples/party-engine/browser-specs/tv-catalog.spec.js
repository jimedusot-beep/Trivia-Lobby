import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';

test('TV library preserves all games, filters, searches, and keyboard launch', async ({ page }) => {
  await page.setViewportSize({width:1920,height:1080});
  await page.goto('/');
  await expect(page.locator('.pick-game-card')).toHaveCount(31);
  await page.getByRole('button',{name:'Racing & arcade',exact:true}).click();
  await expect(page.locator('.pick-game-card:visible')).toHaveCount(5);
  await page.getByRole('button',{name:'All games',exact:true}).click();
  await page.getByRole('searchbox',{name:'Find your next game'}).fill('Grand Prix');
  await expect(page.locator('.pick-game-card:visible')).toHaveCount(1);
  const preview = page.getByRole('button',{name:'Preview Party Grand Prix',exact:true});
  await preview.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.pick-spotlight-copy h3')).toHaveText('Party Grand Prix');
  const launch = page.locator('.pick-game-card:visible .pick-game-button');
  await launch.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#heading')).toContainText('lobby');
  await expect(page.locator('.lobby-invite-qr')).toBeVisible();
  await page.screenshot({path:'test-results/gx2-tv-lobby.png',fullPage:true});
});

for (const width of [320,1280,1920]) test(`catalog fits ${width}px and handles empty search with reduced motion`,async({page})=>{
  await page.setViewportSize({width,height:width===1920?1080:800});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await expect(page.locator('.pick-game-card')).toHaveCount(31);
  await page.locator('#pick-games').scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(()=>window.scrollTo(0,document.querySelector("#pick-games").offsetTop-20));
  await page.screenshot({path:`test-results/gx2-catalog-${width}.png`});
  await page.getByRole('searchbox').fill('zzzz-no-game');
  await expect(page.locator('.pick-game-empty')).toBeVisible();
  await expect(page.locator('.pick-game-spotlight')).toBeHidden();
  await page.getByRole('searchbox').fill('');
  await expect(page.locator('.pick-game-card:visible')).toHaveCount(31);
});

test('capture baseline at identical TV viewport',async({page})=>{
  for(const file of ['game-catalog.js','game-catalog.css','lobby-theme.css']) {
    const body=execFileSync('git',['show',`55414cd:examples/party-engine/public/${file}`],{encoding:'utf8'});
    await page.route(`**/${file}`,route=>route.fulfill({body,contentType:file.endsWith('js')?'text/javascript':'text/css'}));
  }
  await page.setViewportSize({width:1920,height:1080}); await page.goto('/');
  await expect(page.locator('.pick-game-card')).toHaveCount(31);
  await page.locator('#pick-games').scrollIntoViewIfNeeded();
  await page.evaluate(()=>window.scrollTo(0,document.querySelector('#pick-games').offsetTop-20));
  await page.screenshot({path:'test-results/gx2-catalog-before.png'});
});

test('every host and lobby catalog entry retains its existing launch ID',async({page})=>{
  await page.goto('/');
  const results=await page.evaluate(async()=>{
    const {mountGamePicker,guestGames}=await import('/game-catalog.js');
    const root=document.createElement('div');
    const output=[];
    for(const asHost of [false,true]) {
      const launched=[];
      mountGamePicker(root,{asHost,onHost:id=>launched.push(id),onChoose:id=>launched.push(id)});
      for(const button of root.querySelectorAll('.pick-game-button')) button.click();
      output.push({actual:launched,expected:guestGames.map(g=>g.id)});
    }
    return output;
  });
  for(const result of results) expect(result.actual).toEqual(result.expected);
});
