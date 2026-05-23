// Per-scenario lookup tables that connect real-world country ISO 3166-1
// numeric codes (as exposed by the world-atlas TopoJSON) to in-game country
// identifiers + thematic colour buckets.
//
// All maps are keyed by the numeric M49 string (e.g. "840" for USA) so they
// align directly with the `id` field of each Natural Earth feature.
//
// Three scenarios each carry their own table:
//   - mondoContemporaneoByIso  → country id (mc-*)
//   - guerraFreddaByIso        → country id (gf-*)
//   - ascesaAurionByIso        → fictional country id (aurion, velmara, …)
//
// A fourth helper, `quickStartByIso`, maps the Quick Start fictional ids to
// the same Aurion sub-region as a teaching-friendly subset.

// ---------------------------------------------------------------------------
// Mondo Contemporaneo: every featured country maps to its real-world ISO
// numeric code so the game can paint its continent / play it as the player.
// Countries NOT in this table fall through to the per-continent default
// (see `continentByIso` below).
// ---------------------------------------------------------------------------

export const MC_COUNTRY_BY_ISO: Readonly<Record<string, string>> = {
  '840': 'mc-usa',
  '124': 'mc-canada',
  '484': 'mc-mexico',
  '076': 'mc-brazil',
  '032': 'mc-argentina',
  '170': 'mc-colombia',
  '826': 'mc-uk',
  '250': 'mc-france',
  '276': 'mc-germany',
  '380': 'mc-italy',
  '724': 'mc-spain',
  '616': 'mc-poland',
  '752': 'mc-sweden',
  '156': 'mc-china',
  '392': 'mc-japan',
  '410': 'mc-south-korea',
  '356': 'mc-india',
  '360': 'mc-indonesia',
  '764': 'mc-thailand',
  '704': 'mc-vietnam',
  '682': 'mc-saudi-arabia',
  '364': 'mc-iran',
  '792': 'mc-turkey',
  '376': 'mc-israel',
  '566': 'mc-nigeria',
  '710': 'mc-south-africa',
  '818': 'mc-egypt',
  '404': 'mc-kenya',
  '036': 'mc-australia',
  '554': 'mc-new-zealand',
};

// MC region (continent) bucket per ISO. Countries not in the explicit list
// above still need a continent so they can be tinted; this table is a
// best-effort grouping for ALL ~174 NE 110m features.
export type McRegion =
  | 'mc-americas'
  | 'mc-europe'
  | 'mc-africa'
  | 'mc-middle-east'
  | 'mc-asia-pacific'
  | 'mc-oceania';

const MC_AMERICAS: ReadonlySet<string> = new Set([
  '124', '840', '484', '320', '084', '340', '222', '188', '558', '591',
  '044', '192', '332', '214', '388', '630', '780',
  '076', '032', '152', '604', '170', '218', '068', '600', '858', '328',
  '740', '862',
  '238',
]);

const MC_EUROPE: ReadonlySet<string> = new Set([
  '826', '372', '352', '578', '752', '246', '208', '233', '428', '440',
  '250', '276', '528', '056', '442', '756', '040',
  '380', '724', '620', '300', '470', '300',
  '616', '203', '703', '348', '642', '100', '191', '705', '688', '499',
  '807', '008', '070',
  '498', '804', '112',
  '643',
]);

const MC_AFRICA: ReadonlySet<string> = new Set([
  '012', '732', '504', '788', '434', '566', '288', '120', '180', '178',
  '266', '226', '024', '516', '072', '710', '748', '426', '454', '508',
  '716', '894', '716', '454',
  '231', '232', '262', '706', '404', '800', '646', '108', '834', '450',
  '728', '729', '140', '562', '466', '854', '684', '270', '624', '324',
  '430', '694', '384', '768', '204', '148', '478',
]);

const MC_MIDDLE_EAST: ReadonlySet<string> = new Set([
  '792', '760', '422', '376', '275', '400', '368', '364', '414', '682',
  '634', '784', '512', '887', '004',
  '196',
  '818',
]);

const MC_ASIA_PACIFIC: ReadonlySet<string> = new Set([
  '156', '158', '392', '408', '410', '496', '356', '050', '524', '064',
  '144', '586', '360', '458', '764', '704', '116', '418', '608', '104',
  '096', '626',
  '398', '860', '795', '417', '762', '051', '031', '268',
]);

const MC_OCEANIA: ReadonlySet<string> = new Set([
  '036', '554', '598', '242', '548', '090', '540',
]);

