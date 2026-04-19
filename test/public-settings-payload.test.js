const test = require('node:test');
const assert = require('node:assert/strict');

const { publicSettingsPayload, heroPayload } = require('../api/_lib/publicSettingsPayload');

test('publicSettingsPayload keeps rsvpOpenGlobal true by default', () => {
  const p = publicSettingsPayload({});
  assert.equal(p.rsvpOpenGlobal, true);
});

test('publicSettingsPayload respects rsvpOpenGlobal false', () => {
  const p = publicSettingsPayload({ rsvpOpenGlobal: false });
  assert.equal(p.rsvpOpenGlobal, false);
});

test('publicSettingsPayload normalizes photos and party', () => {
  const p = publicSettingsPayload({});
  assert.deepEqual(p.photos, {});
  assert.deepEqual(p.party, []);
});

test('publicSettingsPayload passes through photos and party', () => {
  const p = publicSettingsPayload({
    photos: { hero: 'https://x.test/a.jpg' },
    party: [{ key: 'a', name: 'Ann' }],
  });
  assert.equal(p.photos.hero, 'https://x.test/a.jpg');
  assert.equal(p.party[0].name, 'Ann');
});

test('publicSettingsPayload siteContent is empty object when missing or invalid', () => {
  assert.deepEqual(publicSettingsPayload({}).siteContent, {});
  assert.deepEqual(publicSettingsPayload({ siteContent: null }).siteContent, {});
  assert.deepEqual(publicSettingsPayload({ siteContent: 'x' }).siteContent, {});
});

test('publicSettingsPayload passes through siteContent object', () => {
  const sc = { hero: { names: 'A & B' } };
  const p = publicSettingsPayload({ siteContent: sc });
  assert.deepEqual(p.siteContent, sc);
});

test('heroPayload returns minimal shape with sane defaults', () => {
  const p = heroPayload({});
  assert.equal(p.rsvpOpenGlobal, true);
  assert.deepEqual(p.hero, {});
  assert.equal(p.heroPhoto, null);
});

test('heroPayload respects rsvpOpenGlobal false', () => {
  const p = heroPayload({ rsvpOpenGlobal: false });
  assert.equal(p.rsvpOpenGlobal, false);
});

test('heroPayload extracts hero text and photo url', () => {
  const p = heroPayload({
    siteContent: { hero: { names: 'A & B', kicker: 'soon' }, howWeMet: { title: 'x' } },
    photos: { hero: 'https://x.test/h.jpg', other: 'https://x.test/o.jpg' },
  });
  assert.deepEqual(p.hero, { names: 'A & B', kicker: 'soon' });
  assert.equal(p.heroPhoto, 'https://x.test/h.jpg');
  assert.equal(p.howWeMet, undefined);
  assert.equal(p.photos, undefined);
});

test('heroPayload tolerates invalid siteContent', () => {
  assert.deepEqual(heroPayload({ siteContent: null }).hero, {});
  assert.deepEqual(heroPayload({ siteContent: 'x' }).hero, {});
  assert.deepEqual(heroPayload({ siteContent: { hero: null } }).hero, {});
});