(function(){
  const STORAGE_KEY = 'btg_prefab_language_v1';
  const LANGS = {
    sv: { flag:'🇸🇪', label:'Svenska' },
    en: { flag:'🇬🇧', label:'English' },
    pl: { flag:'🇵🇱', label:'Polski' }
  };

  const dict = {
    en: {
      'Prefabkö': 'Prefab queue',
      'Prefabkö / interna betongbeställningar': 'Prefab queue / internal concrete orders',
      'För fabrikspersonal som vill lägga beställningar när t.ex. ett bord är färdigformat.': 'For factory staff placing orders when, for example, a casting table is ready.',
      'Lägg beställning': 'Create order',
      'Datum': 'Date',
      'Hållfasthet': 'Strength class',
      'Mängd (m³)': 'Quantity (m³)',
      'VCT': 'W/C ratio',
      'Littra / ritningsnr': 'Mark / drawing no.',
      'Bord': 'Table',
      'Beställare': 'Requested by',
      'Exponeringsklasser': 'Exposure classes',
      'Notering': 'Note',
      'Skicka beställning': 'Submit order',
      'Uppdatera kö': 'Refresh queue',
      'Kölista': 'Queue list',
      'Ingen kö laddad.': 'No queue loaded.',
      'Skapad': 'Created',
      'Status': 'Status',
      'Exponering': 'Exposure',
      'Mängd': 'Quantity',
      'Littra/ritning': 'Mark/drawing',
      'Sats-ID': 'Batch ID',
      'Recept': 'Recipe',
      'GWP': 'GWP',
      'PDF': 'PDF',
      'Bekräfta': 'Confirm',
      'Klar': 'Done',
      'Ta bort': 'Delete',
      'Endast visning': 'View only',
      'Ny': 'New',
      'Bekräftad': 'Confirmed',
      'Avbruten': 'Cancelled',
      'Ingen fabrik vald.': 'No factory selected.',
      'Skapa eller anslut till en fabrik för att visa kön.': 'Create or join a factory to view the queue.',
      'Inga beställningar ännu.': 'No orders yet.',
      'Logga in för att använda prefabkön.': 'Sign in to use the prefab queue.',
      'Fabriksnamn': 'Factory name',
      'Skapa fabrik för mitt konto': 'Create factory for my account',
      'Fabrikskod': 'Factory code',
      'Anslut till fabrik': 'Join factory',
      'Din roll:': 'Your role:',
      'Markera prefab-beställning som klar': 'Mark prefab order as done',
      'Använt recept': 'Used recipe',
      'Välj recept för att beräkna VCT/VCTekv/GWP.': 'Select a recipe to calculate W/C, equivalent W/C and GWP.',
      'Spara klar': 'Save as done',
      'Avbryt': 'Cancel',
      'Stäng': 'Close',
      'Inkomna beställningar': 'Incoming orders',
      'Öppna prefabkö': 'Open prefab queue',
      'Ingen fabrik kopplad ännu.': 'No factory connected yet.'
    },
    pl: {
      'Prefabkö': 'Kolejka prefab',
      'Prefabkö / interna betongbeställningar': 'Kolejka prefab / wewnętrzne zamówienia betonu',
      'För fabrikspersonal som vill lägga beställningar när t.ex. ett bord är färdigformat.': 'Dla pracowników produkcji składających zamówienia, np. gdy stół jest gotowy.',
      'Lägg beställning': 'Dodaj zamówienie',
      'Datum': 'Data',
      'Hållfasthet': 'Klasa wytrzymałości',
      'Mängd (m³)': 'Ilość (m³)',
      'VCT': 'W/C',
      'Littra / ritningsnr': 'Oznaczenie / nr rysunku',
      'Bord': 'Stół',
      'Beställare': 'Zamawiający',
      'Exponeringsklasser': 'Klasy ekspozycji',
      'Notering': 'Notatka',
      'Skicka beställning': 'Wyślij zamówienie',
      'Uppdatera kö': 'Odśwież kolejkę',
      'Kölista': 'Lista kolejki',
      'Ingen kö laddad.': 'Kolejka nie została załadowana.',
      'Skapad': 'Utworzono',
      'Status': 'Status',
      'Exponering': 'Ekspozycja',
      'Mängd': 'Ilość',
      'Littra/ritning': 'Oznaczenie/rysunek',
      'Sats-ID': 'ID partii',
      'Recept': 'Receptura',
      'GWP': 'GWP',
      'PDF': 'PDF',
      'Bekräfta': 'Potwierdź',
      'Klar': 'Gotowe',
      'Ta bort': 'Usuń',
      'Endast visning': 'Tylko podgląd',
      'Ny': 'Nowe',
      'Bekräftad': 'Potwierdzone',
      'Avbruten': 'Anulowane',
      'Ingen fabrik vald.': 'Nie wybrano fabryki.',
      'Skapa eller anslut till en fabrik för att visa kön.': 'Utwórz lub dołącz do fabryki, aby zobaczyć kolejkę.',
      'Inga beställningar ännu.': 'Brak zamówień.',
      'Logga in för att använda prefabkön.': 'Zaloguj się, aby używać kolejki prefab.',
      'Fabriksnamn': 'Nazwa fabryki',
      'Skapa fabrik för mitt konto': 'Utwórz fabrykę dla mojego konta',
      'Fabrikskod': 'Kod fabryki',
      'Anslut till fabrik': 'Dołącz do fabryki',
      'Din roll:': 'Twoja rola:',
      'Markera prefab-beställning som klar': 'Oznacz zamówienie prefab jako gotowe',
      'Använt recept': 'Użyta receptura',
      'Välj recept för att beräkna VCT/VCTekv/GWP.': 'Wybierz recepturę, aby obliczyć W/C, W/C ekw. i GWP.',
      'Spara klar': 'Zapisz jako gotowe',
      'Avbryt': 'Anuluj',
      'Stäng': 'Zamknij',
      'Inkomna beställningar': 'Przychodzące zamówienia',
      'Öppna prefabkö': 'Otwórz kolejkę prefab',
      'Ingen fabrik kopplad ännu.': 'Brak połączonej fabryki.'
    }
  };

  const svText = {};
  Object.keys(dict.en).forEach(k => svText[k] = k);

  function currentLang(){ return localStorage.getItem(STORAGE_KEY) || 'sv'; }
  function baseText(s){
    const val = String(s || '').trim();
    if (!val) return val;
    for (const lang of ['en','pl']){
      for (const [sv, translated] of Object.entries(dict[lang])){
        if (val === translated) return sv;
      }
    }
    return val;
  }
  function translateText(s, lang){
    const sv = baseText(s);
    if (lang === 'sv') return sv;
    return dict[lang]?.[sv] || sv;
  }

  function ensureLanguageBar(){
    const section = document.getElementById('tab-prefab');
    if (!section || section.querySelector('#prefabLanguageBar')) return;
    const firstCard = section.querySelector('.card');
    if (!firstCard) return;
    const bar = document.createElement('div');
    bar.id = 'prefabLanguageBar';
    bar.className = 'prefab-language-bar';
    bar.innerHTML = Object.entries(LANGS).map(([key, cfg]) =>
      `<button type="button" class="prefab-lang-btn" data-prefab-lang="${key}" title="${cfg.label}">${cfg.flag}</button>`
    ).join('');
    firstCard.insertBefore(bar, firstCard.firstChild);
    bar.addEventListener('click', (e)=>{
      const btn = e.target.closest('[data-prefab-lang]');
      if (!btn) return;
      localStorage.setItem(STORAGE_KEY, btn.dataset.prefabLang);
      applyPrefabLanguage();
    });
  }

  function translateElementText(el, lang){
    if (!el || el.closest('#prefabLanguageBar')) return;
    // Only simple text nodes, not cells with data values mixed into them.
    if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE){
      const original = el.textContent.trim();
      const translated = translateText(original, lang);
      if (translated !== original) el.textContent = translated;
    }
  }

  function applyPrefabLanguage(){
    const section = document.getElementById('tab-prefab');
    const dash = document.getElementById('prefabDashboardCard');
    const dlg = document.getElementById('prefabCompleteDialog');
    const lang = currentLang();
    ensureLanguageBar();

    document.querySelectorAll('#prefabLanguageBar .prefab-lang-btn').forEach(btn => {
      btn.setAttribute('aria-pressed', btn.dataset.prefabLang === lang ? 'true' : 'false');
    });

    [section, dash, dlg].filter(Boolean).forEach(root => {
      root.querySelectorAll('h3,label,button,th,span.pill,small,td').forEach(el => translateElementText(el, lang));
      root.querySelectorAll('input[placeholder]').forEach(inp => {
        const p = inp.getAttribute('placeholder');
        if (p) inp.setAttribute('placeholder', translateText(p, lang));
      });
      root.querySelectorAll('option').forEach(opt => translateElementText(opt, lang));
    });

    // Target a few longer text blocks/pills safely.
    const intro = section?.querySelector('.card p.pill');
    if (intro) intro.textContent = translateText(intro.textContent, lang);
  }

  function boot(){
    ensureLanguageBar();
    applyPrefabLanguage();
    const obs = new MutationObserver(()=>{
      clearTimeout(window.__prefabLangTimer);
      window.__prefabLangTimer = setTimeout(applyPrefabLanguage, 80);
    });
    obs.observe(document.body, { childList:true, subtree:true });
    window.applyPrefabLanguage = applyPrefabLanguage;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=>setTimeout(boot, 300));
  else setTimeout(boot, 300);
})();