/** Continent (MC region id) for any 110m country, including non-featured ones. */
export function continentByIso(iso: string): McRegion | null {
  if (MC_AMERICAS.has(iso)) return 'mc-americas';
  if (MC_EUROPE.has(iso)) return 'mc-europe';
  if (MC_MIDDLE_EAST.has(iso)) return 'mc-middle-east';
  if (MC_AFRICA.has(iso)) return 'mc-africa';
  if (MC_ASIA_PACIFIC.has(iso)) return 'mc-asia-pacific';
  if (MC_OCEANIA.has(iso)) return 'mc-oceania';
  return null;
}

// ---------------------------------------------------------------------------
// Guerra Fredda: bloc per ISO. Five distinct buckets + an `unaligned`
// fallback. The political bloc colours are richer than the MC continent
// palette and apply to the historical period (1945-1991).
//
// Notes on simplifications forced by the 1:110m base map (which only carries
// the modern country borders):
//   - East Germany has no separate polygon in NE 110m. We paint Germany
//     (276) as Warsaw Pact, accepting that West Germany (376 was Israel,
//     'WGE') is unrepresentable on this base. The scenario data still
//     carries both as distinct gameplay nations.
//   - Czechoslovakia → Czechia (203) + Slovakia (703), both Warsaw Pact.
//   - Yugoslavia → Serbia (688) and Bosnia (070) painted as Non-Aligned.
//   - North Vietnam → all of Vietnam (704).
// ---------------------------------------------------------------------------

export type GfBloc =
  | 'gf-north-atlantic'
  | 'gf-warsaw-pact'
  | 'gf-non-aligned'
  | 'gf-asian-tigers'
  | 'gf-global-south';

const GF_NATO: ReadonlySet<string> = new Set([
  '840', '124', '826', '250', '276', '380', '724', '578', '528', '056',
  '208', '620', '300', '792', '352',
]);

const GF_WARSAW: ReadonlySet<string> = new Set([
  '643', '616', '203', '703', '348', '642', '100', '112', '804', '498',
  '008',
]);

const GF_NON_ALIGNED: ReadonlySet<string> = new Set([
  '688', '070', '191', '705', '499', '807',
  '356', '360', '818', '012', '192',
]);

const GF_TIGERS: ReadonlySet<string> = new Set([
  '392', '410', '158',
]);

const GF_GLOBAL_SOUTH: ReadonlySet<string> = new Set([
  '704', '364', '024', '508', '558',
  '566', '288', '120', '180', '178', '266', '226', '516', '072', '710',
  '748', '426', '454', '716', '894', '231', '232', '262', '706', '404',
  '800', '646', '108', '834', '450', '728', '729', '140', '562', '466',
  '854', '270', '624', '324', '430', '694', '384', '768', '204', '148',
  '478', '504', '788', '434', '732',
  '076', '032', '152', '604', '170', '218', '068', '600', '858', '328',
  '740', '862', '484', '320', '084', '340', '222', '188', '591', '044',
  '332', '214', '388', '630', '780', '238',
  '050', '524', '064', '144', '586', '458', '764', '116', '418', '608',
  '104', '096', '626', '004',
  '760', '422', '376', '275', '400', '368', '414', '682', '634', '784',
  '512', '887', '196',
  '036', '554', '598', '242', '548', '090', '540',
]);

/** Bloc bucket for any 110m country, or null if explicitly unaligned. */
export function blocByIso(iso: string): GfBloc | null {
  if (GF_NATO.has(iso)) return 'gf-north-atlantic';
  if (GF_WARSAW.has(iso)) return 'gf-warsaw-pact';
  if (GF_NON_ALIGNED.has(iso)) return 'gf-non-aligned';
  if (GF_TIGERS.has(iso)) return 'gf-asian-tigers';
  if (GF_GLOBAL_SOUTH.has(iso)) return 'gf-global-south';
  return null;
}

// Featured GF country lookup (mirrors MC_COUNTRY_BY_ISO). Only the entries
// whose gameplay nation has a one-to-one real-world parallel are listed;
// East Germany, North Vietnam, Czechoslovakia, etc. collapse into a single
// modern feature and are painted but not individually selectable here.
export const GF_COUNTRY_BY_ISO: Readonly<Record<string, string>> = {
  '840': 'gf-usa',
  '124': 'gf-canada',
  '826': 'gf-uk',
  '250': 'gf-france',
  '276': 'gf-west-germany',
  '380': 'gf-italy',
  '724': 'gf-spain',
  '643': 'gf-ussr',
  '616': 'gf-poland',
  '348': 'gf-hungary',
  '203': 'gf-czechoslovakia',
  '642': 'gf-romania',
  '356': 'gf-india',
  '688': 'gf-yugoslavia',
  '818': 'gf-egypt',
  '012': 'gf-algeria',
  '360': 'gf-indonesia',
  '192': 'gf-cuba',
  '704': 'gf-north-vietnam',
  '024': 'gf-angola',
  '508': 'gf-mozambique',
  '558': 'gf-nicaragua',
  '364': 'gf-iran',
  '710': 'gf-south-africa',
  '231': 'gf-ethiopia',
  '392': 'gf-japan',
  '410': 'gf-south-korea',
  '158': 'gf-taiwan',
};

