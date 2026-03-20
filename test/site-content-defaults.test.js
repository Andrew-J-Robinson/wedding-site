const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadSiteContentDefaults() {
  const file = path.join(__dirname, '../public/scripts/site-content-defaults.js');
  const code = fs.readFileSync(file, 'utf8');
  const ctx = vm.createContext({});
  vm.runInContext(code, ctx);
  return {
    mergeSiteContent: ctx.mergeSiteContent,
    DEFAULT_SITE_CONTENT: ctx.DEFAULT_SITE_CONTENT,
  };
}

test('mergeSiteContent returns full defaults for undefined / non-object', () => {
  const { mergeSiteContent, DEFAULT_SITE_CONTENT } = loadSiteContentDefaults();
  const a = mergeSiteContent(undefined);
  const b = mergeSiteContent(null);
  const c = mergeSiteContent('nope');
  assert.deepEqual(a, DEFAULT_SITE_CONTENT);
  assert.deepEqual(b, DEFAULT_SITE_CONTENT);
  assert.deepEqual(c, DEFAULT_SITE_CONTENT);
});

test('mergeSiteContent merges partial hero strings', () => {
  const { mergeSiteContent, DEFAULT_SITE_CONTENT } = loadSiteContentDefaults();
  const m = mergeSiteContent({ hero: { names: 'Alex & Blake' } });
  assert.equal(m.hero.names, 'Alex & Blake');
  assert.equal(m.hero.kicker, DEFAULT_SITE_CONTENT.hero.kicker);
});

test('mergeSiteContent replaces schedule.items when provided', () => {
  const { mergeSiteContent } = loadSiteContentDefaults();
  const items = [{ time: '1:00 PM', title: 'Only', detail: 'One item' }];
  const m = mergeSiteContent({ schedule: { items } });
  assert.deepEqual(m.schedule.items, items);
  assert.equal(m.schedule.eyebrow, 'Schedule');
});

test('mergeSiteContent keeps default schedule.items when saved schedule omits items', () => {
  const { mergeSiteContent, DEFAULT_SITE_CONTENT } = loadSiteContentDefaults();
  const m = mergeSiteContent({ schedule: { title: 'Custom title' } });
  assert.equal(m.schedule.title, 'Custom title');
  assert.deepEqual(m.schedule.items, DEFAULT_SITE_CONTENT.schedule.items);
});

test('mergeSiteContent replaces howWeMet.paragraphs array when provided', () => {
  const { mergeSiteContent } = loadSiteContentDefaults();
  const paragraphs = ['One paragraph only.'];
  const m = mergeSiteContent({ howWeMet: { paragraphs } });
  assert.deepEqual(m.howWeMet.paragraphs, paragraphs);
});

test('mergeSiteContent merges travel columns', () => {
  const { mergeSiteContent } = loadSiteContentDefaults();
  const columns = [
    [{ heading: 'Left', paragraphs: ['L1'] }],
    [{ heading: 'Right', paragraphs: ['R1', 'R2'] }],
  ];
  const m = mergeSiteContent({ travel: { columns } });
  assert.deepEqual(m.travel.columns, columns);
});

test('mergeSiteContent merges qa items including open flag', () => {
  const { mergeSiteContent } = loadSiteContentDefaults();
  const items = [{ question: 'Q?', answer: 'A.', open: true }];
  const m = mergeSiteContent({ qa: { items } });
  assert.deepEqual(m.qa.items, items);
});

test('DEFAULT_SITE_CONTENT has expected top-level sections', () => {
  const { DEFAULT_SITE_CONTENT } = loadSiteContentDefaults();
  assert.ok(DEFAULT_SITE_CONTENT.hero);
  assert.ok(DEFAULT_SITE_CONTENT.howWeMet);
  assert.ok(DEFAULT_SITE_CONTENT.schedule);
  assert.ok(DEFAULT_SITE_CONTENT.travel);
  assert.ok(DEFAULT_SITE_CONTENT.qa);
  assert.ok(DEFAULT_SITE_CONTENT.footnote);
  assert.ok(Array.isArray(DEFAULT_SITE_CONTENT.travel.columns));
  assert.equal(DEFAULT_SITE_CONTENT.travel.columns.length, 2);
});