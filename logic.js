/* Reine Logik ohne Bildschirm: Datum, Zutaten-Parser, Kategorien, Vorschläge, Einkaufsliste.
   Im Browser global verfügbar, in Node per require() testbar. */

(function (root) {
  const D = (typeof module !== 'undefined') ? require('./data.js') : { UNITS: UNITS, CATEGORY_KEYWORDS: CATEGORY_KEYWORDS };

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
    let m = s.match(/^((?:\d+\s*\/\s*\d+)|(?:\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?)|[½¼¾⅓⅔])\s*(.*)$/);
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
        const hit = k.length <= 3 ? words.indexOf(k) >= 0 : n.indexOf(k) >= 0;
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
  const SMALL_UNITS = ['EL', 'TL', 'Msp', 'Prise', 'Zehe', 'Zweig', 'Handvoll', 'Scheibe', 'Tasse', 'mg'];
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
          const key = mergeKey(ing.name) + '|' + b.unit;
          if (!byKey[key]) {
            byKey[key] = { key: key, name: ing.name, qty: null, unit: b.unit, cat: ing.cat || guessCategory(ing.name, state.settings && state.settings.catOverrides), from: [] };
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

  const api = {
    toISO, fromISO, addDays, mondayOf, weekDays, daysBetween, formatDay, isoWeekNumber,
    parseNumber, parseIngredientLine, parseIngredients, ingredientsToText,
    normName, mergeKey, guessCategory, toBase, fromBase, formatNumber, formatQty, roundForShopping,
    lastUsedMap, suggestRecipes, buildShoppingFromPlan, mergeShopping, groupByCategory
  };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Logic = api;
})(typeof window !== 'undefined' ? window : this);
