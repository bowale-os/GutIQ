// ── Conditions ────────────────────────────────────────────────────────────────
// aliases: common names, abbreviations, symptoms, and misspellings users
// might type. The search scorer checks all of them.
export const CONDITIONS_DEFAULT = [
  {
    id: 'GERD',
    color: '#e07b39',
    label: 'GERD / Acid Reflux',
    aliases: ['acid reflux', 'reflux', 'heartburn', 'gastroesophageal', 'acid', 'regurgitation', 'burning throat'],
  },
  {
    id: 'IBS',
    color: '#2c7a7b',
    label: 'IBS (Irritable Bowel Syndrome)',
    aliases: ['irritable bowel', 'irritable bowel syndrome', 'bloating', 'cramps', 'diarrhea', 'diarrhoea', 'loose stool', 'alternating bowel', 'stomach cramps'],
  },
  {
    id: 'LactoseInt',
    color: '#3f6212',
    label: 'Lactose Intolerance',
    aliases: ['lactose', 'dairy', 'milk intolerance', 'dairy intolerance', 'bloating after milk', 'after dairy', 'cant digest dairy'],
  },
];

export const CONDITIONS = [
  ...CONDITIONS_DEFAULT,
  {
    id: 'ChronConstip',
    color: '#78350f',
    label: 'Chronic Constipation',
    aliases: ['constipation', 'cant go', 'no bowel movement', 'hard stool', 'straining', 'infrequent stool'],
  },
  {
    id: 'Dyspepsia',
    color: '#92400e',
    label: 'Functional Dyspepsia',
    aliases: ['dyspepsia', 'indigestion', 'fullness after eating', 'early satiety', 'epigastric', 'upset stomach', 'bloated after eating', 'nausea after food'],
  },
  {
    id: 'Hpylori',
    color: '#7f1d1d',
    label: 'H. pylori (Helicobacter pylori)',
    aliases: ['h pylori', 'helicobacter', 'pylori', 'stomach bacteria', 'bacterial infection', 'stomach infection', 'hpylori'],
  },
  {
    id: 'PUD',
    color: '#dc2626',
    label: 'Peptic Ulcer Disease',
    aliases: ['pud', 'peptic ulcer', 'ulcer', 'stomach ulcer', 'duodenal ulcer', 'gnawing pain', 'hunger pain', 'pain when empty'],
  },
  {
    id: 'Celiac',
    color: '#15803d',
    label: 'Celiac Disease',
    aliases: ['celiac', 'coeliac', 'gluten intolerance', 'gluten', 'wheat intolerance', 'gluten sensitivity', 'after bread', 'after pasta'],
  },
  {
    id: 'UC',
    color: '#0369a1',
    label: 'Ulcerative Colitis',
    aliases: ['uc', 'colitis', 'ibd', 'inflammatory bowel', 'bloody stool', 'mucus stool', 'rectal bleeding', 'bowel inflammation'],
  },
  {
    id: 'Crohns',
    color: '#7c3aed',
    label: "Crohn's Disease",
    aliases: ["crohn's", 'crohns', 'crohn', 'ibd', 'inflammatory bowel', 'bowel inflammation', 'flare up'],
  },
];

// ── Medications ───────────────────────────────────────────────────────────────
export const MED_LIST = [
  'Omeprazole','Pantoprazole','Lansoprazole','Esomeprazole','Rabeprazole','Dexlansoprazole',
  'Famotidine','Cimetidine','Nizatidine','Ranitidine',
  'Gaviscon','Tums','Maalox','Mylanta','Rennie',
  'Buscopan','Mebeverine','Dicyclomine','Hyoscine',
  'Linaclotide','Lubiprostone','Plecanatide',
  'Loperamide','Codeine Phosphate',
  'Rifaximin','Neomycin',
  'Alosetron','Eluxadoline',
  'Peppermint Oil',
  'Metoclopramide','Domperidone','Prucalopride','Erythromycin','Tegaserod',
  'Mesalazine','Mesalamine','Sulfasalazine','Balsalazide','Olsalazine',
  'Prednisone','Prednisolone','Budesonide','Hydrocortisone',
  'Azathioprine','Mercaptopurine','Methotrexate','Ciclosporin','Tacrolimus',
  'Infliximab','Adalimumab','Vedolizumab','Ustekinumab',
  'Risankizumab','Mirikizumab','Guselkumab',
  'Ozanimod','Etrasimod','Tofacitinib','Upadacitinib','Filgotinib',
  'Cholestyramine','Colesevelam','Colestipol',
  'Creon','Pancreatin','Lactase',
  'Metronidazole','Ciprofloxacin','Amoxicillin','Clarithromycin',
  'Sucralfate','Misoprostol','Bismuth Subsalicylate',
];

// ── Dietary protocols ─────────────────────────────────────────────────────────
export const DIETARY_PROTOCOLS = [
  { id: 'none',          label: 'No particular protocol',          desc: 'No specific dietary restrictions right now' },
  { id: 'low-fodmap',    label: 'Low-FODMAP',                      desc: 'Limits fermentable carbs e.g. onions, garlic, wheat, some fruits. Used for IBS and bloating' },
  { id: 'gluten-free',   label: 'Gluten-free',                     desc: 'Removes wheat, barley, and rye. Essential for celiac disease' },
  { id: 'dairy-free',    label: 'Dairy-free',                      desc: 'Removes milk and lactose products. Helps with lactose intolerance and some IBS' },
  { id: 'scd',           label: 'SCD (Specific Carbohydrate Diet)', desc: "Removes grains, most sugars, and lactose. Used for Crohn's and ulcerative colitis" },
  { id: 'mediterranean', label: 'Mediterranean',                   desc: 'High in vegetables, fish, olive oil, and whole grains. An anti-inflammatory pattern' },
  { id: 'low-residue',   label: 'Low-residue',                     desc: 'Reduces high-fibre foods to rest the gut. Often used during IBD flares' },
  { id: 'other',         label: 'Something else',                  desc: null },
];

// ── Age ranges ────────────────────────────────────────────────────────────────
export const AGE_RANGES = ['Under 25', '25–40', '41–60', '60+'];

// ── Quick reminder times ──────────────────────────────────────────────────────
export const QUICK_TIMES = [
  { label: '8:00 AM',  value: '08:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '7:00 PM',  value: '19:00' },
  { label: '9:00 PM',  value: '21:00' },
];
