import { test, expect } from '@playwright/test';
async function drops(context, type, when) {
    const entries = [], resumes = [];
    let dropped = false, firstCredential;
    await context.routeWebSocket('**/socket', route => {
        const server = route.connectToServer();
        let severed = false, muted = false;
        function cut() { dropped = true; severed = true; route.close({ code: 4000, reason: 'QA initial-entry drop' }); server.close({ code: 4000, reason: 'QA initial-entry drop' }); }
        route.onMessage(raw => {
            const frame = JSON.parse(String(raw));
            if (frame.type === type) {
                entries.push(frame);
                if (when === 'before' && !dropped) {
                    cut();
                    return;
                }
            }
            if (frame.type === 'resume')
                resumes.push(frame);
            if (!severed)
                server.send(raw);
        });
        server.onMessage(raw => {
            if (severed)
                return;
            const frame = JSON.parse(String(raw));
            if (frame.type === 'credential' && !firstCredential)
                firstCredential = frame;
            if (!dropped && frame.type === 'credential' && when === 'silent') {
                dropped = true;
                muted = true;
            }
            if (muted && ['credential', 'state'].includes(frame.type))
                return;
            if (!dropped && frame.type === 'credential' && when === 'accepted') {
                cut();
                return;
            }
            if (!dropped && frame.type === 'state' && when === 'credential') {
                cut();
                return;
            }
            route.send(raw);
        });
    });
    return { entries, resumes, get credential() { return firstCredential; }, get dropped() { return dropped; } };
}
for (const when of ['before', 'accepted', 'credential', 'silent'])
    test(`guest entry survives drop ${when} credential delivery without a duplicate player`, async ({ browser }) => {
        const h = await browser.newContext(), g = await browser.newContext({ viewport: { width: 390, height: 844 } });
        try {
            const host = await h.newPage();
            await host.goto('/');
            await host.getByRole('button', { name: 'Create host screen', exact: true }).click();
            await expect(host.locator('#heading')).toContainText('lobby');
            const invite = await host.locator('#invite-link').inputValue(), fault = await drops(g, 'join', when), p = await g.newPage();
            await p.goto(invite);
            await p.getByLabel('Nickname', { exact: true }).fill('Retry guest');
            await p.getByRole('button', { name: 'Join party', exact: true }).click();
            await expect.poll(() => fault.dropped).toBe(true);
            await expect(p.locator('body')).toHaveClass(/phone-controller-active/, { timeout: 20000 });
            await expect(host.locator('#roster li')).toHaveCount(1);
            const saved = await p.evaluate(() => JSON.parse(sessionStorage.getItem('party-credential:/')));
            if (when !== 'before')
                expect(saved.actor).toBe(fault.credential.actor);
            if (when === 'credential') {
                expect(fault.entries).toHaveLength(1);
                expect(fault.resumes.length).toBeGreaterThan(0);
            }
            else {
                expect(fault.entries).toHaveLength(2);
                expect(fault.entries[1]).toEqual(fault.entries[0]);
            }
            await p.reload();
            await expect(p.locator('#status')).toHaveText('Reconnected.');
            await expect(host.locator('#roster li')).toHaveCount(1);
        }
        finally {
            await h.close();
            await g.close();
        }
    });
for (const when of ['before', 'accepted'])
    test(`host creation survives drop ${when} delivery with the same room`, async ({ browser }) => {
        const context = await browser.newContext();
        try {
            const fault = await drops(context, 'create', when), p = await context.newPage();
            await p.goto('/');
            await p.getByRole('button', { name: 'Create host screen', exact: true }).click();
            await expect.poll(() => fault.dropped).toBe(true);
            await expect(p.locator('#heading')).toContainText('lobby');
            expect(fault.entries).toHaveLength(2);
            expect(fault.entries[1]).toEqual(fault.entries[0]);
            const saved = await p.evaluate(() => JSON.parse(sessionStorage.getItem('party-credential:/')));
            if (when === 'accepted')
                expect(saved.code).toBe(fault.credential.code);
        }
        finally {
            await context.close();
        }
    });
test('invalid entry is actionable and a corrected nickname starts a fresh intent', async ({ browser }) => {
    const h = await browser.newContext(), g = await browser.newContext();
    try {
        const host = await h.newPage();
        await host.goto('/');
        await host.getByRole('button', { name: 'Create host screen', exact: true }).click();
        await expect(host.locator('#heading')).toContainText('lobby');
        const invite = await host.locator('#invite-link').inputValue();
        const taken = await h.newPage();
        await taken.goto(invite);
        await taken.getByLabel('Nickname', { exact: true }).fill('Taken');
        await taken.getByRole('button', { name: 'Join party', exact: true }).click();
        await expect(taken.locator('body')).toHaveClass(/phone-controller-active/);
        const fault = await drops(g, 'join', 'none'), p = await g.newPage();
        await p.goto(invite);
        await p.getByLabel('Nickname', { exact: true }).fill('Taken');
        await p.getByRole('button', { name: 'Join party', exact: true }).click();
        await expect(p.locator('#status')).toContainText(/nickname|control|invalid/i);
        await expect(p.getByRole('button', { name: 'Join party', exact: true })).toBeVisible();
        await p.getByLabel('Nickname', { exact: true }).fill('Corrected');
        await p.getByRole('button', { name: 'Join party', exact: true }).click();
        await expect(p.locator('body')).toHaveClass(/phone-controller-active/);
        expect(fault.entries).toHaveLength(2);
        expect(fault.entries[1].entryToken).not.toBe(fault.entries[0].entryToken);
    }
    finally {
        await h.close();
        await g.close();
    }
});
test('terminal rejection stops pending entry and a new click uses a fresh secret', async ({ browser }) => {
    const c = await browser.newContext();
    let terminal = false;
    const intents = [];
    try {
        await c.routeWebSocket('**/socket', route => {
            const server = route.connectToServer();
            route.onMessage(raw => { const m = JSON.parse(String(raw)); if (m.type === 'create') {
                intents.push(m);
                if (!terminal) {
                    terminal = true;
                    route.close({ code: 1008, reason: 'QA terminal rejection' });
                    server.close({ code: 1008, reason: 'QA terminal rejection' });
                    return;
                }
            } server.send(raw); });
        });
        const p = await c.newPage();
        await p.goto('/');
        await p.getByRole('button', { name: 'Create host screen', exact: true }).click();
        await expect(p.locator('#status')).toHaveText('QA terminal rejection');
        await p.waitForTimeout(1000);
        expect(intents).toHaveLength(1);
        await p.getByRole('button', { name: 'Create host screen', exact: true }).click();
        await expect(p.locator('#heading')).toContainText('lobby');
        expect(intents).toHaveLength(2);
        expect(intents[1].entryToken).not.toBe(intents[0].entryToken);
    }
    finally {
        await c.close();
    }
});
