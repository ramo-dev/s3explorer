// Round-trip and edge-case checks for the URL location format. Not shipped.
import { parseLocationUrl, buildLocationUrl } from '../src/hooks/useLocationUrl';

// Every location literal below is compared against a full parse, so they all
// need the filters field. Named so the intent is obvious at each use.
const NONE = { type: 'all', modified: { from: null, to: null }, size: 'all' } as const;

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures++;
    console.log(`  FAIL ${label}\n       got      ${a}\n       expected ${e}`);
  } else {
    console.log(`  ok   ${label}`);
  }
};

console.log('\n-- round trip: location -> URL -> location --');
const locations = [
  { bucket: null, path: '', view: null, search: '', filters: NONE },
  { bucket: 'my-bucket', path: '', view: null, search: '', filters: NONE },
  { bucket: 'my-bucket', path: 'photos/', view: null, search: '', filters: NONE },
  { bucket: 'my-bucket', path: 'photos/2024/trip/', view: 'grid', search: '', filters: NONE },
  { bucket: 'my-bucket', path: 'a/b/c/d/e/', view: null, search: 'report', filters: NONE },
  { bucket: 'my-bucket', path: '', view: 'grid', search: 'invoice 2024', filters: NONE },
  // Keys that break naive encoding.
  { bucket: 'my-bucket', path: 'my photos/', view: null, search: '', filters: NONE },
  { bucket: 'my-bucket', path: 'a#b/', view: null, search: '', filters: NONE },
  { bucket: 'my-bucket', path: 'a?b=c/', view: null, search: '', filters: NONE },
  { bucket: 'my-bucket', path: '100%/done/', view: null, search: '', filters: NONE },
  { bucket: 'my-bucket', path: 'a+b/', view: null, search: '', filters: NONE },
  { bucket: 'my-bucket', path: 'café/naïve/', view: null, search: '', filters: NONE },
  { bucket: 'my-bucket', path: 'emoji 🎉/', view: null, search: '', filters: NONE },
  { bucket: 'my-bucket', path: 'semi;colon/and&amp/', view: null, search: '', filters: NONE },
  { bucket: 'bucket.with.dots', path: 'k/', view: null, search: '', filters: NONE },
  { bucket: 'UPPER-Case_123', path: '', view: null, search: '', filters: NONE },
];
for (const loc of locations) {
  const url = buildLocationUrl(loc);
  const back = parseLocationUrl(`http://x${url}`);
  check(`${url}`, back, loc);
}

console.log('\n-- path shape --');
check('root', buildLocationUrl({ bucket: null, path: 'a/b/', view: null, search: '', filters: NONE }), '/');
check('bucket root has no trailing slash', buildLocationUrl({ bucket: 'bkt', path: '', view: null, search: '', filters: NONE }), '/b/bkt');
check('default view is omitted', buildLocationUrl({ bucket: 'bkt', path: '', view: 'list', search: '', filters: NONE }), '/b/bkt');
check('grid is written', buildLocationUrl({ bucket: 'bkt', path: '', view: 'grid', search: '', filters: NONE }), '/b/bkt?view=grid');

console.log('\n-- non-location URLs fall back to root --');
for (const href of ['http://x/', 'http://x/login', 'http://x/b', 'http://x/b/', 'http://x/BOGUS/thing', 'http://x/index.html']) {
  check(href, parseLocationUrl(href), { bucket: null, path: '', view: null, search: '', filters: NONE });
}

console.log('\n-- tolerant of a trailing slash the user typed --');
check(
  '/b/bkt/photos/ == /b/bkt/photos',
  parseLocationUrl('http://x/b/bkt/photos/').path,
  parseLocationUrl('http://x/b/bkt/photos').path,
);

console.log('\n-- view is tri-state, and "list" is deliberately not written --');
// null means "unspecified": the reader's own stored preference applies. Only
// grid is written, so a link from a list-mode sender does not override a
// grid-mode recipient. The cost is that a link cannot force list view --
// accepted, because the common case is a sender who never touched the toggle.
check('list is omitted as the default', buildLocationUrl({ bucket: 'b', path: '', view: 'list', search: '', filters: NONE }), '/b/b');
check('omitted parses back as unspecified', parseLocationUrl('http://x/b/b').view, null);
check('grid is written', buildLocationUrl({ bucket: 'b', path: '', view: 'grid', search: '', filters: NONE }), '/b/b?view=grid');

