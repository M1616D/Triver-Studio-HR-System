/* -----------------------------------------------------------------------------
   Triverse OS — Google Maps diagnostic
     node scripts/diagnose-google.js ["your api key"] [search words]
   Answers, in order, the four questions that decide whether the live search in
   the app can work:
     1. is the key accepted at all
     2. does Text Search return real businesses
     3. is every business-type filter the app can send accepted by Google
     4. does Place Details return the full record (phone, website, hours)
        and is Google releasing its Atmosphere data (reviews and photos)
   Nothing here writes to the app: it only reads the live API.
   -------------------------------------------------------------------------- */
'use strict';

const KEY = process.argv[2] || 'AIzaSyD3es3VxVtt9ryJFWOENWpAkeWu61vxOXY';
const WORDS = process.argv[3] || 'restaurant in Addis Ababa, Ethiopia';
const BASE = 'https://places.googleapis.com/v1/';

/* mirrors assets/js/providers.js — keep the two in step */
const SEARCH_FIELDS = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.shortFormattedAddress',
  'places.location', 'places.rating', 'places.userRatingCount', 'places.websiteUri',
  'places.nationalPhoneNumber', 'places.internationalPhoneNumber',
  'places.primaryType', 'places.primaryTypeDisplayName', 'places.types',
  'places.priceLevel', 'places.businessStatus',
  'places.regularOpeningHours.openNow', 'places.currentOpeningHours.openNow', 'places.utcOffsetMinutes',
  'places.googleMapsUri', 'places.editorialSummary', 'places.photos',
  'places.addressComponents', 'nextPageToken'
].join(',');
const DETAIL_FIELDS = [
  'id', 'displayName', 'formattedAddress', 'shortFormattedAddress', 'adrFormatAddress',
  'location', 'plusCode', 'rating', 'userRatingCount', 'websiteUri',
  'nationalPhoneNumber', 'internationalPhoneNumber', 'primaryType', 'primaryTypeDisplayName',
  'types', 'priceLevel', 'businessStatus', 'googleMapsUri', 'editorialSummary',
  'photos', 'reviews', 'regularOpeningHours', 'currentOpeningHours', 'utcOffsetMinutes',
  'addressComponents',
  'delivery', 'dineIn', 'takeout', 'reservable', 'curbsidePickup', 'paymentOptions'
].join(',');
/* every type the app is allowed to send — verified against the live API */
const TYPES = ['restaurant', 'cafe', 'fast_food_restaurant', 'hotel', 'medical_clinic',
  'dental_clinic', 'pharmacy', 'gym', 'beauty_salon', 'spa', 'real_estate_agency', 'car_repair',
  'travel_agency', 'educational_institution', 'school', 'clothing_store', 'electronics_store',
  'furniture_store', 'supermarket', 'lawyer', 'accounting', 'courier_service', 'event_venue'];

const say = (ok, label, extra) => console.log('  ' + (ok === true ? '✓' : ok === false ? '✗' : '·') + ' ' + label + (extra ? ' — ' + extra : ''));

async function search(body, mask) {
  const res = await fetch(BASE + 'places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': mask || SEARCH_FIELDS },
    body: JSON.stringify(body)
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

(async () => {
  console.log('\nGoogle Maps diagnostic for the Triverse OS key\n' + '='.repeat(46));

  console.log('\n1 · the key');
  const first = await search({ textQuery: WORDS, pageSize: 5, languageCode: 'en', regionCode: 'ET' }, 'places.id,places.displayName');
  if (first.status >= 400) {
    const err = first.data.error || {};
    say(false, 'HTTP ' + first.status, String(err.message || '').slice(0, 300));
    const link = (String(err.message || '').match(/https?:\/\/\S+/) || [])[0];
    if (link) console.log('    → open and press Enable: ' + link.replace(/[.,]$/, ''));
    return;
  }
  const places = (first.data.places || []);
  say(true, 'the key is accepted', places.length + ' places');

  console.log('\n2 · real businesses');
  const full = await search({ textQuery: WORDS, pageSize: 5, languageCode: 'en', regionCode: 'ET' });
  (full.data.places || []).slice(0, 5).forEach(p => {
    say(true, (p.displayName && p.displayName.text || '').slice(0, 40).padEnd(42),
      (p.websiteUri ? 'website' : 'NO website') + ' · ' + (p.nationalPhoneNumber || 'no phone') +
      ' · ★' + (p.rating || 0) + ' (' + (p.userRatingCount || 0) + ')');
  });

  console.log('\n3 · every business-type filter the app can send');
  let bad = 0;
  for (const t of TYPES) {
    const r = await search({ textQuery: t.replace(/_/g, ' ') + ' in Addis Ababa', pageSize: 1, includedType: t }, 'places.id');
    if (r.status >= 400) { bad++; say(false, t, String((r.data.error || {}).message || '').slice(0, 90)); }
  }
  say(bad === 0, bad ? bad + ' type(s) rejected by Google — remove them from GOOGLE_TYPE' : 'all ' + TYPES.length + ' types accepted');

  console.log('\n4 · the full business record, and Atmosphere data');
  const id = places[0] && places[0].id;
  if (!id) { say(null, 'no place came back, so the record cannot be read'); return; }
  const res = await fetch(BASE + 'places/' + id + '?languageCode=en', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': DETAIL_FIELDS }
  });
  const d = await res.json().catch(() => ({}));
  if (res.status >= 400) {
    const v = (((d.error || {}).details || [{}])[0].fieldViolations || [{}])[0];
    say(false, 'the record was refused', (v.description || '') + (v.field ? ' [field: ' + v.field.slice(0, 120) + ']' : ''));
    return;
  }
  say(true, 'the record came back', 'phone ' + (d.nationalPhoneNumber || 'none') +
    ' · website ' + (d.websiteUri ? 'yes' : 'none') + ' · ' + ((d.regularOpeningHours || {}).weekdayDescriptions || []).length + ' days of hours');
  const reviews = (d.reviews || []).length, photos = (d.photos || []).length;
  const blocked = !reviews && !photos && Number(d.userRatingCount) > 0;
  say(!blocked, 'reviews and photos', blocked
    ? 'WITHHELD: Google returned ' + d.userRatingCount + ' ratings but no review text and no photos.\n' +
      '    Those come from the Enterprise “Atmosphere” data, which needs billing on the project:\n' +
      '    https://console.cloud.google.com/billing/linkedaccount'
    : reviews + ' reviews, ' + photos + ' photos');
  console.log('\nDone. Nothing was changed — this only reads the API.\n');
})();