// ---------------------------------------------------------------------------
// Ascesa di Aurion (fictional): we borrow Mediterranean + Middle East +
// Caucasus + North Africa geography and re-label the countries with Aurion
// names. The player country (aurion) lives on the Italian peninsula.
//
// 5 macro-regions map to 5 fictional regions:
//   - auriana       → Italy / Spain / Greece / France
//   - borealis      → north Europe (UK / Germany / Poland / Ukraine / Norway)
//   - meridia       → North Africa (Egypt / Libya / Tunisia / Algeria / Morocco)
//   - oriana        → Middle East (Saudi / Iran / Iraq / Syria / Jordan /
//                     Lebanon) — read as the archipelago
//   - sahel-karoun  → Turkey + Sahel rim (Turkey / Sudan / Chad / Niger /
//                     Mali)
// ---------------------------------------------------------------------------

export const ASCESA_COUNTRY_BY_ISO: Readonly<Record<string, string>> = {
  // Auriana — Mediterranean Europe
  '380': 'aurion',
  '724': 'velmara',
  '300': 'korthia',
  '250': 'sundria',
  // Borealis — Northern Europe
  '276': 'federazione-borea',
  '616': 'tundria',
  '826': 'norhavn',
  '804': 'rusvenia',
  '578': 'iskal',
  // Meridia — North Africa
  '818': 'calanthia',
  '434': 'xanaba',
  '788': 'yureka',
  '012': 'verdantia',
  '504': 'tolmek',
  // Oriana — Middle East
  '682': 'tenshido',
  '364': 'hakaria',
  '368': 'mireku',
  '760': 'aolan',
  '400': 'sankai',
  '422': 'pelagia',
  // Sahel-Karoun — Turkey + Sahel
  '792': 'karoun',
  '729': 'saharel',
  '148': 'mokshara',
  '562': 'zembu',
  '466': 'antarah',
};

// Region id per fictional country — drives the region tint overlay in the
// real-world renderer (computed locally so it works without a round-trip
// to the scenario JSON).
export const ASCESA_REGION_BY_COUNTRY: Readonly<Record<string, string>> = {
  aurion: 'auriana',
  velmara: 'auriana',
  korthia: 'auriana',
  sundria: 'auriana',
  'federazione-borea': 'borealis',
  tundria: 'borealis',
  norhavn: 'borealis',
  rusvenia: 'borealis',
  iskal: 'borealis',
  calanthia: 'meridia',
  xanaba: 'meridia',
  yureka: 'meridia',
  verdantia: 'meridia',
  tolmek: 'meridia',
  tenshido: 'oriana',
  hakaria: 'oriana',
  mireku: 'oriana',
  aolan: 'oriana',
  sankai: 'oriana',
  pelagia: 'oriana',
  karoun: 'sahel-karoun',
  saharel: 'sahel-karoun',
  mokshara: 'sahel-karoun',
  zembu: 'sahel-karoun',
  antarah: 'sahel-karoun',
};

// Region accent colour per fictional region (uses the existing
// `--color-region-*` tokens so the palette stays consistent with the rest
// of the UI; the `karoun` fifth slot recycles the `oriana` token because
// the Aurion lexicon doesn't carry a sixth distinct hue).
export const ASCESA_REGION_TINT: Readonly<Record<string, string>> = {
  auriana: 'var(--color-region-auriana)',
  borealis: 'var(--color-region-borealis)',
  meridia: 'var(--color-region-meridia)',
  oriana: 'var(--color-region-oriana)',
  'sahel-karoun': 'var(--color-region-sahel)',
};

// ---------------------------------------------------------------------------
// Quick Start: 6 fictional nations painted on a tight European cluster so
// the player learns the geometry quickly.
// ---------------------------------------------------------------------------

export const QUICK_START_COUNTRY_BY_ISO: Readonly<Record<string, string>> = {
  '380': 'verm-aurelia',
  '250': 'verm-koros',
  '276': 'verm-tessari',
  '724': 'verm-magnara',
  '792': 'verm-soltan',
  '818': 'verm-ridhana',
};