console.log('\n-- unknown view values are ignored, not trusted --');
check('view=grid', parseLocationUrl('http://x/b/bkt?view=grid').view, 'grid');
check('view=list', parseLocationUrl('http://x/b/bkt?view=list').view, 'list');
check('view=bogus', parseLocationUrl('http://x/b/bkt?view=bogus').view, null);

console.log('\n-- query param survives a key containing ? and # --');
const tricky = { bucket: 'bkt', path: 'a#b/', view: null, search: 'what? #1', filters: NONE };
check('tricky round trip', parseLocationUrl(`http://x${buildLocationUrl(tricky)}`), tricky);

console.log('\n-- filters round trip, and only non-defaults are written --');
check('all defaults stay off the URL', buildLocationUrl({ bucket: 'b', path: '', view: null, search: '', filters: NONE }), '/b/b');
check(
  'type only',
  buildLocationUrl({ bucket: 'b', path: '', view: null, search: '', filters: { ...NONE, type: 'image' } }),
  '/b/b?type=image',
);
check(
  'size only',
  buildLocationUrl({ bucket: 'b', path: '', view: null, search: '', filters: { ...NONE, size: '10to100mb' } }),
  '/b/b?size=10to100mb',
);
check(
  'open-ended date range',
  buildLocationUrl({ bucket: 'b', path: '', view: null, search: '', filters: { ...NONE, modified: { from: '2024-03-01', to: null } } }),
  '/b/b?from=2024-03-01',
);
check(
  'closed date range',
  buildLocationUrl({ bucket: 'b', path: '', view: null, search: '', filters: { ...NONE, modified: { from: '2024-03-01', to: '2024-03-20' } } }),
  '/b/b?from=2024-03-01&to=2024-03-20',
);
check(
  'filters compose with view and search',
  buildLocationUrl({
    bucket: 'b', path: 'p/', view: 'grid', search: 'q',
    filters: { type: 'video', modified: { from: '2024-01-01', to: '2024-12-31' }, size: 'gt100mb' },
  }),
  '/b/b/p?view=grid&q=q&type=video&from=2024-01-01&to=2024-12-31&size=gt100mb',
);
for (const f of [
  { type: 'image', modified: { from: '2024-03-01', to: null }, size: 'all' },
  { type: 'all', modified: { from: null, to: '2024-03-20' }, size: 'lt1mb' },
  { type: 'code', modified: { from: '2024-03-01', to: '2024-03-20' }, size: 'gt100mb' },
] as const) {
  const loc = { bucket: 'b', path: '', view: null, search: '', filters: f };
  check(`filters round trip ${f.type}/${f.size}`, parseLocationUrl(`http://x${buildLocationUrl(loc)}`), loc);
}

console.log('\n-- bad filter params degrade to "no filter" rather than hiding everything --');
// A stale or hand-edited link must not resolve to a filter that excludes the
// whole bucket. Unknown enum values and impossible dates are dropped, not trusted.
check('unknown type ignored', parseLocationUrl('http://x/b/bkt?type=bogus').filters, NONE);
check('unknown size ignored', parseLocationUrl('http://x/b/bkt?size=huge').filters, NONE);
check('garbage date ignored', parseLocationUrl('http://x/b/bkt?from=notadate').filters, NONE);
check('overflow date ignored', parseLocationUrl('http://x/b/bkt?from=2024-02-31').filters, NONE);
check('partial range kept', parseLocationUrl('http://x/b/bkt?from=2024-02-29').filters.modified, { from: '2024-02-29', to: null });
check('leap day is a real date', parseLocationUrl('http://x/b/bkt?to=2024-02-29').filters.modified.to, '2024-02-29');

console.log(failures === 0 ? '\nAll URL cases pass.\n' : `\n${failures} FAILURES\n`);
process.exit(failures === 0 ? 0 : 1);
