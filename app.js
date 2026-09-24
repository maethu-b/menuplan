/* Menüplan: Bildschirme und Bedienung. Logik liegt in logic.js, Stammdaten in data.js. */
(function () {
  'use strict';
  const L = window.Logic;
  const STORE_KEY = 'menuplan.v1';
  const CAT = {};
  CATEGORIES.forEach(function (c) { CAT[c.id] = c; });

  const $ = function (sel) { return document.querySelector(sel); };
  const view = $('#view');
  const modal = $('#modal');

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function today() { return L.toISO(new Date()); }

  // ---------- Speicher (lokal auf dem Gerät) ----------
  function defaultState() {
    return { version: 1, recipes: [], plan: {}, shopping: [],
      settings: { people: 2, catOrder: CATEGORIES.map(function (c) { return c.id; }), catOverrides: {} } };
  }
  function normalize(s) {
    const d = defaultState();
    s = s || {};
    const out = {
      version: 1,
      recipes: Array.isArray(s.recipes) ? s.recipes : [],
      plan: s.plan && typeof s.plan === 'object' ? s.plan : {},
      shopping: Array.isArray(s.shopping) ? s.shopping : [],
      settings: Object.assign(d.settings, s.settings || {})
    };
    const order = (out.settings.catOrder || []).filter(function (id) { return CAT[id]; });
    CATEGORIES.forEach(function (c) { if (order.indexOf(c.id) < 0) order.push(c.id); });
    out.settings.catOrder = order;
    out.settings.catOverrides = out.settings.catOverrides || {};
    return out;
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? normalize(JSON.parse(raw)) : defaultState();
    } catch (e) { return defaultState(); }
  }
  let state = load();
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { toast('Speichern fehlgeschlagen'); }
    updateBadge();
  }

  const ui = {
    tab: 'plan', week: L.mondayOf(today()), search: '', tagFilter: [], suggestTags: [],
    suggestDay: null, edit: null, addCatTouched: false, wake: null
  };
  try { const t = localStorage.getItem('menuplan.tab'); if (t) ui.tab = t; } catch (e) { /* egal */ }

  // ---------- Hilfen ----------
  function recipesById() { const m = {}; state.recipes.forEach(function (r) { m[r.id] = r; }); return m; }
  function allTags() {
    const set = new Set();
    state.recipes.forEach(function (r) { (r.tags || []).forEach(function (t) { set.add(t); }); });
    return Array.from(set).sort(function (a, b) { return a.localeCompare(b, 'de'); });
  }
  function weekRecipeIds(monday) {
    const ids = [];
    L.weekDays(monday).forEach(function (d) {
      (state.plan[d] || []).forEach(function (m) { if (m.recipeId) ids.push(m.recipeId); });
    });
    return ids;
  }
  function lastText(recipeId) {
    const last = L.lastUsedMap(state.plan, today())[recipeId];
    if (!last) return 'noch nie gekocht';
    const n = L.daysBetween(last, today());
    return n === 0 ? 'zuletzt heute' : n === 1 ? 'zuletzt gestern' : 'zuletzt vor ' + n + ' Tagen';
  }
  function catOptions(selected) {
    return state.settings.catOrder.map(function (id) {
      return '<option value="' + id + '"' + (id === selected ? ' selected' : '') + '>' + esc(CAT[id].label) + '</option>';
    }).join('');
  }
  function ingText(i) { return (i.qty != null ? L.formatQty(i.qty, i.unit) + ' ' : (i.unit ? i.unit + ' ' : '')) + i.name; }
  function addMealTo(day, meal) {
    (state.plan[day] = state.plan[day] || []).push(Object.assign({ id: uid() }, meal));
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function updateBadge() {
    const n = state.shopping.filter(function (i) { return !i.checked; }).length;
    const b = $('#shopBadge');
    b.hidden = n === 0; b.textContent = n;
  }

  // ---------- Dialog (unten einfahrendes Blatt, Android-Zurück schliesst es) ----------
  let modalOpen = false;
  function openModal(title, html) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = html;
    $('#modalBody').scrollTop = 0;
    if (!modalOpen) {
      modal.hidden = false; modalOpen = true;
      history.pushState({ modal: 1 }, '');
    }
  }
  function closeModal(fromPop) {
    if (!modalOpen) return;
    modalOpen = false; modal.hidden = true; $('#modalBody').innerHTML = ''; ui.edit = null;
    if (!fromPop && history.state && history.state.modal) history.back();
  }
  window.addEventListener('popstate', function () { if (modalOpen) closeModal(true); });
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  $('#modalClose').addEventListener('click', function () { closeModal(); });

  // ---------- Bildschirme ----------
  function render() {
    document.querySelectorAll('.bottomnav button').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === ui.tab); });
    $('#viewTitle').textContent = { plan: 'Wochenplan', recipes: 'Rezepte', shop: 'Einkaufsliste' }[ui.tab];
    if (ui.tab === 'plan') view.innerHTML = renderPlan();
    else if (ui.tab === 'recipes') view.innerHTML = renderRecipes();
    else view.innerHTML = renderShop();
    updateBadge();
  }

  function renderPlan() {
    const days = L.weekDays(ui.week);
    const t = today();
    const byId = recipesById();
    let h = '<div class="weekbar">' +
      '<button class="icon-btn" data-a="week" data-d="-7" aria-label="Vorherige Woche">&#8249;</button>' +
      '<div style="text-align:center"><strong>KW ' + L.isoWeekNumber(ui.week) + '</strong>' +
      '<div class="muted">' + L.formatDay(days[0]).slice(3) + ' bis ' + L.formatDay(days[6]).slice(3) + '</div></div>' +
      '<button class="icon-btn" data-a="week" data-d="7" aria-label="Nächste Woche">&#8250;</button></div>';
    h += '<div class="btn-row">' + (ui.week !== L.mondayOf(t) ? '<button class="btn small" data-a="weekToday">Zur aktuellen Woche</button>' : '') +
      '<button class="btn small" data-a="sharePlan">Plan teilen</button></div>';
    h += '<div class="btn-row"><button class="btn soft" data-a="fillWeek">Woche füllen</button>' +
      '<button class="btn primary" data-a="genShop">Einkaufsliste erstellen</button></div>';
    if (!state.recipes.length) {
      h += '<div class="card empty">Noch keine Rezepte erfasst. Unter «Rezepte» deine Lieblingsgerichte eintragen, dann schlägt die App Menüs vor.<br><br>' +
        '<button class="btn primary" data-a="tab" data-tab="recipes">Zu den Rezepten</button></div>';
    }
    days.forEach(function (day) {
      const meals = state.plan[day] || [];
      const isToday = day === t;
      h += '<div class="card day' + (isToday ? ' today' : '') + '"><div class="day-head"><b>' + L.formatDay(day) + (isToday ? ' (heute)' : '') + '</b>' +
        '<div class="row"><button class="btn small soft" data-a="suggest" data-day="' + day + '">Vorschlag</button>' +
        '<button class="btn small" data-a="pick" data-day="' + day + '">+ Menü</button></div></div>';
      meals.forEach(function (m) {
        const r = byId[m.recipeId];
        const name = r ? r.name : (m.text || 'Gelöschtes Rezept');
        h += '<div class="meal"><div class="name"' + (r ? ' data-a="showRecipe" data-id="' + r.id + '"' : '') + '>' + esc(name) + '</div>';
        if (r) {
          h += '<div class="stepper"><button data-a="serv" data-day="' + day + '" data-mid="' + m.id + '" data-d="-1" aria-label="Weniger Portionen">&minus;</button>' +
            '<span>' + m.servings + ' P.</span>' +
            '<button data-a="serv" data-day="' + day + '" data-mid="' + m.id + '" data-d="1" aria-label="Mehr Portionen">+</button></div>';
        }
        h += '<button class="icon-btn" data-a="delMeal" data-day="' + day + '" data-mid="' + m.id + '" aria-label="Entfernen">&times;</button></div>';
      });
      if (!meals.length) h += '<div class="muted">Noch nichts geplant</div>';
      h += '</div>';
    });
    return h;
  }

  function renderRecipes() {
    const tags = allTags();
    let h = '<div class="row" style="margin-bottom:10px"><input type="search" id="recSearch" placeholder="Rezept oder Zutat suchen" value="' + esc(ui.search) + '">' +
      '<button class="btn" data-a="pasteRecipe">Einfügen</button><button class="btn primary" data-a="newRecipe">+ Neu</button></div>';
    if (tags.length) {
      h += '<div class="chips" style="margin-bottom:12px">' + tags.map(function (t) {
        return '<button class="chip' + (ui.tagFilter.indexOf(t) >= 0 ? ' on' : '') + '" data-a="recTag" data-tag="' + esc(t) + '">' + esc(t) + '</button>';
      }).join('') + '</div>';
    }
    return h + '<div id="recList">' + renderRecipeList() + '</div>';
  }

  function renderRecipeList() {
    if (!state.recipes.length) {
      return '<div class="empty">Noch keine Rezepte. Tippe auf «+ Neu» oder lade unter Einstellungen (Zahnrad) die Beispielrezepte.</div>';
    }
    const q = L.normName(ui.search);
    const list = state.recipes.filter(function (r) {
      if (!ui.tagFilter.every(function (t) { return (r.tags || []).indexOf(t) >= 0; })) return false;
      if (!q) return true;
      if (L.normName(r.name).indexOf(q) >= 0) return true;
      return (r.ingredients || []).some(function (i) { return L.normName(i.name).indexOf(q) >= 0; });
    }).sort(function (a, b) {
      if (!!a.fav !== !!b.fav) return a.fav ? -1 : 1;
      return a.name.localeCompare(b.name, 'de');
    });
    if (!list.length) return '<div class="empty">Kein Rezept gefunden.</div>';
    return list.map(function (r) {
      return '<div class="card recipe"><button class="star' + (r.fav ? ' on' : '') + '" data-a="fav" data-id="' + r.id + '" aria-label="Favorit">&#9733;</button>' +
        '<div class="body" data-a="showRecipe" data-id="' + r.id + '"><div class="title">' + esc(r.name) + '</div>' +
        '<div class="muted">' + r.servings + ' Port. &middot; ' + (r.ingredients || []).length + ' Zutaten &middot; ' + lastText(r.id) + '</div>' +
        '<div>' + (r.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div></div></div>';
    }).join('');
  }

  function renderShop() {
    const items = state.shopping;
    let h = '<div class="addbar"><input type="text" id="addName" placeholder="Artikel hinzufügen, z.B. 2 l Milch" enterkeyhint="done" autocomplete="off">' +
      '<button class="btn primary" data-a="addItem" aria-label="Hinzufügen">+</button>' +
      '<select id="addCat" aria-label="Kategorie">' + catOptions('sonstiges') + '</select></div>' +
      '<div class="btn-row"><button class="btn small" data-a="shareShop"' + (items.some(function (i) { return !i.checked; }) ? '' : ' disabled') + '>Liste teilen</button>' +
      '<button class="btn small" data-a="pasteShop">Liste einfügen</button></div>';
    if (!items.length) {
      return h + '<div class="empty">Die Liste ist leer.<br>Im Wochenplan «Einkaufsliste erstellen» tippen oder oben eigene Artikel wie Abwaschmittel hinzufügen.</div>';
    }
    const done = items.filter(function (i) { return i.checked; }).length;
    h += '<div class="row"><span class="muted">' + done + ' von ' + items.length + ' erledigt</span><span class="spacer"></span>' +
      '<button class="btn small' + (ui.wake ? ' soft' : '') + '" data-a="wake">' + (ui.wake ? 'Bildschirm bleibt an' : 'Bildschirm anlassen') + '</button></div>' +
      '<div class="progress"><div style="width:' + Math.round(done / items.length * 100) + '%"></div></div>';
    const groups = L.groupByCategory(items, state.settings.catOrder);
    // Fertig abgehakte Kategorien ans Ende
    groups.sort(function (a, b) {
      const ad = a.items.every(function (i) { return i.checked; }), bd = b.items.every(function (i) { return i.checked; });
      return ad === bd ? 0 : ad ? 1 : -1;
    });
    groups.forEach(function (g) {
      const c = CAT[g.cat] || CAT.sonstiges;
      const open = g.items.filter(function (i) { return !i.checked; }).length;
      h += '<div class="cat-head"><i class="dot" style="background:' + c.color + '"></i>' + esc(c.label) +
        ' <span class="muted">' + (open ? open + ' offen' : 'erledigt') + '</span></div>';
      g.items.forEach(function (i) {
        const sub = [];
        if (i.qty != null) sub.push(esc(L.formatQty(i.qty, i.unit)));
        if (i.from && i.from.length) sub.push('für ' + esc(i.from.join(', ')));
        h += '<div class="item' + (i.checked ? ' done' : '') + '" data-a="toggle" data-id="' + i.id + '" role="checkbox" aria-checked="' + !!i.checked + '">' +
          '<div class="check">' + (i.checked ? '&#10003;' : '') + '</div>' +
          '<div class="txt"><div class="nm">' + esc(i.name) + '</div>' + (sub.length ? '<div class="qt">' + sub.join(' &middot; ') + '</div>' : '') + '</div>' +
          '<button class="icon-btn" data-a="editItem" data-id="' + i.id + '" aria-label="Bearbeiten">&#8943;</button></div>';
      });
    });
    h += '<div class="btn-row" style="margin-top:18px"><button class="btn" data-a="clearDone">Erledigte entfernen</button>' +
      '<button class="btn danger" data-a="clearAll">Alles löschen</button></div>';
    return h;
  }

  // ---------- Dialoge ----------
  function openPicker(day) {
    openModal(L.formatDay(day) + ': Menü wählen',
      '<input type="search" id="pickSearch" placeholder="Rezept suchen">' +
      '<div id="pickList" style="margin-top:10px"></div>' +
      '<div class="card" style="margin-top:12px"><div class="muted" style="margin-bottom:6px">Ohne Rezept, z.B. «Resten» oder «Auswärts»</div>' +
      '<div class="row"><input type="text" id="pickFree" placeholder="Freier Eintrag"><button class="btn" data-a="addFree" data-day="' + day + '">OK</button></div></div>');
    ui.pickDay = day;
    drawPickList('');
  }
  function drawPickList(q) {
    q = L.normName(q);
    const list = state.recipes.filter(function (r) { return !q || L.normName(r.name).indexOf(q) >= 0; })
      .sort(function (a, b) { return a.name.localeCompare(b.name, 'de'); });
    $('#pickList').innerHTML = list.length ? list.map(function (r) {
      return '<button class="btn pick" style="margin-bottom:6px" data-a="addMeal" data-day="' + ui.pickDay + '" data-id="' + r.id + '">' + esc(r.name) +
        '<div class="muted">' + lastText(r.id) + '</div></button>';
    }).join('') : '<div class="muted">Kein Rezept gefunden. <button class="btn small" data-a="newRecipe">Neues Rezept erfassen</button></div>';
  }

  function openSuggest(day) {
    ui.suggestDay = day;
    openModal(L.formatDay(day) + ': Vorschläge', '');
    drawSuggest();
  }
  function drawSuggest() {
    const day = ui.suggestDay;
    const tags = allTags();
    const sugg = L.suggestRecipes(state, { count: 3, tags: ui.suggestTags, exclude: weekRecipeIds(L.mondayOf(day)) });
    let h = '';
    if (tags.length) {
      h += '<div class="muted" style="margin-bottom:6px">Filter</div><div class="chips" style="margin-bottom:12px">' + tags.map(function (t) {
        return '<button class="chip' + (ui.suggestTags.indexOf(t) >= 0 ? ' on' : '') + '" data-a="sugTag" data-tag="' + esc(t) + '">' + esc(t) + '</button>';
      }).join('') + '</div>';
    }
    if (!state.recipes.length) h += '<div class="empty">Zuerst ein paar Rezepte erfassen.</div>';
    else if (!sugg.length) h += '<div class="empty">Kein passendes Rezept, das diese Woche noch nicht geplant ist.</div>';
    sugg.forEach(function (r) {
      h += '<div class="card recipe"><div class="body"><div class="title">' + (r.fav ? '&#9733; ' : '') + esc(r.name) + '</div>' +
        '<div class="muted">' + lastText(r.id) + '</div><div>' + (r.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div></div>' +
        '<button class="btn primary small" data-a="addMeal" data-day="' + day + '" data-id="' + r.id + '">Wählen</button></div>';
    });
    if (sugg.length) h += '<div class="btn-row"><button class="btn" data-a="reroll">Andere Vorschläge</button></div>';
    $('#modalBody').innerHTML = h;
  }

  function showRecipe(id) {
    const r = recipesById()[id];
    if (!r) return;
    let h = '<div class="muted">' + r.servings + ' Portionen &middot; ' + lastText(r.id) + '</div>' +
      '<div style="margin:4px 0 12px">' + (r.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
      '<h3 style="margin:8px 0">Zutaten</h3><div class="ing-preview">' +
      (r.ingredients || []).map(function (i) {
        const c = CAT[i.cat] || CAT.sonstiges;
        return '<div class="ing"><i class="dot" style="background:' + c.color + '" title="' + esc(c.label) + '"></i><span>' + esc(ingText(i)) + '</span></div>';
      }).join('') + '</div>';
    if (r.notes) h += '<h3 style="margin:8px 0">Zubereitung</h3><div style="white-space:pre-wrap">' + esc(r.notes) + '</div>';
    if (r.link) h += '<p><a href="' + esc(r.link) + '" target="_blank" rel="noopener">Originalrezept öffnen</a></p>';
    h += '<div class="btn-row" style="margin-top:16px"><button class="btn primary" data-a="planRecipe" data-id="' + r.id + '">In Wochenplan</button>' +
      '<button class="btn" data-a="editRecipe" data-id="' + r.id + '">Bearbeiten</button>' +
      '<button class="btn" data-a="shareRecipe" data-id="' + r.id + '">Teilen</button>' +
      '<button class="btn danger" data-a="delRecipe" data-id="' + r.id + '">Löschen</button></div>';
    openModal(r.name, h);
  }

  function planRecipe(id) {
    const r = recipesById()[id];
    const days = L.weekDays(ui.week);
    const byId = recipesById();
    let h = '<div class="muted" style="margin-bottom:8px">KW ' + L.isoWeekNumber(ui.week) + ': Tag wählen</div>';
    days.forEach(function (d) {
      const planned = (state.plan[d] || []).map(function (m) { return byId[m.recipeId] ? byId[m.recipeId].name : m.text; }).filter(Boolean).join(', ');
      h += '<button class="btn pick" style="margin-bottom:6px" data-a="addMeal" data-day="' + d + '" data-id="' + id + '">' + L.formatDay(d) +
        '<div class="muted">' + (planned ? esc(planned) : 'frei') + '</div></button>';
    });
    openModal(r.name + ': wann?', h);
  }

  function editRecipe(id, draft) {
    const src = id ? recipesById()[id] : null;
    const r = src ? JSON.parse(JSON.stringify(src)) : Object.assign({ id: null, name: '', servings: state.settings.people, tags: [], ingredients: [], notes: '', link: '', fav: false }, draft || {});
    ui.edit = { r: r, tags: new Set(r.tags || []), cats: {}, changed: new Set() };
    (r.ingredients || []).forEach(function (i) { ui.edit.cats[L.mergeKey(i.name)] = i.cat; });
    const tagPool = Array.from(new Set(DEFAULT_TAGS.concat(allTags(), r.tags || [])));
    const h = '<label class="field"><span>Name</span><input type="text" id="edName" value="' + esc(r.name) + '" placeholder="z.B. Spaghetti Bolognese"></label>' +
      '<label class="field"><span>Rezept ist für so viele Personen</span><input type="number" id="edServ" min="1" max="30" inputmode="numeric" value="' + r.servings + '"></label>' +
      '<div class="field"><span class="muted">Stichwörter (für Filter und Vorschläge)</span><div class="chips" id="edTags" style="margin:6px 0">' +
      tagPool.map(function (t) { return '<button class="chip' + (ui.edit.tags.has(t) ? ' on' : '') + '" data-a="edTag" data-tag="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') +
      '</div><div class="row"><input type="text" id="edNewTag" placeholder="Eigenes Stichwort"><button class="btn small" data-a="edAddTag">+</button></div></div>' +
      '<label class="field" style="margin-top:12px"><span>Zutaten, eine pro Zeile (z.B. «500 g Spaghetti», «1 Zwiebel», «Salz»)</span>' +
      '<textarea id="edIng" rows="8">' + esc(L.ingredientsToText(r.ingredients)) + '</textarea></label>' +
      '<div class="muted">Kategorie für die Einkaufsliste (wird erkannt, bei Bedarf ändern):</div>' +
      '<div class="ing-preview" id="edPrev" style="margin-top:6px"></div>' +
      '<label class="field"><span>Zubereitung / Notizen</span><textarea id="edNotes" rows="5">' + esc(r.notes) + '</textarea></label>' +
      '<label class="field"><span>Link zum Originalrezept (optional)</span><input type="url" id="edLink" value="' + esc(r.link) + '" placeholder="https://"></label>' +
      '<div class="btn-row"><button class="btn primary" data-a="saveRecipe">Speichern</button><button class="btn" data-a="close">Abbrechen</button></div>';
    openModal(src ? 'Rezept bearbeiten' : 'Neues Rezept', h);
    drawEditPreview();
  }
  function drawEditPreview() {
    const list = L.parseIngredients($('#edIng').value, state.settings.catOverrides);
    $('#edPrev').innerHTML = list.map(function (i) {
      const k = L.mergeKey(i.name);
      const cat = ui.edit.cats[k] || i.cat;
      return '<div class="ing"><span>' + esc(ingText(i)) + '</span><select data-k="' + esc(k) + '">' + catOptions(cat) + '</select></div>';
    }).join('') || '<div class="muted">Noch keine Zutaten</div>';
  }
  function saveRecipe() {
    const e = ui.edit;
    const name = $('#edName').value.trim();
    if (!name) { toast('Bitte einen Namen eingeben'); $('#edName').focus(); return; }
    e.changed.forEach(function (k) { state.settings.catOverrides[k] = e.cats[k]; });
    const ings = L.parseIngredients($('#edIng').value, state.settings.catOverrides).map(function (i) {
      const k = L.mergeKey(i.name);
      if (e.cats[k]) i.cat = e.cats[k];
      return i;
    });
    const r = e.r;
    r.name = name;
    r.servings = Math.max(1, parseInt($('#edServ').value, 10) || state.settings.people);
    r.tags = Array.from(e.tags);
    r.ingredients = ings;
    r.notes = $('#edNotes').value.trim();
    r.link = $('#edLink').value.trim();
    if (r.id) {
      state.recipes = state.recipes.map(function (x) { return x.id === r.id ? r : x; });
    } else {
      r.id = uid();
      state.recipes.push(r);
    }
    save();
    closeModal();
    render();
    toast('Rezept gespeichert');
  }

  function editItem(id) {
    const i = state.shopping.find(function (x) { return x.id === id; });
    if (!i) return;
    ui.editItemId = id;
    openModal('Artikel bearbeiten',
      '<label class="field"><span>Artikel</span><input type="text" id="itName" value="' + esc(i.name) + '"></label>' +
      '<label class="field"><span>Menge (z.B. «500 g», «2 Stk», leer lassen)</span><input type="text" id="itQty" value="' + esc(i.qty != null ? L.formatQty(i.qty, i.unit) : '') + '"></label>' +
      '<label class="field"><span>Kategorie</span><select id="itCat">' + catOptions(i.cat) + '</select></label>' +
      '<div class="muted" style="margin-bottom:12px">Eine geänderte Kategorie merkt sich die App für diesen Artikel.</div>' +
      '<div class="btn-row"><button class="btn primary" data-a="saveItem">Speichern</button><button class="btn danger" data-a="delItem">Löschen</button></div>');
  }

  function openSettings() {
    const h = '<label class="field"><span>Personen im Haushalt (Standard-Portionen im Plan)</span>' +
      '<input type="number" id="setPeople" min="1" max="20" inputmode="numeric" value="' + state.settings.people + '"></label>' +
      '<h3 style="margin:16px 0 4px">Reihenfolge im Laden</h3>' +
      '<div class="muted" style="margin-bottom:8px">So ist die Einkaufsliste sortiert. Ordne die Kategorien nach deinem Weg durch den Laden.</div>' +
      '<div class="card catorder" id="catOrder">' + catOrderHtml() + '</div>' +
      '<h3 style="margin:16px 0 4px">Daten</h3>' +
      '<div class="muted" style="margin-bottom:8px">Alle Daten liegen nur auf diesem Handy. Ein Backup schützt vor Verlust, z.B. beim Gerätewechsel auf das S26.</div>' +
      '<div class="btn-row"><button class="btn" data-a="export">Backup exportieren</button><button class="btn" data-a="importBtn">Backup importieren</button></div>' +
      '<input type="file" id="importFile" accept="application/json,.json" hidden>' +
      '<div class="btn-row"><button class="btn soft" data-a="samples">Beispielrezepte laden</button><button class="btn danger" data-a="wipe">Alle Daten löschen</button></div>' +
      '<p class="muted">Menüplan Version 1.1 &middot; ' + state.recipes.length + ' Rezepte</p>';
    openModal('Einstellungen', h);
  }
  function catOrderHtml() {
    const order = state.settings.catOrder;
    return order.map(function (id, idx) {
      const c = CAT[id];
      return '<div class="row"><i class="dot" style="background:' + c.color + '"></i><span class="spacer">' + esc(c.label) + '</span>' +
        '<button class="btn small" data-a="catMove" data-cat="' + id + '" data-d="-1"' + (idx === 0 ? ' disabled' : '') + ' aria-label="Nach oben">&#8593;</button>' +
        '<button class="btn small" data-a="catMove" data-cat="' + id + '" data-d="1"' + (idx === order.length - 1 ? ' disabled' : '') + ' aria-label="Nach unten">&#8595;</button></div>';
    }).join('');
  }

  // ---------- Teilen und Einfügen ----------
  async function shareText(title, text) {
    if (navigator.share) {
      try { await navigator.share({ title: title, text: text }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast('In die Zwischenablage kopiert. In WhatsApp einfügen.');
    } catch (e) {
      openModal(title, '<div class="muted" style="margin-bottom:6px">Text markieren und kopieren:</div><textarea rows="14" readonly>' + esc(text) + '</textarea>');
    }
  }
  function openPaste(kind) {
    ui.pasteKind = kind;
    const hint = kind === 'shop'
      ? 'Nachricht mit der Liste hier einfügen (lange tippen > Einfügen). Eine Zeile pro Artikel, z.B. «2 l Milch». Überschriften wie «Gemüse & Früchte:» werden als Kategorie übernommen.'
      : 'Geteiltes Rezept hier einfügen. Erste Zeile ist der Name, nach «Zutaten:» eine Zutat pro Zeile, nach «Zubereitung:» der Text.';
    openModal(kind === 'shop' ? 'Liste einfügen' : 'Rezept einfügen',
      '<div class="muted" style="margin-bottom:8px">' + hint + '</div>' +
      '<textarea id="pasteText" rows="12" placeholder="Hier einfügen"></textarea>' +
      '<div class="btn-row" style="margin-top:10px"><button class="btn primary" data-a="pasteApply">Übernehmen</button><button class="btn" data-a="close">Abbrechen</button></div>');
  }
  function applyPaste() {
    const text = $('#pasteText').value;
    if (!text.trim()) { toast('Zuerst Text einfügen'); return; }
    if (ui.pasteKind === 'shop') {
      const items = L.parseShoppingText(text, state.settings.catOverrides);
      const openKeys = new Set(state.shopping.filter(function (i) { return !i.checked; }).map(function (i) { return i.key; }));
      let n = 0;
      items.forEach(function (p) {
        const key = L.itemKey(p.name, p.unit);
        if (openKeys.has(key)) return; // steht schon offen auf der Liste
        openKeys.add(key);
        state.shopping.push({ id: uid(), key: key, name: p.name, qty: p.qty, unit: p.unit, cat: p.cat, from: [], source: 'manual', checked: false });
        n++;
      });
      save(); closeModal(); ui.tab = 'shop'; render();
      toast(n ? n + ' Artikel übernommen' : 'Nichts Neues, alles schon auf der Liste');
    } else {
      const d = L.parseRecipeText(text, state.settings.catOverrides);
      if (!d.name) { toast('Kein Rezeptname gefunden'); return; }
      const draft = { name: d.name, servings: d.servings || state.settings.people, tags: d.tags,
        ingredients: L.parseIngredients(d.ingredientsText, state.settings.catOverrides), notes: d.notes, link: d.link };
      editRecipe(null, draft);
      toast('Prüfen und speichern');
    }
  }

  // ---------- Bildschirm anlassen beim Einkaufen ----------
  async function toggleWake() {
    if (ui.wake) { try { await ui.wake.release(); } catch (e) { /* egal */ } ui.wake = null; render(); return; }
    if (!('wakeLock' in navigator)) { toast('Wird von diesem Browser nicht unterstützt'); return; }
    try {
      ui.wake = await navigator.wakeLock.request('screen');
      ui.wake.addEventListener('release', function () { if (ui.wake && ui.wake.released) { /* vom System beendet */ } });
      render();
    } catch (e) { toast('Bildschirm anlassen nicht möglich'); }
  }
  document.addEventListener('visibilitychange', async function () {
    if (document.visibilityState === 'visible' && ui.wake && ui.wake.released) {
      try { ui.wake = await navigator.wakeLock.request('screen'); } catch (e) { ui.wake = null; }
    }
  });

  // ---------- Aktionen (alle Klicks laufen hier durch) ----------
  const actions = {
    tab: function (el) { ui.tab = el.dataset.tab; try { localStorage.setItem('menuplan.tab', ui.tab); } catch (e) { /* egal */ } render(); window.scrollTo(0, 0); },
    close: function () { closeModal(); },

    // Wochenplan
    week: function (el) { ui.week = L.addDays(ui.week, Number(el.dataset.d)); render(); },
    weekToday: function () { ui.week = L.mondayOf(today()); render(); },
    pick: function (el) { openPicker(el.dataset.day); },
    suggest: function (el) { openSuggest(el.dataset.day); },
    reroll: function () { drawSuggest(); },
    sugTag: function (el) {
      const t = el.dataset.tag, i = ui.suggestTags.indexOf(t);
      if (i >= 0) ui.suggestTags.splice(i, 1); else ui.suggestTags.push(t);
      drawSuggest();
    },
    addMeal: function (el) {
      addMealTo(el.dataset.day, { recipeId: el.dataset.id, servings: state.settings.people });
      save(); closeModal(); ui.week = L.mondayOf(el.dataset.day); ui.tab = 'plan'; render();
      toast('Eingeplant: ' + L.formatDay(el.dataset.day));
    },
    addFree: function (el) {
      const txt = $('#pickFree').value.trim();
      if (!txt) return;
      addMealTo(el.dataset.day, { text: txt, servings: state.settings.people });
      save(); closeModal(); render();
    },
    serv: function (el) {
      const m = (state.plan[el.dataset.day] || []).find(function (x) { return x.id === el.dataset.mid; });
      if (!m) return;
      m.servings = Math.max(1, Math.min(30, (m.servings || 1) + Number(el.dataset.d)));
      save(); render();
    },
    delMeal: function (el) {
      const d = el.dataset.day;
      state.plan[d] = (state.plan[d] || []).filter(function (x) { return x.id !== el.dataset.mid; });
      if (!state.plan[d].length) delete state.plan[d];
      save(); render();
    },
    fillWeek: function () {
      if (!state.recipes.length) { toast('Zuerst Rezepte erfassen'); return; }
      const t = today();
      const used = weekRecipeIds(ui.week);
      let n = 0;
      L.weekDays(ui.week).forEach(function (d) {
        if (d < t || (state.plan[d] || []).length) return;
        const s = L.suggestRecipes(state, { count: 1, tags: ui.suggestTags, exclude: used });
        if (!s[0]) return;
        addMealTo(d, { recipeId: s[0].id, servings: state.settings.people });
        used.push(s[0].id); n++;
      });
      save(); render();
      toast(n ? n + ' Tage gefüllt. Nicht Passendes einfach entfernen.' : 'Keine freien Tage oder zu wenige Rezepte');
    },
    genShop: function () {
      const gen = L.buildShoppingFromPlan(state, L.weekDays(ui.week));
      if (!gen.length) { toast('Im Wochenplan sind noch keine Rezepte'); return; }
      const hasPlanItems = state.shopping.some(function (i) { return i.source === 'plan'; });
      if (hasPlanItems && !confirm('Die Artikel aus dem bisherigen Plan werden ersetzt. Eigene Artikel bleiben. Weiter?')) return;
      state.shopping = L.mergeShopping(state.shopping, gen, uid);
      save(); ui.tab = 'shop'; render(); window.scrollTo(0, 0);
      toast(gen.length + ' Artikel übernommen');
    },

    // Rezepte
    recTag: function (el) {
      const t = el.dataset.tag, i = ui.tagFilter.indexOf(t);
      if (i >= 0) ui.tagFilter.splice(i, 1); else ui.tagFilter.push(t);
      render();
    },
    fav: function (el) {
      const r = recipesById()[el.dataset.id];
      if (!r) return;
      r.fav = !r.fav; save(); $('#recList').innerHTML = renderRecipeList();
    },
    showRecipe: function (el) { showRecipe(el.dataset.id); },
    planRecipe: function (el) { planRecipe(el.dataset.id); },
    newRecipe: function () { editRecipe(null); },
    editRecipe: function (el) { editRecipe(el.dataset.id); },
    delRecipe: function (el) {
      const id = el.dataset.id;
      const r = recipesById()[id];
      if (!r || !confirm('Rezept «' + r.name + '» löschen?')) return;
      state.recipes = state.recipes.filter(function (x) { return x.id !== id; });
      Object.keys(state.plan).forEach(function (d) {
        state.plan[d].forEach(function (m) { if (m.recipeId === id) { m.text = r.name; delete m.recipeId; } });
      });
      save(); closeModal(); render();
    },
    edTag: function (el) {
      const t = el.dataset.tag;
      if (ui.edit.tags.has(t)) ui.edit.tags.delete(t); else ui.edit.tags.add(t);
      el.classList.toggle('on', ui.edit.tags.has(t));
    },
    edAddTag: function () {
      const inp = $('#edNewTag');
      const t = inp.value.trim();
      if (!t) return;
      ui.edit.tags.add(t);
      if (!document.querySelector('#edTags [data-tag="' + CSS.escape(t) + '"]')) {
        $('#edTags').insertAdjacentHTML('beforeend', '<button class="chip on" data-a="edTag" data-tag="' + esc(t) + '">' + esc(t) + '</button>');
      }
      inp.value = '';
    },
    saveRecipe: function () { saveRecipe(); },

    // Einkaufsliste
    toggle: function (el) {
      const i = state.shopping.find(function (x) { return x.id === el.dataset.id; });
      if (!i) return;
      i.checked = !i.checked;
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* egal */ } }
      save(); render();
    },
    addItem: function () { addItem(); },
    editItem: function (el) { editItem(el.dataset.id); },
    saveItem: function () {
      const i = state.shopping.find(function (x) { return x.id === ui.editItemId; });
      if (!i) return;
      const name = $('#itName').value.trim();
      if (!name) { toast('Bitte einen Namen eingeben'); return; }
      const qtyTxt = $('#itQty').value.trim();
      const p = qtyTxt ? L.parseIngredientLine(qtyTxt + ' ' + name) : null;
      const cat = $('#itCat').value;
      if (cat !== i.cat) state.settings.catOverrides[L.mergeKey(name)] = cat;
      i.name = name; i.cat = cat;
      i.qty = p && p.qty != null ? p.qty : null;
      i.unit = p && p.qty != null ? p.unit : '';
      save(); closeModal(); render();
    },
    delItem: function () {
      state.shopping = state.shopping.filter(function (x) { return x.id !== ui.editItemId; });
      save(); closeModal(); render();
    },
    clearDone: function () {
      const n = state.shopping.filter(function (i) { return i.checked; }).length;
      if (!n) { toast('Noch nichts abgehakt'); return; }
      state.shopping = state.shopping.filter(function (i) { return !i.checked; });
      save(); render(); toast(n + ' erledigte Artikel entfernt');
    },
    clearAll: function () {
      if (!confirm('Ganze Einkaufsliste löschen?')) return;
      state.shopping = []; save(); render();
    },
    wake: function () { toggleWake(); },
    shareShop: function () {
      shareText('Einkaufsliste', L.shoppingToText(state.shopping, state.settings.catOrder, 'Einkaufsliste ' + L.formatDay(today()).slice(3)));
    },
    pasteShop: function () { openPaste('shop'); },
    pasteRecipe: function () { openPaste('recipe'); },
    pasteApply: function () { applyPaste(); },
    sharePlan: function () { shareText('Wochenplan', L.planToText(state, ui.week)); },
    shareRecipe: function (el) {
      const r = recipesById()[el.dataset.id];
      if (r) shareText(r.name, L.recipeToText(r));
    },

    // Einstellungen
    catMove: function (el) {
      const o = state.settings.catOrder;
      const i = o.indexOf(el.dataset.cat), j = i + Number(el.dataset.d);
      if (i < 0 || j < 0 || j >= o.length) return;
      const tmp = o[i]; o[i] = o[j]; o[j] = tmp;
      save(); $('#catOrder').innerHTML = catOrderHtml();
    },
    export: function () {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'menuplan-backup-' + today() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      toast('Backup gespeichert (Ordner Downloads)');
    },
    importBtn: function () { $('#importFile').click(); },
    samples: function () {
      const names = new Set(state.recipes.map(function (r) { return L.normName(r.name); }));
      let n = 0;
      SAMPLE_RECIPES.forEach(function (s) {
        if (names.has(L.normName(s.name))) return;
        state.recipes.push({ id: uid(), name: s.name, servings: s.servings, tags: s.tags.slice(),
          ingredients: L.parseIngredients(s.ingredients, state.settings.catOverrides), notes: s.notes, link: '', fav: false });
        n++;
      });
      save(); closeModal(); render();
      toast(n ? n + ' Beispielrezepte geladen' : 'Beispielrezepte sind schon da');
    },
    wipe: function () {
      if (!confirm('Wirklich alle Rezepte, Pläne und die Einkaufsliste löschen?')) return;
      if (!confirm('Sicher? Das lässt sich nicht rückgängig machen.')) return;
      state = defaultState(); save(); closeModal(); render();
    }
  };

  function addItem() {
    const inp = $('#addName');
    const p = L.parseIngredientLine(inp.value);
    if (!p) return;
    const sel = $('#addCat');
    const cat = sel.value;
    if (ui.addCatTouched && cat !== L.guessCategory(p.name, state.settings.catOverrides)) {
      state.settings.catOverrides[L.mergeKey(p.name)] = cat;
    }
    state.shopping.push({ id: uid(), key: L.itemKey(p.name, p.unit), name: p.name, qty: p.qty, unit: p.qty != null ? p.unit : '',
      cat: cat, from: [], source: 'manual', checked: false });
    ui.addCatTouched = false;
    save(); render();
    const again = $('#addName'); if (again) again.focus();
    toast(p.name + ': ' + CAT[cat].label);
  }

  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-a]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.a];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.querySelectorAll('.bottomnav button').forEach(function (b) {
    b.addEventListener('click', function () { actions.tab(b); });
  });
  $('#btnSettings').addEventListener('click', openSettings);

  document.addEventListener('input', function (e) {
    const id = e.target.id;
    if (id === 'recSearch') { ui.search = e.target.value; $('#recList').innerHTML = renderRecipeList(); }
    else if (id === 'pickSearch') drawPickList(e.target.value);
    else if (id === 'edIng') drawEditPreview();
    else if (id === 'addName' && !ui.addCatTouched) {
      const p = L.parseIngredientLine(e.target.value);
      $('#addCat').value = p ? L.guessCategory(p.name, state.settings.catOverrides) : 'sonstiges';
    }
  });
  document.addEventListener('change', function (e) {
    const t = e.target;
    if (t.matches('#edPrev select')) { ui.edit.cats[t.dataset.k] = t.value; ui.edit.changed.add(t.dataset.k); }
    else if (t.id === 'addCat') ui.addCatTouched = true;
    else if (t.id === 'setPeople') { state.settings.people = Math.max(1, parseInt(t.value, 10) || 2); save(); }
    else if (t.id === 'importFile' && t.files[0]) {
      const reader = new FileReader();
      reader.onload = function () {
        try {
          const obj = JSON.parse(reader.result);
          if (!obj || !Array.isArray(obj.recipes)) throw new Error('format');
          if (!confirm('Backup mit ' + obj.recipes.length + ' Rezepten laden? Die aktuellen Daten werden ersetzt.')) return;
          state = normalize(obj); save(); closeModal(); render(); toast('Backup geladen');
        } catch (err) { toast('Datei ist kein gültiges Backup'); }
      };
      reader.readAsText(t.files[0]);
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'addName') { e.preventDefault(); addItem(); }
    else if (e.target.id === 'edNewTag') { e.preventDefault(); actions.edAddTag(); }
    else if (e.target.id === 'pickFree') { e.preventDefault(); actions.addFree({ dataset: { day: ui.pickDay } }); }
  });

  // ---------- Start ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* offline-Modus optional */ }); });
  }
  if (navigator.storage && navigator.storage.persist) { navigator.storage.persist().catch(function () { /* egal */ }); }
  render();
})();
