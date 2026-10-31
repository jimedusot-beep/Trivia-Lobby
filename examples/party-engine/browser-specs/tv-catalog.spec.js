import { test, expect } from '@playwright/test';

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


test('empty catalog reset restores every game and Escape keeps the chosen category', async ({ page }) => {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Find your next game' });
  const racing = page.getByRole('button', { name: 'Racing & arcade', exact: true });
  await racing.click();
  await search.fill('no matching game');
  await expect(page.locator('.pick-game-card:visible')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show all games', exact: true }).click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  await expect(page.locator('.pick-game-card:visible')).toHaveCount(31);
  await expect(page.getByRole('button', { name: 'All games', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await racing.click();
  await search.fill('no matching game');
  await search.press('Escape');
  await expect(search).toHaveValue('');
  await expect(racing).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.pick-game-card:visible')).toHaveCount(5);
  await expect(page.locator('.pick-game-spotlight')).toBeVisible();
});

test('long mobile catalog capture stays at CSS resolution on high-density screens', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 850 }, deviceScaleFactor: 2 });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('.pick-game-card')).toHaveCount(31);
    await page.evaluate(() => document.fonts.ready);
    const image = await page.screenshot({ fullPage: true, scale: 'css', animations: 'disabled' });
    // PNG IHDR width/height are CSS pixels, even on a 2x display.
    expect(image.readUInt32BE(16)).toBe(390);
    expect(image.readUInt32BE(20)).toBeLessThan(32767);
  } finally { await context.close(); }
});

test('lower-card Preview brings its rules into view and moves keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const preview = page.locator('.pick-game-preview-button').last();
  const name = (await preview.getAttribute('aria-label')).replace('Preview ', '');
  await preview.click();
  const heading = page.locator('.pick-spotlight-copy h3');
  await expect(heading).toHaveText(name);
  await expect(heading).toBeFocused();
  await expect(page.locator('.pick-game-spotlight')).toBeInViewport();
  await page.screenshot({ path: 'test-results/tv-preview-visible.png' });
  await page.keyboard.press('Tab');
  await expect(page.locator('.pick-spotlight-button').first()).toBeFocused();
});

test('TV lobby width and invitation styling exclude controllers and active play', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create host screen', exact: true }).click();
  await expect(page.locator('#mode')).toBeVisible();
  await expect(page.locator('main')).toHaveCSS('max-width', '1560px');
  // Engines quantize fractional font sizes differently (Firefox reports 33.625px).
  // Keep a tight 0.05px bound so the 20px controller style cannot pass here.
  await expect.poll(async () => Math.abs(await page.locator('.lobby-invite-card strong')
    .evaluate(node => parseFloat(getComputedStyle(node).fontSize)) - 33.6)).toBeLessThan(0.05);
  await page.screenshot({ path: 'test-results/tv-lobby-wide.png' });
  for (const controller of ['phone-controller-active', 'race-controller-active']) {
    await page.evaluate(c => document.body.classList.add(c), controller);
    await expect(page.locator('main')).toHaveCSS('max-width', '1050px');
    await expect(page.locator('.lobby-invite-card strong')).toHaveCSS('font-size', '20px');
    await page.evaluate(c => document.body.classList.remove(c), controller);
  }
  await page.evaluate(() => { document.body.dataset.partyPhase = 'question'; });
  await expect(page.locator('main')).toHaveCSS('max-width', '1050px');
  await expect(page.locator('.lobby-invite-card strong')).toHaveCSS('font-size', '20px');
});


test('console cover shelf scrolls horizontally and supports left-right keyboard selection', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const shelf = page.getByRole('region', { name: 'Horizontal game cover shelf' });
  await expect(shelf).toHaveCSS('display', 'flex');
  await expect(page.locator('.pick-game-art')).toHaveCount(31);
  expect(await shelf.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
  await expect(page.locator('.pick-shelf-position')).toHaveText('1 / 31');
  await expect(page.getByRole('button', { name: 'Previous game' })).toBeDisabled();

  await page.getByRole('button', { name: 'Next game' }).click();
  await expect(page.locator('.pick-spotlight-copy h3')).toHaveText('Prompt Duel');
  await expect(page.locator('.pick-shelf-position')).toHaveText('2 / 31');
  await expect(page.getByRole('button', { name: 'Preview Prompt Duel' })).toHaveAttribute('aria-pressed', 'true');

  await shelf.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.pick-spotlight-copy h3')).toHaveText('Charades');
  await expect(page.getByRole('button', { name: 'Preview Charades' })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.pick-spotlight-copy h3')).toHaveText('Prompt Duel');
  await expect(page.getByRole('button', { name: 'Preview Prompt Duel' })).toBeFocused();

  await page.getByRole('button', { name: 'Racing & arcade', exact: true }).click();
  await expect(page.locator('.pick-game-card:visible')).toHaveCount(5);
  await expect(page.locator('.pick-shelf-position')).toHaveText('1 / 5');
  await expect(page.locator('.pick-spotlight-copy h3')).toHaveText('Turbo Circuit');
  await page.getByRole('searchbox', { name: 'Find your next game' }).fill('Grand Prix');
  await expect(page.locator('.pick-shelf-position')).toHaveText('1 / 1');
  await expect(page.locator('.pick-spotlight-copy h3')).toHaveText('Party Grand Prix');
  await expect(page.getByRole('button', { name: 'Next game' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Previous game' })).toBeDisabled();
  // The original host callback still launches the exact selected game.
  await page.locator('.pick-spotlight-button').first().click();
  await expect(page.locator('#heading')).toContainText('lobby');
});

test('mobile console shelf keeps poster artwork in view without page-width scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  const covers = page.locator('.pick-game-art');
  await expect(covers).toHaveCount(31);
  await expect(covers.first().locator('.pick-poster-title')).toHaveText('Trivia Quiz');
  await expect(page.getByRole('button', { name: 'Next game' })).toBeVisible();
  await page.getByRole('button', { name: 'Next game' }).click();
  await expect(page.locator('.pick-spotlight-copy h3')).toHaveText('Prompt Duel');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.pick-game-shelf').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/switch-cover-shelf-mobile.png', animations: 'disabled' });
});


// Keep the guest entry point executable: a cover-shelf initialization exception
// can strand the page at "Connecting…" even if game data and WebSocket code work.
test('game cover shelf initializes without JavaScript errors for guest and host pickers', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText('Connected.');
  await expect(page.locator('.pick-game-card')).toHaveCount(31);
  await expect(page.getByRole('button', { name: 'Next game' })).toBeEnabled();
  const hostErrors = await page.evaluate(async () => {
    const { mountGamePicker } = await import('/game-catalog.js');
    const container = document.createElement('div');
    mountGamePicker(container, { asHost: true, selected: 'race', onChoose: () => {} });
    return { count: container.querySelectorAll('.pick-game-card').length,
      highlighted: container.querySelector('.pick-game-spotlight h3')?.textContent };
  });
  expect(hostErrors).toEqual({ count: 31, highlighted: 'Party Grand Prix' });
  expect(errors).toEqual([]);
});
