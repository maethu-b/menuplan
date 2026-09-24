/* Stammdaten: Kategorien, Stichwörter für die automatische Zuordnung, Einheiten, Beispielrezepte */

// Reihenfolge = Standard-Laufweg im Laden. In den Einstellungen änderbar.
const CATEGORIES = [
  { id: 'gemuese',   label: 'Gemüse & Früchte',     color: '#43a047' },
  { id: 'brot',      label: 'Brot & Backwaren',     color: '#a1887f' },
  { id: 'milch',     label: 'Milchprodukte & Eier', color: '#42a5f5' },
  { id: 'fleisch',   label: 'Fleisch & Fisch',      color: '#e53935' },
  { id: 'vorrat',    label: 'Vorrat & Teigwaren',   color: '#fb8c00' },
  { id: 'gewuerze',  label: 'Gewürze & Saucen',     color: '#8d6e63' },
  { id: 'tiefkuehl', label: 'Tiefkühl',             color: '#26c6da' },
  { id: 'getraenke', label: 'Getränke',             color: '#7e57c2' },
  { id: 'suess',     label: 'Snacks & Süsses',      color: '#ec407a' },
  { id: 'haushalt',  label: 'Haushalt & Drogerie',  color: '#78909c' },
  { id: 'sonstiges', label: 'Sonstiges',            color: '#9e9e9e' }
];

// Stichwörter (Teilwort, klein geschrieben). Längere, spezifischere Treffer gewinnen.
const CATEGORY_KEYWORDS = {
  gemuese: ['tomate', 'gurke', 'salat', 'zwiebel', 'knoblauch', 'rüebli', 'karotte', 'kartoffel', 'härdöpfel',
    'peperoni', 'paprika', 'zucchetti', 'zucchini', 'aubergine', 'brokkoli', 'broccoli', 'blumenkohl', 'lauch',
    'sellerie', 'spinat', 'pilz', 'champignon', 'kürbis', 'fenchel', 'kohl', 'randen', 'radiesli', 'avocado',
    'apfel', 'äpfel', 'birne', 'banane', 'zitrone', 'limette', 'orange', 'beere', 'trauben', 'kiwi', 'mango',
    'ingwer', 'petersilie', 'basilikum', 'schnittlauch', 'koriander', 'rucola', 'frühlingszwiebel', 'mais',
    'erbsen', 'bohnen frisch', 'chili', 'kräuter', 'dill', 'minze'],
  brot: ['brot', 'zopf', 'brötchen', 'weggli', 'gipfeli', 'toast', 'tortilla', 'wrap', 'pita', 'fladenbrot',
    'blätterteig', 'kuchenteig', 'pizzateig', 'paniermehl'],
  milch: ['milch', 'rahm', 'sahne', 'butter', 'joghurt', 'jogurt', 'quark', 'käse', 'mozzarella', 'parmesan',
    'feta', 'mascarpone', 'ricotta', 'crème fraîche', 'creme fraiche', 'sauerrahm', 'ei', 'eier', 'eigelb', 'eiweiss', 'gruyère',
    'emmentaler', 'raclette', 'hüttenkäse', 'tofu'],
  fleisch: ['fleisch', 'hack', 'poulet', 'hähnchen', 'huhn', 'rind', 'schwein', 'kalb', 'lamm', 'speck', 'schinken',
    'wurst', 'cervelat', 'bratwurst', 'salami', 'lachs', 'fisch', 'thon frisch', 'crevette', 'garnele',
    'geschnetzeltes', 'steak', 'plätzli', 'filet', 'chorizo', 'kebab'],
  vorrat: ['spaghetti', 'penne', 'nudel', 'teigwaren', 'pasta', 'hörnli', 'reis', 'risotto', 'couscous', 'bulgur',
    'quinoa', 'linsen', 'kichererbsen', 'mehl', 'zucker', 'haferflocken', 'müesli', 'polenta', 'dose', 'pelati',
    'passata', 'tomatenpüree', 'kokosmilch', 'thon', 'bouillon', 'brühe', 'öl', 'olivenöl', 'essig', 'honig',
    'konfitüre', 'nüsse', 'mandeln', 'backpulver', 'hefe', 'bohnen', 'gnocchi', 'lasagne', 'cornflakes', 'kaffee', 'tee',
    'suppenpulver', 'ramen', 'nori', 'mohn', 'sesam', 'vanillezucker', 'kakao', 'stärke', 'maizena', 'rosinen', 'samen'],
  gewuerze: ['salz', 'pfeffer', 'paprikapulver', 'curry', 'zimt', 'oregano', 'thymian', 'rosmarin', 'muskat',
    'kreuzkümmel', 'senf', 'ketchup', 'mayonnaise', 'sojasauce', 'sojasosse', 'sauce', 'sosse', 'pesto',
    'gewürz', 'aromat', 'tabasco', 'sambal', 'lorbeer', 'gochujang', 'sriracha', 'currypaste', 'fischsauce', 'miso'],
  tiefkuehl: ['tiefkühl', 'tk-', 'glace', 'eis ', 'pommes', 'fischstäbchen', 'tiefgekühlt'],
  getraenke: ['wasser', 'mineral', 'saft', 'bier', 'wein', 'cola', 'sirup', 'eistee', 'limonade', 'prosecco'],
  suess: ['schokolade', 'chips', 'guetzli', 'kekse', 'bonbon', 'gummibär', 'riegel', 'popcorn', 'apéro'],
  haushalt: ['wc-papier', 'toilettenpapier', 'haushaltpapier', 'küchenpapier', 'abwaschmittel', 'spülmittel',
    'geschirrspül', 'tabs', 'waschmittel', 'weichspüler', 'putzmittel', 'reiniger', 'schwamm', 'abfallsack',
    'kehrichtsack', 'alufolie', 'frischhaltefolie', 'backpapier', 'zahnpasta', 'zahnbürste', 'shampoo',
    'duschgel', 'seife', 'deo', 'taschentücher', 'windeln', 'batterien', 'kerzen', 'servietten', 'wattestäbchen']
};

