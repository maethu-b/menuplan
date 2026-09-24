/* Reine Logik ohne Bildschirm: Datum, Zutaten-Parser, Kategorien, Vorschläge, Einkaufsliste.
   Im Browser global verfügbar, in Node per require() testbar. */

(function (root) {
  const D = (typeof module !== 'undefined') ? require('./data.js') : { UNITS: UNITS, CATEGORY_KEYWORDS: CATEGORY_KEYWORDS, CATEGORIES: CATEGORIES };

  // ---------- Datum ----------
  function toISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function fromISO(s) {
    const p = s.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function addDays(iso, n) {
    const d = fromISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }
  function mondayOf(iso) {
    const d = fromISO(iso);
    const wd = (d.getDay() + 6) % 7; // Mo=0 ... So=6
    d.setDate(d.getDate() - wd);
    return toISO(d);
  }
  function weekDays(mondayIso) {
    const out = [];
    for (let i = 0; i < 7; i++) out.push(addDays(mondayIso, i));
    return out;
  }
  function daysBetween(aIso, bIso) {
    return Math.round((fromISO(bIso) - fromISO(aIso)) / 86400000);
  }
  const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  function formatDay(iso) {
    const d = fromISO(iso);
    return WEEKDAYS[(d.getDay() + 6) % 7] + ' ' + String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.';
  }
  function isoWeekNumber(iso) {
    const d = fromISO(iso);
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  }

  // ---------- Zutaten-Parser ----------
  const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

  function parseNumber(tok) {
    if (tok == null) return null;
    tok = String(tok).trim();
    if (FRACTIONS[tok] != null) return FRACTIONS[tok];
    let mf = tok.match(/^(\d+)\s*([½¼¾⅓⅔])$/); // "1½"
    if (mf) return Number(mf[1]) + FRACTIONS[mf[2]];
    let m = tok.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (m) return Number(m[1]) / Number(m[2]);
    m = tok.match(/^(\d+(?:[.,]\d+)?)(?:\s*-\s*\d+(?:[.,]\d+)?)?$/); // "2-3" -> 2
    if (m) return Number(m[1].replace(',', '.'));
    return null;
  }

  // "500 g Spaghetti", "1,5 dl Milch", "1/2 TL Salz", "500g Mehl", "Salz"
  function parseIngredientLine(line) {
    let s = String(line || '').trim().replace(/^[-*]\s*/, '');
    if (!s) return null;
    let qty = null, unit = '';
    let m = s.match(/^((?:\d+\s*[½¼¾⅓⅔])|(?:\d+\s*\/\s*\d+)|(?:\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?)|[½¼¾⅓⅔])\s*(.*)$/);
    if (m) {
      qty = parseNumber(m[1]);
      s = m[2].trim();
      const um = s.match(/^([A-Za-zÄÖÜäöü.]+)\s+(.+)$/);
      if (um && D.UNITS[um[1].toLowerCase()]) {
        unit = D.UNITS[um[1].toLowerCase()];
        s = um[2].trim();
      }
    }
    if (!s) return null;
    return { qty: qty, unit: unit, name: s };
  }

  function parseIngredients(text, overrides) {
    return String(text || '').split(/\r?\n/)
      .map(parseIngredientLine)
      .filter(Boolean)
      .map(function (ing) { ing.cat = guessCategory(ing.name, overrides); return ing; });
  }

  function ingredientsToText(list) {
    return (list || []).map(function (i) {
      const parts = [];
      if (i.qty != null) parts.push(formatNumber(i.qty));
      if (i.unit) parts.push(i.unit);
      parts.push(i.name);
      return parts.join(' ');
    }).join('\n');
  }

  // ---------- Kategorien ----------
  function normName(name) {
    return String(name || '').toLowerCase().trim().replace(/\s+/g, ' ');
  }
  // Schlüssel zum Zusammenführen: einfache Mehrzahl-Bereinigung (Zwiebeln -> zwiebel, Tomaten -> tomate)
  function mergeKey(name) {
    let n = normName(name);
    if (n.length > 4 && n.endsWith('n')) n = n.slice(0, -1);
    return n;
  }

  function guessCategory(name, overrides) {
    const n = normName(name);
    if (overrides) {
      if (overrides[n]) return overrides[n];
      const k = mergeKey(n);
      if (overrides[k]) return overrides[k];
    }
    let best = null, bestLen = 0;
    const words = n.split(/[^a-zäöüéèàâç\-]+/);
    for (const cat in D.CATEGORY_KEYWORDS) {
      for (const kw of D.CATEGORY_KEYWORDS[cat]) {
        const k = kw.trim();
        const hit = k.length <= 3 ? words.some(function (wd) { return wd === k || (wd.length > k.length + 2 && wd.endsWith(k)); }) : n.indexOf(k) >= 0;
        if (hit && k.length > bestLen) { best = cat; bestLen = k.length; }
      }
    }
    return best || 'sonstiges';
  }

  // ---------- Mengen ----------
  const TO_BASE = { g: ['g', 1], kg: ['g', 1000], mg: ['g', 0.001], ml: ['ml', 1], cl: ['ml', 10], dl: ['ml', 100], l: ['ml', 1000] };

  function toBase(qty, unit) {
    if (qty == null) return { qty: null, unit: unit };
    const t = TO_BASE[unit];
    return t ? { qty: qty * t[1], unit: t[0] } : { qty: qty, unit: unit };
  }
  function fromBase(qty, unit) {
    if (qty == null) return { qty: null, unit: unit };
    if (unit === 'g' && qty >= 1000) return { qty: qty / 1000, unit: 'kg' };
    if (unit === 'ml' && qty >= 1000) return { qty: qty / 1000, unit: 'l' };
    if (unit === 'ml' && qty >= 100) return { qty: qty / 100, unit: 'dl' };
    return { qty: qty, unit: unit };
  }

  function formatNumber(x) {
    if (x == null) return '';
    const r = Math.round(x * 100) / 100;
    const whole = Math.floor(r);
    const frac = Math.round((r - whole) * 100) / 100;
    const fr = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[frac];
    if (fr) return (whole ? whole : '') + fr;
    return String(Math.round(r * 10) / 10).replace('.', ',');
  }
  const SMALL_UNITS = ['EL', 'TL', 'KL', 'Msp', 'Prise', 'Zehe', 'Zweig', 'Handvoll', 'Scheibe', 'Tasse', 'mg'];
  function roundForShopping(qty, unit) {
    if (qty == null) return null;
    if (unit === 'g' || unit === 'ml') return Math.ceil(qty / 5 - 1e-9) * 5;
    if (unit === 'kg' || unit === 'l' || unit === 'dl' || SMALL_UNITS.indexOf(unit) >= 0) return Math.ceil(qty * 4 - 1e-9) / 4;
    return Math.max(1, Math.ceil(qty - 1e-9)); // Stück, Packungen, Dosen: ganze Einheiten kaufen
  }
  function formatQty(qty, unit) {
    if (qty == null) return unit || '';
    return (formatNumber(qty) + ' ' + (unit || '')).trim();
  }

  // ---------- Rezeptvorschläge ----------
  function lastUsedMap(plan, todayIso) {
    const map = {};
    Object.keys(plan || {}).forEach(function (day) {
      (plan[day] || []).forEach(function (meal) {
        if (!meal.recipeId) return;
        if (todayIso && day > todayIso) return;
        if (!map[meal.recipeId] || day > map[meal.recipeId]) map[meal.recipeId] = day;
      });
    });
    return map;
  }

  // Gewichtete Zufallsauswahl: lange nicht gekocht und Favoriten zuerst, etwas Zufall für Abwechslung
  function suggestRecipes(state, opts) {
    opts = opts || {};
    const count = opts.count || 3;
    const tags = opts.tags || [];
    const exclude = new Set(opts.exclude || []);
    const today = opts.today || toISO(new Date());
    const rnd = opts.random || Math.random;
    const last = lastUsedMap(state.plan, today);
    const scored = state.recipes
      .filter(function (r) { return !exclude.has(r.id); })
      .filter(function (r) { return tags.every(function (t) { return (r.tags || []).indexOf(t) >= 0; }); })
      .map(function (r) {
        const since = last[r.id] ? Math.min(daysBetween(last[r.id], today), 60) : 60;
        const score = since + (r.fav ? 15 : 0) + rnd() * 25;
        return { r: r, score: score };
      })
      .sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, count).map(function (x) { return x.r; });
  }

  // ---------- Einkaufsliste ----------
  // «Knoblauchzehe, gerieben» -> «Knoblauchzehe», «Nori-Blatt (optional)» -> «Nori-Blatt»
  function shortName(name) {
    const n = String(name || '').split(/,|\s\(/)[0].trim();
    return n || String(name || '').trim();
  }
  function buildShoppingFromPlan(state, days) {
    const byKey = {};
    const recipesById = {};
    state.recipes.forEach(function (r) { recipesById[r.id] = r; });
    days.forEach(function (day) {
      (state.plan[day] || []).forEach(function (meal) {
        const r = recipesById[meal.recipeId];
        if (!r) return;
        const factor = (meal.servings || r.servings || 1) / (r.servings || 1);
        (r.ingredients || []).forEach(function (ing) {
          const b = toBase(ing.qty != null ? ing.qty * factor : null, ing.unit || '');
          const nm = shortName(ing.name);
          const key = mergeKey(nm) + '|' + b.unit;
          if (!byKey[key]) {
            byKey[key] = { key: key, name: nm, qty: null, unit: b.unit, cat: ing.cat || guessCategory(ing.name, state.settings && state.settings.catOverrides), from: [] };
          }
          const it = byKey[key];
          if (b.qty != null) it.qty = (it.qty || 0) + b.qty;
          if (it.from.indexOf(r.name) < 0) it.from.push(r.name);
        });
      });
    });
    return Object.keys(byKey).map(function (k) {
      const it = byKey[k];
      const out = fromBase(it.qty, it.unit);
      return { key: it.key, name: it.name, qty: roundForShopping(out.qty, out.unit), unit: out.unit, cat: it.cat, from: it.from };
    });
  }

  // Neue Planartikel übernehmen, eigene Artikel behalten, Häkchen gleicher Artikel beibehalten
  function mergeShopping(existing, generated, makeId) {
    const checkedKeys = new Set(existing.filter(function (i) { return i.source === 'plan' && i.checked; }).map(function (i) { return i.key; }));
    const manual = existing.filter(function (i) { return i.source !== 'plan'; });
    const fresh = generated.map(function (g) {
      return { id: makeId(), key: g.key, name: g.name, qty: g.qty, unit: g.unit, cat: g.cat, from: g.from, source: 'plan', checked: checkedKeys.has(g.key) };
    });
    return fresh.concat(manual);
  }

  function groupByCategory(items, catOrder) {
    const groups = {};
    items.forEach(function (i) { (groups[i.cat] = groups[i.cat] || []).push(i); });
    const order = catOrder.slice();
    Object.keys(groups).forEach(function (c) { if (order.indexOf(c) < 0) order.push(c); });
    return order.filter(function (c) { return groups[c]; }).map(function (c) {
      const list = groups[c].slice().sort(function (a, b) {
        if (a.checked !== b.checked) return a.checked ? 1 : -1;
        return a.name.localeCompare(b.name, 'de');
      });
      return { cat: c, items: list };
    });
  }

  // ---------- Teilen als Text (WhatsApp, SMS ...) und wieder einlesen ----------
  function catLabel(id) {
    const c = D.CATEGORIES.find(function (x) { return x.id === id; });
    return c ? c.label : id;
  }
  // Schlüssel für «gleicher Artikel»: Name ohne Mehrzahl + Grundeinheit (dl und l zählen als ml)
  function itemKey(name, unit) {
    return mergeKey(name) + '|' + toBase(1, unit || '').unit;
  }
  function itemLine(i) {
    return (i.qty != null ? formatQty(i.qty, i.unit) + ' ' : '') + i.name;
  }

  // Nur offene Artikel, nach Laden-Reihenfolge gruppiert
  function shoppingToText(items, catOrder, title) {
    const open = items.filter(function (i) { return !i.checked; });
    const lines = [title || 'Einkaufsliste'];
    groupByCategory(open, catOrder).forEach(function (g) {
      lines.push('');
      lines.push(catLabel(g.cat) + ':');
      g.items.forEach(function (i) { lines.push('- ' + itemLine(i)); });
    });
    return lines.join('\n');
  }

  // Liest eine geteilte oder frei getippte Liste. Überschriften wie «Gemüse & Früchte:» setzen die Kategorie.
  function parseShoppingText(text, overrides) {
    const labelToId = {};
    D.CATEGORIES.forEach(function (c) { labelToId[normName(c.label)] = c.id; });
    let currentCat = null;
    const out = [];
    String(text || '').split(/\r?\n/).forEach(function (raw) {
      let line = raw.trim();
      if (!line) { currentCat = null; return; } // Leerzeile beendet eine Kategorie
      const head = normName(line.replace(/:$/, ''));
      if (labelToId[head]) { currentCat = labelToId[head]; return; }
      if (/^(einkaufsliste|wochenplan)\b/i.test(line)) return;
      line = line.replace(/^(?:[-*+]|\[\s?[xX ]?\]|\d+[.)])\s*/, '').replace(/^[☐☑☒□○•·]\s*/, '');
      const p = parseIngredientLine(line);
      if (!p) return;
      p.cat = currentCat || guessCategory(p.name, overrides);
      if (p.qty == null) p.unit = '';
      out.push(p);
    });
    return out;
  }

  function planToText(state, monday) {
    const byId = {};
    state.recipes.forEach(function (r) { byId[r.id] = r; });
    const days = weekDays(monday);
    const lines = ['Wochenplan KW ' + isoWeekNumber(monday) + ' (' + formatDay(days[0]).slice(3) + ' bis ' + formatDay(days[6]).slice(3) + ')', ''];
    days.forEach(function (d) {
      const meals = (state.plan[d] || []).map(function (m) {
        const r = byId[m.recipeId];
        return r ? r.name + ' (' + m.servings + ' P.)' : m.text;
      }).filter(Boolean);
      lines.push(formatDay(d) + ': ' + (meals.length ? meals.join(', ') : 'offen'));
    });
    return lines.join('\n');
  }

  function recipeToText(r) {
    const lines = [r.name + ' (' + r.servings + ' Personen)'];
    if (r.tags && r.tags.length) lines.push('Stichwörter: ' + r.tags.join(', '));
    lines.push('', 'Zutaten:');
    (r.ingredients || []).forEach(function (i) { lines.push(itemLine(i)); });
    if (r.notes) lines.push('', 'Zubereitung:', r.notes);
    if (r.link) lines.push('', 'Link: ' + r.link);
    return lines.join('\n');
  }

  // Liest geteilte Rezepte, abgetippte Rezepte und Texterkennung von Fotos (Kochbuch, Zeitschrift).
  // Erkennt Überschriften, wenn es welche gibt, sonst entscheidet die Form der Zeile:
  // kurze Zeilen mit Menge = Zutat, ganze Sätze = Zubereitung.
  const RX_ING_HEAD = /^zutaten\b/i;
  const RX_NOTES_HEAD = /^(zubereitung|so\s+geht'?s|und\s+so\s+geht'?s|anleitung|arbeitsschritte|schritte|vorgehen|notizen)\b\s*:?\s*$/i;
  const RX_SERVINGS = /(?:f(?:ü|u|ii)r|ergibt|reicht\s+f(?:ü|u)r)\s*(\d+)\s*(?:personen|portionen|pers\b|pers\.)|\(?\b(\d+)\s*(?:personen|portionen)\b\)?/i;

  const RX_QTY_TOKEN = /^(?:\d+(?:[.,]\d+)?|\d*[½¼¾⅓⅔]|\d+\/\d+)$/;
  const KEEP_SHORT = /^(g|kg|l|dl|cl|ml|EL|TL|KL|°C|Min\.?|Std\.?|cm)[,.]?$/;

  // Typische Lesefehler der Texterkennung bei Mengen korrigieren
  function fixOcrQuantities(l) {
    l = l.replace(/^(?:%|Y%|Y2|Yz|Ya|y2|1\/2)\s*(?=\S)/, '½ ');               // ½ wird oft als % gelesen
    l = l.replace(/^[TIl|](?=\s?(?:EL|TL|KL)\b)/, '1');                        // «TEL» -> «1EL»
    l = l.replace(/^(\d+)[ı|!]+(?=\s)/, '$1');                            // «1ı Zwiebel»
    l = l.replace(/^[lI](?=\s+[^\d\s])/, '1');                                // alleinstehendes l/I -> 1
    l = l.replace(/(^|\s)[TI]EL(?=\s)/g, '$11EL');                              // «TEL» mitten in der Zeile
    l = l.replace(/^(\d+(?:,\d+)?|½|¼|¾)\s*(EL|TL|KL|dl|cl|ml)(?=[A-ZÄÖÜa-zäöü]{3,})/, '$1 $2 '); // «1ELneutrales»
    l = l.replace(/^(\d+)\s*[.,]\s*(\d)\b/, '$1,$2');
    l = l.replace(/^(\d+(?:,\d+)?)\s+[1Il|]\s+(?=[A-ZÄÖÜ])/, '$1 l ');          // «1 1 Bouillon» -> «1 l Bouillon»
    // «909 1809 Butter» / «409g 809g» : 9 am Ende einer Menge ist meist ein g
    const tk = l.split(' ');
    if (tk.length > 2 && /^\d+[9g]g?$/.test(tk[0]) && /^\d+[9g]g?$/.test(tk[1]) && /[9g]$/.test(tk[0] + tk[1])) {
      for (let i = 0; i < 2; i++) tk[i] = tk[i].replace(/9g$/, 'g').replace(/^(\d+)9$/, '$1g');
      l = tk.join(' ');
    }
    l = l.replace(/^(\d+)9g\b/, '$1g');
    return l;
  }

  function cleanOcrLine(raw) {
    let l = String(raw || '').replace(/\t/g, ' ').replace(/[‘’‚“”„]/g, '').replace(/\s+/g, ' ').trim();
    l = l.replace(/^[•·▪■□☐–—*+\-»«>]+\s*/, '');
    l = l.replace(/^(?:[^A-Za-zÄÖÜäöü0-9½¼¾%\s]+\s+)+/, '');                     // «| », «© » vorne weg
    l = fixOcrQuantities(l);
    // Fetzen am Anfang und Ende (Nachbarseite, Schatten) entfernen
    let tk = l.split(' ');
    while (tk.length > 1 && !/[0-9½¼¾]/.test(tk[0]) && (tk[0].replace(/[^A-Za-zÄÖÜäöüß]/g, '').length <= 1)) tk.shift();
    while (tk.length > 1) {
      const t = tk[tk.length - 1];
      const letters = t.replace(/[^A-Za-zÄÖÜäöüß]/g, '').length;
      if (KEEP_SHORT.test(t) || letters >= 3 || /^[A-ZÄÖÜ][a-zäöüß][,.)]?$/.test(t) || (/^\d/.test(t) && tk.length <= 2)) break;
      tk.pop();
    }
    l = tk.join(' ');
    return fixOcrQuantities(l);
  }
  // Zeile ohne ein einziges richtiges Wort ist Rauschen
  function isNoise(l) {
    return !/[A-Za-zÄÖÜäöüß]{3,}/.test(l) && !/^[\d½¼¾]/.test(l);
  }

  function wordCount(l) { return l.split(/\s+/).filter(Boolean).length; }
  function looksLikeSentence(l) {
    if (/[.!?]$/.test(l) || /[.!?]\s+[A-ZÄÖÜ]/.test(l) || wordCount(l) > 8) return true;
    if (/^\d+[.)]\s+\S+(\s+\S+){3,}/.test(l)) return true;      // nummerierter Arbeitsschritt
    const p = parseIngredientLine(l);
    return !(p && p.qty != null) && wordCount(l) > 6;             // lange Zeile ohne Menge
  }
  function looksLikeIngredient(l) {
    if (!l || looksLikeSentence(l)) return false;
    const p = parseIngredientLine(l);
    if (p && p.qty != null) return wordCount(l) <= 8;
    return wordCount(l) <= 4 && !/:$/.test(l);
  }
  function splitPlainIngredients(l) {
    // «Salz, Pfeffer, Muskat» ohne Mengen in einzelne Zutaten aufteilen
    if (/\d/.test(l) || l.indexOf(',') < 0) return [l];
    return l.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function joinNotes(lines) {
    const out = [];
    let cur = '';
    lines.forEach(function (l) {
      if (!l) { if (cur) { out.push(cur); cur = ''; } return; }
      if (/^\d+[.)]\s/.test(l) && cur) { out.push(cur); cur = l; return; }
      if (!cur) cur = l;
      else if (/[a-zäöü]-$/.test(cur)) cur = cur.slice(0, -1) + l; // Worttrennung am Zeilenende
      else cur += ' ' + l;
    });
    if (cur) out.push(cur);
    return out.join('\n\n');
  }

  // Wörter, mit denen in Tabellen-Rezepten (z.B. Betty Bossi) die Anleitung neben der Zutat beginnt
  const INSTR_START = /^(in|mit|bis|auf|darauf|darüber|dazu|dazugeben|dazugiessen|beigeben|zugeben|unter|fein|grob|zusammen|alles|nach|von|im|ins|am|zum|zur|kurz|gut|mischen|rühren|verrühren|hacken|schneiden|schälen|waschen|geben|zerlassen|schmelzen)$/i;

  function hasQty(l) { const p = parseIngredientLine(l); return !!(p && p.qty != null); }

  // Zutatenzeilen aufräumen: umbrochene Zeilen zusammenführen, zweite Mengenspalte weglassen,
  // Anleitungstext neben der Zutat abtrennen (kommt in die Zubereitung)
  function processIngredientLines(lines) {
    const merged = [];
    lines.forEach(function (l) {
      const prev = merged[merged.length - 1];
      const opens = prev ? (prev.match(/\(/g) || []).length - (prev.match(/\)/g) || []).length : 0;
      const prevLast = prev ? prev.split(' ').pop() : '';
      const continuation = prev && !hasQty(l) && (
        /^[a-zäöü(]/.test(l) || opens > 0 || /[,(]$/.test(prev) ||
        (/^[a-zäöü]/.test(prevLast) && !/^\d/.test(prevLast) && hasQty(prev)));
      if (continuation) merged[merged.length - 1] = prev + ' ' + l;
      else merged.push(l);
    });
    const split = [];
    merged.forEach(function (l) { if (hasQty(l)) split.push(l); else splitPlainIngredients(l).forEach(function (x) { split.push(x); }); });
    merged.length = 0; Array.prototype.push.apply(merged, split);
    const out = [], tails = [];
    merged.forEach(function (l) {
      // zweite Mengenspalte: «90 g 180 g weiche Butter» -> «90 g weiche Butter»
      let m = l.match(/^(\S+(?:\s(?:g|kg|dl|cl|ml|l|EL|TL|KL|Prisen?|Stk)\b)?)\s+(\d+(?:[.,]\d+)?[½¼¾]?\s?(?:g|kg|dl|cl|ml|l|EL|TL|KL|Prisen?|Stk)?)\s+(\S.*)$/);
      if (m && hasQty(m[1] + ' x') && RX_QTY_TOKEN.test(m[2].replace(/\s?[A-Za-z]+$/, ''))) l = m[1] + ' ' + m[3];
      const p = parseIngredientLine(l);
      if (p && p.qty != null && INSTR_START.test(p.name.split(' ')[0])) { tails.push(p.name); return; } // «2 in Form füllen» ist keine Zutat
      if (p && p.qty != null) {
        const words = p.name.split(' ');
        for (let i = 1; i < words.length; i++) {
          const w = words[i].replace(/[,.;:]$/, '');
          const prevWord = words[i - 1];
          if ((INSTR_START.test(w) || /,$/.test(prevWord) && /^[a-zäöü]/.test(w)) && /^[A-ZÄÖÜ]/.test(prevWord.replace(/^[(]/, ''))) {
            const tail = words.slice(i).join(' ').replace(/^,\s*/, '');
            const head = words.slice(0, i).join(' ').replace(/,$/, '');
            // Zubereitungshinweise wie «gerieben» oder «in feine Ringe geschnitten» bleiben bei der Zutat
            if (/^(in|fein|grob)\b.*(geschnitten|gehackt|gewürfelt|gerissen|gerieben)$/.test(tail) || /^(ge[a-zäöü]+|[a-zäöü]+iert)$/.test(tail)) break;
            l = l.slice(0, l.length - p.name.length) + head;
            tails.push(tail);
            break;
          }
        }
      }
      out.push(l);
    });
    return { lines: out, tails: tails };
  }

  function cleanLines(text) {
    return String(text || '').replace(/\r/g, '').split('\n').map(cleanOcrLine);
  }
  // Für Ausschnitte aus dem Foto: der Nutzer sagt, was es ist
  function cleanIngredientBlock(text) {
    let servings = null;
    const lines = cleanLines(text).filter(function (l) {
      if (!l || isNoise(l)) return false;
      const sv = l.match(RX_SERVINGS);
      if (sv && wordCount(l) <= 5) { servings = Number(sv[1] || sv[2]); return false; }
      return !RX_ING_HEAD.test(l) && !(/:$/.test(l) && wordCount(l) <= 5);
    });
    const res = processIngredientLines(lines);
    return { text: res.lines.join('\n'), notes: res.tails.join('\n'), servings: servings };
  }
  function cleanNotesBlock(text) {
    return joinNotes(cleanLines(text).map(function (l) { return l && isNoise(l) ? null : l; })
      .filter(function (l) { return l !== null && !RX_NOTES_HEAD.test(l) && !/^(seite\s*)?\d{1,3}$/i.test(l); }));
  }
  function cleanTitleBlock(text) {
    let servings = null;
    const parts = cleanLines(text).filter(function (l) {
      if (!l || isNoise(l)) return false;
      const sv = l.match(RX_SERVINGS);
      if (sv) { servings = Number(sv[1] || sv[2]); return l.replace(RX_SERVINGS, '').trim().length > 2; }
      return true;
    }).map(function (l) { return l.replace(RX_SERVINGS, '').replace(/[\s(),:-]+$/, '').trim(); });
    return { name: parts.join(' ').replace(/\s+/g, ' ').trim(), servings: servings };
  }

  function parseRecipeText(text, overrides) {
    const r = { name: '', servings: null, tags: [], ingredientsText: '', notes: '', link: '' };
    const lines = cleanLines(text);
    const ing = [], notes = [];
    let section = 'head', nameOpen = false;
    lines.forEach(function (line) {
      let m;
      if (!line) { nameOpen = false; if (section === 'notes') notes.push(''); return; }
      if (isNoise(line) || /^(seite\s*)?\d{1,3}$/i.test(line)) return;
      if ((m = line.match(/^stichw(?:ö|oe)rter\s*:\s*(.*)$/i))) {
        r.tags = m[1].split(',').map(function (t) { return t.trim(); }).filter(Boolean); return;
      }
      if ((m = line.match(/^link\s*:\s*(\S+)/i))) { r.link = m[1]; return; }
      const sv = line.match(RX_SERVINGS);
      if (RX_ING_HEAD.test(line)) {
        if (sv && !r.servings) r.servings = Number(sv[1] || sv[2]);
        section = 'ing'; nameOpen = false; return;
      }
      if (RX_NOTES_HEAD.test(line)) { section = 'notes'; nameOpen = false; return; }
      if (sv && wordCount(line) <= 5 && !(section === 'head' && !r.name && line.replace(RX_SERVINGS, '').trim().length > 2)) {
        if (!r.servings) r.servings = Number(sv[1] || sv[2]);
        nameOpen = false; return;
      }
      if (section === 'head') {
        if (!r.name) {
          if (!hasQty(line) && line.length >= 3 && line.length <= 80) {
            if (sv) { r.servings = Number(sv[1] || sv[2]); line = line.replace(RX_SERVINGS, '').replace(/[\s(),:-]+$/, '').trim(); }
            r.name = line; nameOpen = true;
            return;
          }
        } else if (nameOpen && !hasQty(line) && wordCount(line) <= 4 && /^[A-ZÄÖÜ]/.test(line) && (r.name + line).length <= 80) {
          r.name += ' ' + line; // Titel über zwei Zeilen
          return;
        }
        nameOpen = false;
        if (looksLikeIngredient(line)) section = 'ing';
        else { notes.push(line); return; } // Einleitungstext
      }
      if (section === 'ing') {
        if (/:$/.test(line) && wordCount(line) <= 5) return; // Zwischentitel wie «Für die Sauce:»
        if (looksLikeSentence(line) && !hasQty(line)) { section = 'notes'; notes.push(line); return; }
        if (looksLikeSentence(line) && hasQty(line) && !processIngredientLines([line]).tails.length) { section = 'notes'; notes.push(line); return; }
        ing.push(line);
        return;
      }
      // Tabellen-Rezepte: nach einer Anleitungszeile kann wieder eine Zutat kommen
      if (hasQty(line) && (!looksLikeSentence(line) || processIngredientLines([line]).tails.length)) {
        const p = parseIngredientLine(line);
        if (!/^(min|std|°|grad|cm|minuten|stunden)/i.test(p.name) && !INSTR_START.test(p.name.split(' ')[0])) { ing.push(line); section = 'ing'; return; }
      }
      notes.push(line);
    });
    const res = processIngredientLines(ing);
    r.ingredientsText = res.lines.join('\n');
    r.notes = [res.tails.join('\n'), joinNotes(notes)].filter(Boolean).join('\n\n').trim();
    return r;
  }

  const api = {
    toISO, fromISO, addDays, mondayOf, weekDays, daysBetween, formatDay, isoWeekNumber,
    parseNumber, parseIngredientLine, parseIngredients, ingredientsToText,
    normName, mergeKey, guessCategory, toBase, fromBase, formatNumber, formatQty, roundForShopping,
    lastUsedMap, suggestRecipes, buildShoppingFromPlan, mergeShopping, groupByCategory,
    itemKey, shoppingToText, parseShoppingText, planToText, recipeToText, parseRecipeText,
    shortName, cleanIngredientBlock, cleanNotesBlock, cleanTitleBlock
  };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Logic = api;
})(typeof window !== 'undefined' ? window : this);
