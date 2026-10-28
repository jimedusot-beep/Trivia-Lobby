import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createPartyServer } from '../server.js';
import { validateHello } from '../protocol.js';
const secret = () => randomBytes(32).toString('base64url');
async function fixture(t) {
    const app = createPartyServer({ expectedOrigin: '' });
    await new Promise(r => app.server.listen(0, '127.0.0.1', r));
    t.after(() => app.close());
    const port = app.server.address().port;
    return { app, async open() {
            const ws = new WebSocket(`ws://127.0.0.1:${port}/socket`, { origin: `http://127.0.0.1:${port}` }), frames = [];
            let wake;
            ws.on('message', raw => { frames.push(JSON.parse(raw)); wake?.(); });
            await once(ws, 'open');
            return { ws, send: m => ws.send(JSON.stringify(m)), async take(type) { for (let n = 0; n < 100; n++) {
                    const i = frames.findIndex(m => m.type === type);
                    if (i >= 0)
                        return frames.splice(i, 1)[0];
                    await new Promise(r => { const timer = setTimeout(r, 20); wake = () => { clearTimeout(timer); r(); }; });
                } throw Error(`Missing ${type}`); } };
        } };
}
test('entry tokens are optional for old clients and strictly validated for new ones', () => {
    validateHello({ type: 'create' });
    validateHello({ type: 'join', code: 'ABC234', name: 'Guest' });
    for (const entryToken of ['', null, 42, 'A'.repeat(42), 'A'.repeat(44), '!'.repeat(43)])
        assert.throws(() => validateHello({ type: 'create', entryToken }), /entry retry/);
    assert.throws(() => validateHello({ type: 'resume', code: 'ABC234', actor: 'host', token: secret(), entryToken: secret() }), /Unknown/);
});
test('repeated create after a lost reply returns the same room and host credential', async (t) => {
    const f = await fixture(t), token = secret(), a = await f.open();
    a.send({ type: 'create', entryToken: token });
    const c = await a.take('credential');
    a.ws.terminate();
    const b = await f.open();
    b.send({ type: 'create', entryToken: token });
    assert.deepEqual(await b.take('credential'), c);
    const state = (await b.take('state')).state;
    assert.equal(f.app.rooms.size, 1);
    assert.equal(state.hostConnected, true);
    assert(!JSON.stringify(state).includes(token));
});
test('concurrent duplicate creates and joins keep one room and one player', async (t) => {
    const f = await fixture(t), token = secret(), hosts = await Promise.all([f.open(), f.open()]);
    for (const h of hosts)
        h.send({ type: 'create', entryToken: token });
    const creds = await Promise.all(hosts.map(h => h.take('credential')));
    assert.equal(creds[0].code, creds[1].code);
    assert.equal(f.app.rooms.size, 1);
    const players = await Promise.all([f.open(), f.open()]), entryToken = secret();
    for (const p of players)
        p.send({ type: 'join', code: creds[0].code, name: 'Same player', entryToken });
    const pc = await Promise.all(players.map(p => p.take('credential')));
    assert.equal(pc[0].actor, pc[1].actor);
    assert.equal(f.app.rooms.get(creds[0].code).party.players.size, 1);
});
test('replayed join resumes the same participant, never one selected by nickname', async (t) => {
    const f = await fixture(t), host = await f.open();
    host.send({ type: 'create' });
    const hc = await host.take('credential');
    const p = await f.open(), token = secret(), join = { type: 'join', code: hc.code, name: 'Guest', entryToken: token };
    p.send(join);
    const credential = await p.take('credential');
    p.ws.terminate();
    const again = await f.open();
    again.send(join);
    assert.deepEqual(await again.take('credential'), credential);
    assert.equal(f.app.rooms.get(hc.code).party.players.size, 1);
    const stranger = await f.open();
    stranger.send({ ...join, entryToken: secret() });
    assert.match((await stranger.take('error')).message, /name|nickname|taken|already/i);
    assert.equal(f.app.rooms.get(hc.code).party.players.size, 1);
    stranger.send({ type: 'join', code: hc.code, name: 'Different', entryToken: hc.token });
    assert.match((await stranger.take('error')).message, /Invalid player/);
});
test('colliding short PINs cannot authenticate with a different entry secret', async (t) => {
    // Synthetic fixtures collide only in their 30-bit route, not their credential hash.
    const [first, other] = ['gZXuQ7oJaPMudJZ3xXsb6yNqAsMeFmdbO4JaVZy8yyw', 'p1Lw_D_eX5Nq-C7JtzkKz-5aKezXfR-C9sGFL-uFT50'];
    const f = await fixture(t), host = await f.open();
    host.send({ type: 'create', entryToken: first });
    const hc = await host.take('credential');
    const stranger = await f.open();
    stranger.send({ type: 'create', entryToken: other });
    assert.match((await stranger.take('error')).message, /occupied/);
    assert.equal(f.app.rooms.size, 1);
    assert.equal(f.app.rooms.get(hc.code).party.hostConnected, true);
    const resumed = await f.open();
    resumed.send({ type: 'resume', code: hc.code, actor: 'host', token: hc.token });
    assert.equal((await resumed.take('ready')).actor, 'host');
});