// Einheiten, die der Zutaten-Parser erkennt (Schreibweise wie im Rezept, Normalform rechts)
const UNITS = {
  'g': 'g', 'gr': 'g', 'gramm': 'g', 'kg': 'kg', 'mg': 'mg',
  'ml': 'ml', 'cl': 'cl', 'dl': 'dl', 'l': 'l', 'liter': 'l',
  'el': 'EL', 'tl': 'TL', 'msp': 'Msp', 'prise': 'Prise', 'prisen': 'Prise',
  'stk': 'Stk', 'stk.': 'Stk', 'stück': 'Stk',
  'bund': 'Bund', 'dose': 'Dose', 'dosen': 'Dose', 'pck': 'Pck', 'pck.': 'Pck', 'packung': 'Pck', 'packungen': 'Pck',
  'becher': 'Becher', 'zehe': 'Zehe', 'zehen': 'Zehe', 'scheibe': 'Scheibe', 'scheiben': 'Scheibe',
  'glas': 'Glas', 'gläser': 'Glas', 'flasche': 'Flasche', 'flaschen': 'Flasche', 'tasse': 'Tasse', 'tassen': 'Tasse',
  'handvoll': 'Handvoll', 'zweig': 'Zweig', 'zweige': 'Zweig', 'kopf': 'Kopf', 'beutel': 'Beutel',
  'kl': 'KL', 'kl.': 'KL', 'kaffeelöffel': 'KL', 'nester': 'Nest', 'nest': 'Nest', 'blatt': 'Blatt', 'blätter': 'Blatt'
};

const DEFAULT_TAGS = ['vegetarisch', 'vegan', 'schnell', 'Fleisch', 'Fisch', 'Pasta', 'Ofen', 'Suppe', 'Salat', 'Kinder', 'Wochenende'];

// Optionale Beispielrezepte zum Ausprobieren (Einstellungen > Beispielrezepte laden)
const SAMPLE_RECIPES = [
  { name: 'Spaghetti Bolognese', servings: 4, tags: ['Pasta', 'Fleisch', 'Kinder'],
    ingredients: '500 g Spaghetti\n400 g Rindshackfleisch\n1 Zwiebel\n2 Zehen Knoblauch\n1 Rüebli\n1 Dose Pelati\n2 EL Tomatenpüree\n2 EL Olivenöl\n1 dl Rotwein\nSalz\nPfeffer\n50 g Parmesan',
    notes: 'Zwiebel, Knoblauch, Rüebli fein hacken und andünsten. Hackfleisch anbraten, mit Wein ablöschen, Pelati und Püree dazu, 30 Min. köcheln.' },
  { name: 'Älplermagronen mit Apfelmus', servings: 4, tags: ['vegetarisch', 'Kinder'],
    ingredients: '400 g Hörnli\n400 g Kartoffeln\n200 g Gruyère\n2 dl Rahm\n2 Zwiebeln\n2 EL Butter\n4 Äpfel\nSalz\nMuskat',
    notes: 'Kartoffelwürfel mit den Hörnli kochen. Mit Rahm und Käse mischen, Röstzwiebeln darüber. Apfelmus dazu.' },
  { name: 'Poulet-Curry mit Reis', servings: 4, tags: ['Fleisch', 'schnell'],
    ingredients: '600 g Pouletbrust\n300 g Reis\n1 Dose Kokosmilch\n2 EL Currypaste\n1 Peperoni\n1 Zucchetti\n1 Zwiebel\n1 Stk Ingwer\n2 EL Öl\n1 Limette',
    notes: 'Poulet anbraten, Gemüse dazu, mit Kokosmilch und Currypaste 15 Min. köcheln. Mit Limette abschmecken.' },
  { name: 'Ofengemüse mit Feta', servings: 2, tags: ['vegetarisch', 'Ofen', 'schnell'],
    ingredients: '500 g Kartoffeln\n1 Peperoni\n1 Zucchetti\n1 Zwiebel\n200 g Feta\n3 EL Olivenöl\n1 TL Thymian\nSalz\nPfeffer',
    notes: 'Gemüse schneiden, mit Öl und Gewürzen mischen, 35 Min. bei 200 °C backen, Feta in den letzten 10 Min. dazu.' },
  { name: 'Lachs mit Ofenkartoffeln und Salat', servings: 2, tags: ['Fisch', 'Ofen'],
    ingredients: '2 Stk Lachsfilet\n600 g Kartoffeln\n1 Kopf Salat\n1 Zitrone\n1 Becher Sauerrahm\n1 Bund Schnittlauch\n2 EL Olivenöl\nSalz',
    notes: 'Kartoffeln halbieren, 40 Min. backen. Lachs die letzten 15 Min. dazu. Sauerrahm mit Schnittlauch als Dip.' },
  { name: 'Linsensuppe', servings: 4, tags: ['vegan', 'Suppe'],
    ingredients: '250 g rote Linsen\n1 Zwiebel\n2 Rüebli\n1 Stk Ingwer\n1 Dose Kokosmilch\n1 l Bouillon\n1 TL Kreuzkümmel\n1 Zitrone',
    notes: 'Alles andünsten, mit Bouillon 20 Min. kochen, pürieren, mit Kokosmilch und Zitrone abschmecken.' },
  { name: 'Wähe mit Käse', servings: 4, tags: ['vegetarisch', 'Ofen', 'Wochenende'],
    ingredients: '1 Pck Kuchenteig\n250 g Emmentaler\n3 Eier\n2 dl Milch\n1 dl Rahm\nSalz\nPfeffer\nMuskat',
    notes: 'Teig ins Blech, Käse darauf, Guss aus Eiern, Milch, Rahm darüber. 30 Min. bei 220 °C.' }
];

if (typeof module !== 'undefined') {
  module.exports = { CATEGORIES, CATEGORY_KEYWORDS, UNITS, DEFAULT_TAGS, SAMPLE_RECIPES };
}
