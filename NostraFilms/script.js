// ============================================================
// Configuración TMDb
// ============================================================
// Intermediario (Cloudflare Worker): agrega la clave de TMDb en el servidor, así no queda expuesta aquí
const BASE_URL = 'https://nostrafilms-api.walter-andre-silva-1991.workers.dev';
const IMG_BASE_URL = 'https://image.tmdb.org/t/p/w780';
const LOGO_BASE_URL = 'https://image.tmdb.org/t/p/w92';
const WATCH_REGION = 'AR'; // país para las plataformas (códigos ISO: AR, MX, ES, US...)
const BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w1280';

// Clima: Open-Meteo (gratis, sin clave)
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

// ============================================================
// Estado
// ============================================================
const genresMap = {};                 // id -> nombre (se llena al cargar los géneros)
const includedGenres = new Map();     // pestaña Categorías: incluidas (id -> nombre)
const excludedGenres = new Map();     // pestaña Categorías: excluidas (id -> nombre)
const results = {};                   // bloques de resultados por pestaña
const seenMovies = new Set();         // películas marcadas como "ya la vi" (se guardan en el navegador)
try { JSON.parse(localStorage.getItem('nostrafilms_seen') || '[]').forEach(id => seenMovies.add(id)); } catch (e) {}
function saveSeen() {
    try { localStorage.setItem('nostrafilms_seen', JSON.stringify([...seenMovies])); } catch (e) {}
}
let randomLoaded = false;
let randomToken = 0;
let detailToken = 0;

// ============================================================
// Configuración editable: estados de ánimo y clima -> géneros TMDb
// 28    Acción,
// 12    Aventura,
// 16    Animación,
// 35    Comedia,
// 80    Crimen,
// 99    Documental,
// 18    Drama,
// 10751 Familia,
// 14    Fantasía,
// 36    Historia,
// 27    Terror,
// 10402 Música,
// 9648  Misterio,
// 10749 Romance,
// 878   Ciencia ficción,
// 53    Suspense,
// 10752 Bélica
// "genres": la película debe tener TODAS a la vez. "avoid": categorías predefinidas a evitar
// ============================================================
const MOODS = [
    { id: 'happy',      emoji: '😄', label: 'Feliz',             genres: [35, 12],   avoid: [27, 53, 10752, 80, 18] },
{ id: 'sad',        emoji: '😢', label: 'Melancólico',       genres: [18, 10749],       avoid: [27, 28] },
{ id: 'energetic',  emoji: '🤩', label: 'Con energía',       genres: [28, 12, 878],     avoid: [99, 36] },
{ id: 'relaxed',    emoji: '😌', label: 'Relajado',          genres: [35, 10751, 12], avoid: [27, 53, 10752, 80] },
{ id: 'romantic',   emoji: '🥰', label: 'Romántico',         genres: [10749],           avoid: [27, 10752, 53, 28] },
{ id: 'thrill',     emoji: '😱', label: 'Quiero adrenalina', genres: [27, 53],          avoid: [10751, 16, 10402] },
{ id: 'thoughtful', emoji: '🤔', label: 'Reflexivo',         genres: [99],      avoid: [27, 16] },
{ id: 'curious',    emoji: '🕵️', label: 'Curioso',           genres: [9648, 80],    avoid: [10402, 10749, 10751] }
];

const WEATHER_TYPES = {
    sunny:  { emoji: '☀️',  label: 'Soleado',  genres: [12, 35, 16, 10751], avoid: [27, 53, 10752] },
    cloudy: { emoji: '☁️',  label: 'Nublado',  genres: [9648, 18, 53],      avoid: [16, 10402] },
    rain:   { emoji: '🌧️', label: 'Lluvioso', genres: [10749, 18],   avoid: [27, 28, 10752] },
    snow:   { emoji: '❄️',  label: 'Nevado',   genres: [10751, 14, 16],     avoid: [27, 53, 10752] },
    storm:  { emoji: '⛈️',  label: 'Tormenta', genres: [27, 53, 878],       avoid: [10751, 16, 10749] }
};

// Código WMO (Open-Meteo) -> tipo de clima
function weatherCodeToType(code) {
    if (code === 0 || code === 1) return 'sunny';
    if ([2, 3, 45, 48].includes(code)) return 'cloudy';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code >= 95 && code <= 99) return 'storm';
    return 'cloudy';
}

// ============================================================
// Clases de estilos
// ============================================================
const BTN_BASE = 'px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border ';
const BTN_NEUTRAL = BTN_BASE + 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white border-neutral-700';
const BTN_INCLUDE = BTN_BASE + 'bg-netflix-red text-white shadow-md border-netflix-red';
const BTN_EXCLUDE = BTN_BASE + 'bg-red-950 text-red-200 shadow-md border-red-700';
const BTN_DISABLED = BTN_BASE + 'bg-neutral-900 text-neutral-600 border-neutral-800 opacity-40 cursor-not-allowed';

const CHIP_BASE = 'flex items-center gap-2 rounded-xl border transition-all ';
const MOOD_NEUTRAL = CHIP_BASE + 'flex-col px-3 py-4 bg-neutral-800 border-neutral-700 hover:bg-neutral-700 text-neutral-200';
const MOOD_ACTIVE = CHIP_BASE + 'flex-col px-3 py-4 bg-netflix-red border-netflix-red text-white shadow-md';
const WEATHER_NEUTRAL = CHIP_BASE + 'px-4 py-2.5 bg-neutral-800 border-neutral-700 hover:bg-neutral-700 text-neutral-200';
const WEATHER_ACTIVE = CHIP_BASE + 'px-4 py-2.5 bg-netflix-red border-netflix-red text-white shadow-md';

const TAB_BASE = 'px-4 sm:px-5 py-3 rounded-xl text-sm font-semibold transition-all border flex items-center gap-2 whitespace-nowrap ';
const TAB_ACTIVE = TAB_BASE + 'bg-netflix-red text-white border-netflix-red shadow-md';
const TAB_INACTIVE = TAB_BASE + 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white border-neutral-800';

// ============================================================
// Elementos del DOM
// ============================================================
const includeContainer = document.getElementById('includeContainer');
const excludeContainer = document.getElementById('excludeContainer');
const matchMode = document.getElementById('matchMode');
const moodContainer = document.getElementById('moodContainer');
const weatherTypesContainer = document.getElementById('weatherTypes');
const weatherCityInput = document.getElementById('weatherCity');
const weatherStatus = document.getElementById('weatherStatus');
const weatherSummary = document.getElementById('weatherSummary');
const randomCard = document.getElementById('randomCard');

// ============================================================
// Utilidades
// ============================================================
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function genreNames(ids) {
    return ids.map(id => genresMap[id] || id).join(', ');
}

// Una película se muestra si ya se estrenó, no está vista y no tiene ningún género a evitar
function isShown(m, ctx, today) {
    if (!m.release_date || m.release_date > today || seenMovies.has(m.id)) return false;
    const banned = ctx.excludeIds || [];
    return !(m.genre_ids || []).some(id => banned.includes(id));
}

// Fecha local de hoy (YYYY-MM-DD) para descartar estrenos futuros
function todayStr() {
    return new Date().toLocaleDateString('en-CA');
}
function releasedParam() {
    return `primary_release_date.lte=${todayStr()}`;
}
function backdropUrl(movie) {
    return movie.backdrop_path ? `${BACKDROP_BASE_URL}${movie.backdrop_path}` : posterUrl(movie.poster_path);
}

function posterUrl(path) {
    return path ? `${IMG_BASE_URL}${path}` : 'https://placehold.co/500x750/1f1f1f/ffffff?text=Sin+Imagen';
}

// ============================================================
// Inicio
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
    mountResults('categories', false);
    mountResults('mood', true);
    mountResults('weather', true);

    wireFilterToggle(document.getElementById('randomFiltersToggle'), document.getElementById('randomFilters'));
    document.getElementById('randomFilters').innerHTML = filterBarHtml({ withIds: [], withoutIds: [], matchAll: false });
    renderMoods();
    renderWeatherTypes();
    setupTabs();

    fetchGenres();
    fetchPopularMovies(results.categories);

    weatherCityInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchWeatherByCity();
    });
});

// ============================================================
// Pestañas
// ============================================================
function setupTabs() {
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    switchTab('categories');
}

function switchTab(tab) {
    document.querySelectorAll('[data-tab]').forEach(btn => {
        const active = btn.dataset.tab === tab;
        btn.className = active ? TAB_ACTIVE : TAB_INACTIVE;
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
        document.getElementById(`panel-${btn.dataset.tab}`).classList.toggle('hidden', !active);
    });

    // La película aleatoria se carga la primera vez que se abre la pestaña
    if (tab === 'random' && !randomLoaded) {
        randomLoaded = true;
        pickRandomMovie();
    }
}

// ============================================================
// Bloques de resultados (uno por pestaña, para que no se mezclen)
// ============================================================
function mountResults(key, startHidden) {
    const host = document.getElementById(`${key}Results`);
    host.innerHTML = `
        <div data-role="block" class="${startHidden ? 'hidden' : ''}">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4">
                <h2 data-role="title" class="scroll-mt-24 text-2xl font-bold tracking-tight text-white flex flex-wrap items-center gap-x-2 gap-y-1"></h2>
                <button type="button" data-role="filtersToggle" aria-expanded="false" title="Ver categorías elegidas y evitadas" class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/70 transition-colors"><i class="fa-solid fa-sliders"></i> <span>Filtros</span> <i data-role="chevron" class="fa-solid fa-chevron-down text-[9px] transition-transform"></i></button>
            </div>
            <div data-role="filters" class="hidden flex-col gap-2 mb-5 p-3 rounded-xl bg-neutral-900/60 border border-neutral-800"></div>
            <div class="flex flex-wrap items-center gap-3 mb-5">
                <select data-role="sort" class="bg-neutral-800 text-neutral-200 text-xs rounded-xl px-3 py-2.5 border border-neutral-700 focus:outline-none focus:border-netflix-red">
                    <option value="rating">Ordenar: Mejor valoradas</option>
                    <option value="recent">Ordenar: Más recientes</option>
                </select>
                <button type="button" data-role="random" class="px-4 py-2.5 bg-netflix-red hover:bg-netflix-redhover text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 active:scale-95">
                    <i class="fa-solid fa-dice"></i> Elegir una al azar
                </button>
                <button type="button" data-role="restore" class="hidden px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white font-semibold text-xs rounded-xl border border-neutral-700 transition-all items-center gap-2">
                    <i class="fa-solid fa-rotate-left"></i> <span></span>
                </button>
                <span data-role="count" class="text-xs text-neutral-500 sm:ml-auto"></span>
            </div>
            <div data-role="grid" class="space-y-6"></div>
            <div data-role="empty" class="hidden flex flex-col items-center justify-center py-20 text-center">
                <div class="w-20 h-20 bg-neutral-900 rounded-full flex items-center justify-center text-neutral-500 text-3xl mb-4 border border-neutral-800">
                    <i class="fa-solid fa-face-frown"></i>
                </div>
                <h3 class="text-lg font-bold text-white mb-1">No hay películas para mostrar</h3>
                <p class="text-neutral-400 text-sm max-w-sm">No hay resultados para esta selección (o ya marcaste todas como vistas).</p>
            </div>
        </div>`;

    const block = host.firstElementChild;
    const q = role => block.querySelector(`[data-role="${role}"]`);
    const ctx = results[key] = {
        key, token: 0, selected: 0, scrollTimer: null, block, title: q('title'), filters: q('filters'), filterState: { withIds: [], withoutIds: [], matchAll: false }, grid: q('grid'), empty: q('empty'),
        count: q('count'), restoreBtn: q('restore'),
        sort: 'rating', raw: [], visible: [], lastFetch: null
    };
    wireFilterToggle(q('filtersToggle'), ctx.filters);
    q('sort').addEventListener('change', e => { ctx.sort = e.target.value; if (ctx.lastFetch) ctx.lastFetch(); });
    q('random').addEventListener('click', () => pickFromList(ctx));
    ctx.restoreBtn.addEventListener('click', clearSeen);
}

// Barra con las categorías elegidas (verde) y las evitadas (rojo)
function filterBarHtml({ withIds, withoutIds, matchAll }) {
    const chip = (id, cls) => `<span class="px-2.5 py-1 text-xs rounded-full border ${cls}">${escapeHtml(genresMap[id] || id)}</span>`;
    const inc = 'bg-green-950/60 text-green-200 border-green-800';
    const exc = 'bg-red-950 text-red-200 border-red-800';
    const incLabel = withIds.length > 1 ? (matchAll ? 'Elegidas (todas a la vez)' : 'Elegidas (cualquiera)') : 'Elegidas';
    const row = (icon, color, label, ids, cls, none) => `
        <div class="flex flex-wrap items-center gap-1.5">
            <span class="text-xs font-semibold text-neutral-300 flex items-center gap-1.5 mr-1"><i class="fa-solid ${icon} ${color}"></i> ${label}:</span>
            ${ids.length ? ids.map(id => chip(id, cls)).join('') : `<span class="text-xs text-neutral-500">${none}</span>`}
        </div>`;
    return row('fa-circle-check', 'text-green-500', incLabel, withIds, inc, 'todas las categorías')
         + row('fa-ban', 'text-red-500', 'Evitadas', withoutIds, exc, 'ninguna');
}

// Botón discreto que despliega / oculta la barra de categorías
function wireFilterToggle(btn, panel) {
    btn.addEventListener('click', () => {
        const open = panel.classList.toggle('hidden') === false;
        panel.classList.toggle('flex', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.querySelector('[data-role="chevron"]').classList.toggle('rotate-180', open);
    });
}

function setFilterBar(ctx, withIds, withoutIds, matchAll = false) {
    ctx.filterState = { withIds, withoutIds, matchAll };
    ctx.filters.innerHTML = filterBarHtml(ctx.filterState);
}

function scrollToResults(ctx) {
    ctx.title.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================================
// Pestaña 1: Categorías
// ============================================================
async function fetchGenres() {
    try {
        const response = await fetch(`${BASE_URL}/genre/movie/list?language=es-ES`);
        const data = await response.json();
        if (!response.ok || !data.genres) throw new Error(data.status_message || 'Respuesta inválida');
        data.genres.forEach(g => { genresMap[g.id] = g.name; });
        Object.values(results).forEach(c => { c.filters.innerHTML = filterBarHtml(c.filterState); });
        renderGenres(data.genres);
    } catch (error) {
        console.error('Error al cargar géneros:', error);
        excludeContainer.innerHTML = '';
        includeContainer.innerHTML = '<p class="text-xs text-red-500">Error al cargar las categorías. Verifica tu API key de TMDb.</p>';
    }
}

function createGenreButton(prefix, genre, onToggle) {
    const btn = document.createElement('button');
    btn.id = `${prefix}-${genre.id}`;
    btn.type = 'button';
    const icon = document.createElement('i');
    icon.className = 'hidden';
    const label = document.createElement('span');
    label.textContent = genre.name;
    btn.append(icon, label);
    btn.addEventListener('click', () => onToggle(genre.id, genre.name));
    return btn;
}

function renderGenres(genres) {
    includeContainer.innerHTML = '';
    excludeContainer.innerHTML = '';

    genres.forEach(genre => {
        includeContainer.appendChild(createGenreButton('inc', genre, toggleInclude));
        excludeContainer.appendChild(createGenreButton('exc', genre, toggleExclude));
    });

    updateCategoryUI();
}

function toggleInclude(genreId, genreName) {
    if (excludedGenres.has(genreId)) return;
    if (includedGenres.has(genreId)) {
        includedGenres.delete(genreId);
    } else {
        includedGenres.set(genreId, genreName);
    }
    updateCategoryUI();
}

function toggleExclude(genreId, genreName) {
    if (includedGenres.has(genreId)) return;
    if (excludedGenres.has(genreId)) {
        excludedGenres.delete(genreId);
    } else {
        excludedGenres.set(genreId, genreName);
    }
    updateCategoryUI();
}

function clearCategories() {
    includedGenres.clear();
    excludedGenres.clear();
    updateCategoryUI();
}

function filtersSummary() {
    const parts = [];
    if (includedGenres.size) parts.push('Con: ' + [...includedGenres.values()].join(', '));
    if (excludedGenres.size) parts.push('Sin: ' + [...excludedGenres.values()].join(', '));
    return parts.join(' · ');
}

function setButtonState(btn, state, activeClass, activeIcon, blockedTitle) {
    const icon = btn.querySelector('i');
    btn.disabled = false;

    if (state === 'active') {
        btn.className = activeClass;
        icon.className = `${activeIcon} mr-1`;
        btn.title = 'Clic para quitar';
    } else if (state === 'blocked') {
        btn.className = BTN_DISABLED;
        btn.disabled = true;
        icon.className = 'hidden';
        btn.title = blockedTitle;
    } else {
        btn.className = BTN_NEUTRAL;
        icon.className = 'hidden';
        btn.title = '';
    }
}

function updateCategoryUI() {
    includeContainer.querySelectorAll('button').forEach(btn => {
        const id = Number(btn.id.replace('inc-', ''));
        const state = includedGenres.has(id) ? 'active' : excludedGenres.has(id) ? 'blocked' : 'neutral';
        setButtonState(btn, state, BTN_INCLUDE, 'fa-solid fa-check', 'Ya está en la lista de excluidas');
    });

    excludeContainer.querySelectorAll('button').forEach(btn => {
        const id = Number(btn.id.replace('exc-', ''));
        const state = excludedGenres.has(id) ? 'active' : includedGenres.has(id) ? 'blocked' : 'neutral';
        setButtonState(btn, state, BTN_EXCLUDE, 'fa-solid fa-ban', 'Ya está en la lista de incluidas');
    });
}

function executeSearch() {
    const ctx = results.categories;

    if (includedGenres.size === 0 && excludedGenres.size === 0) {
        fetchPopularMovies(ctx);
    } else {
        fetchDiscover(ctx, {
            withIds: [...includedGenres.keys()],
            withoutIds: [...excludedGenres.keys()],
            separator: matchMode.value === 'any' ? '|' : ',',
            titleHtml: `<i class="fa-solid fa-film text-netflix-red"></i> <span>Resultados de tu búsqueda</span>`
        });
    }
    scrollToResults(ctx);
}

function resetHome(e) {
    if (e) e.preventDefault();
    clearCategories();
    switchTab('categories');
    fetchPopularMovies(results.categories);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// Pestaña 2: Estado de ánimo
// ============================================================
function renderMoods() {
    MOODS.forEach(mood => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.mood = mood.id;
        btn.className = MOOD_NEUTRAL;
        btn.innerHTML = `<span class="text-3xl">${mood.emoji}</span><span class="text-xs font-semibold">${mood.label}</span>`;
        btn.addEventListener('click', () => selectMood(mood.id));
        moodContainer.appendChild(btn);
    });
}

function selectMood(moodId) {
    const mood = MOODS.find(m => m.id === moodId);
    if (!mood) return;

    moodContainer.querySelectorAll('button').forEach(btn => {
        btn.className = btn.dataset.mood === moodId ? MOOD_ACTIVE : MOOD_NEUTRAL;
    });

    const ctx = results.mood;
    fetchDiscover(ctx, {
        withIds: mood.genres,
        withoutIds: mood.avoid,
        separator: ',', // todas las categorías a la vez
        titleHtml: `<span>${mood.emoji} ${mood.label}</span>`
    });
    scrollToResults(ctx);
}

// ============================================================
// Pestaña 3: Clima
// ============================================================
function renderWeatherTypes() {
    Object.entries(WEATHER_TYPES).forEach(([key, type]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.weather = key;
        btn.className = WEATHER_NEUTRAL;
        btn.innerHTML = `<span class="text-xl">${type.emoji}</span><span class="text-xs font-semibold">${type.label}</span>`;
        btn.addEventListener('click', () => selectWeatherType(key));
        weatherTypesContainer.appendChild(btn);
    });
}

function setWeatherStatus(message, isError = false) {
    weatherStatus.textContent = message;
    weatherStatus.className = `text-xs min-h-[1rem] mb-4 ${isError ? 'text-red-400' : 'text-neutral-400'}`;
}

async function searchWeatherByCity() {
    const city = weatherCityInput.value.trim();
    if (!city) {
        setWeatherStatus('Escribe el nombre de una ciudad.', true);
        return;
    }

    setWeatherStatus('Buscando ciudad...');
    try {
        const response = await fetch(`${GEOCODING_URL}?name=${encodeURIComponent(city)}&count=1&language=es&format=json`);
        const data = await response.json();
        if (!data.results || data.results.length === 0) {
            setWeatherStatus('No se encontró esa ciudad. Prueba con otro nombre.', true);
            return;
        }
        const place = data.results[0];
        const label = [place.name, place.admin1, place.country].filter(Boolean).join(', ');
        await loadWeather(place.latitude, place.longitude, label);
    } catch (error) {
        console.error('Error al buscar la ciudad:', error);
        setWeatherStatus('No se pudo consultar el clima. Revisa tu conexión.', true);
    }
}

function useMyLocation() {
    if (!navigator.geolocation) {
        setWeatherStatus('Tu navegador no permite obtener la ubicación.', true);
        return;
    }

    setWeatherStatus('Obteniendo tu ubicación...');
    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            try {
                await loadWeather(pos.coords.latitude, pos.coords.longitude, 'Tu ubicación');
            } catch (error) {
                console.error('Error al consultar el clima:', error);
                setWeatherStatus('No se pudo consultar el clima. Revisa tu conexión.', true);
            }
        },
        () => setWeatherStatus('No se pudo obtener tu ubicación (revisa el permiso del navegador; requiere HTTPS o localhost).', true)
    );
}

async function loadWeather(lat, lon, label) {
    setWeatherStatus('Consultando el clima...');
    const response = await fetch(`${FORECAST_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`);
    const data = await response.json();
    if (!data.current) throw new Error('Respuesta de clima inválida');

    const temp = Math.round(data.current.temperature_2m);
    const typeKey = weatherCodeToType(data.current.weather_code);
    setWeatherStatus('');
    selectWeatherType(typeKey, { label, temp });
}

function selectWeatherType(typeKey, info = {}) {
    const type = WEATHER_TYPES[typeKey];
    if (!type) return;

    weatherTypesContainer.querySelectorAll('button').forEach(btn => {
        btn.className = btn.dataset.weather === typeKey ? WEATHER_ACTIVE : WEATHER_NEUTRAL;
    });

    const tempText = info.temp !== undefined ? `${info.temp}°C · ` : '';
    weatherSummary.className = 'flex items-center gap-4 mb-5 p-4 rounded-xl bg-neutral-950/50 border border-neutral-800';
    weatherSummary.innerHTML = `
        <span class="text-4xl">${type.emoji}</span>
        <div>
            <p class="text-sm font-semibold text-white">${escapeHtml(info.label || 'Clima elegido manualmente')}</p>
            <p class="text-xs text-neutral-400">${tempText}${type.label}</p>
        </div>`;

    const ctx = results.weather;
    fetchDiscover(ctx, {
        withIds: type.genres,
        withoutIds: type.avoid,
        separator: ',', // todas las categorías a la vez
        titleHtml: `<span>${type.emoji} Clima: ${type.label}</span>`
    });
    scrollToResults(ctx);
}

// ============================================================
// Pestaña 4: Película aleatoria
// ============================================================
async function pickRandomMovie() {
    const token = ++randomToken;

    randomCard.innerHTML = `
        <div class="animate-pulse flex flex-col md:flex-row gap-6 bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
            <div class="w-full md:w-72 aspect-[2/3] bg-neutral-800 rounded-xl"></div>
            <div class="flex-1 space-y-3 py-2">
                <div class="h-7 bg-neutral-800 rounded w-2/3"></div>
                <div class="h-4 bg-neutral-800 rounded w-1/4"></div>
                <div class="h-4 bg-neutral-800 rounded w-full"></div>
                <div class="h-4 bg-neutral-800 rounded w-full"></div>
                <div class="h-4 bg-neutral-800 rounded w-3/4"></div>
            </div>
        </div>`;

    const fetchPage = async (page) => {
        const response = await fetch(`${BASE_URL}/discover/movie?language=es-ES&sort_by=popularity.desc&vote_count.gte=200&${releasedParam()}&include_adult=false&page=${page}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.status_message);
        return data.results || [];
    };

    try {
        let list = await fetchPage(Math.floor(Math.random() * 30) + 1);
        if (list.length === 0) list = await fetchPage(1);
        if (token !== randomToken) return;
        if (list.length === 0) throw new Error('Sin resultados');

        const fresh = list.filter(m => !seenMovies.has(m.id));
        const pool = fresh.length ? fresh : list;
        renderRandomCard(pool[Math.floor(Math.random() * pool.length)]);
    } catch (error) {
        console.error('Error fetching random movie:', error);
        if (token !== randomToken) return;
        randomCard.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16 text-center">
                <div class="w-20 h-20 bg-neutral-900 rounded-full flex items-center justify-center text-neutral-500 text-3xl mb-4 border border-neutral-800">
                    <i class="fa-solid fa-face-frown"></i>
                </div>
                <p class="text-neutral-400 text-sm">No se pudo cargar una película. Intenta de nuevo.</p>
            </div>`;
    }
}

function renderRandomCard(movie) {
    const title = movie.title || 'Título desconocido';
    const year = movie.release_date ? movie.release_date.split('-')[0] : 'N/D';
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/D';
    const overview = movie.overview || 'Sinopsis no disponible en español para este título.';
    const genresHtml = (movie.genre_ids || [])
        .filter(id => genresMap[id])
        .map(id => `<span class="px-2.5 py-1 bg-neutral-800 text-neutral-300 text-xs rounded-full border border-neutral-700">${escapeHtml(genresMap[id])}</span>`)
        .join('');

    randomCard.innerHTML = `
        <div class="flex flex-col md:flex-row gap-6 bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-lg">
            <img src="${posterUrl(movie.poster_path)}" alt="${escapeHtml(title)}" class="w-full md:w-72 max-h-[26rem] md:max-h-none object-contain md:object-cover bg-neutral-950"
                 onerror="this.onerror=null;this.src='https://placehold.co/500x750/1f1f1f/ffffff?text=Error+Carga'">
            <div class="flex-1 p-6 flex flex-col justify-between gap-6">
                <div>
                    <h3 class="text-2xl sm:text-3xl font-bold text-white leading-tight mb-3">${escapeHtml(title)}</h3>
                    <div class="flex flex-wrap items-center gap-3 text-xs text-neutral-400 mb-4">
                        <span class="flex items-center gap-1"><i class="fa-regular fa-calendar"></i> ${year}</span>
                        <span class="flex items-center gap-1 text-amber-400 font-semibold"><i class="fa-solid fa-star"></i> ${rating}</span>
                    </div>
                    <div class="flex flex-wrap gap-1.5 mb-4">${genresHtml}</div>
                    <p class="text-neutral-300 text-sm leading-relaxed">${escapeHtml(overview)}</p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <button type="button" onclick="openMovieDetails(${movie.id})" class="px-5 py-2.5 bg-netflix-red hover:bg-netflix-redhover text-white font-semibold text-sm rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95">
                        <i class="fa-solid fa-tv"></i> Dónde ver
                    </button>
                    <button type="button" onclick="pickRandomMovie()" class="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-sm rounded-xl border border-neutral-700 transition-all flex items-center gap-2">
                        <i class="fa-solid fa-shuffle"></i> Otra película
                    </button>
                </div>
            </div>
        </div>`;
}

// ============================================================
// Consultas a TMDb que alimentan las cuadrículas
// ============================================================
function sortParams(sort, ratingVotes = 300, recentVotes = 100) {
    return sort === 'recent'
        ? `sort_by=primary_release_date.desc&vote_count.gte=${recentVotes}`
        : `sort_by=vote_average.desc&vote_count.gte=${ratingVotes}`;
}

// Trae varias páginas de TMDb (20 películas por página, máximo 500 páginas)
async function fetchMovieList(url, pages = [1, 2, 3]) {
    let totalPages = 1;
    const lists = await Promise.all(pages.map(async p => {
        const response = await fetch(`${url}&page=${p}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.status_message);
        totalPages = Math.min(data.total_pages || 1, 500);
        return data.results || [];
    }));
    return { results: lists.flat(), totalPages };
}

async function fetchPopularMovies(ctx) {
    const token = ++ctx.token;
    ctx.excludeIds = [];
    setFilterBar(ctx, [], []);
    ctx.lastFetch = () => fetchPopularMovies(ctx);
    const recent = ctx.sort === 'recent';
    ctx.block.classList.remove('hidden');
    ctx.title.innerHTML = `<i class="fa-solid ${recent ? 'fa-clock' : 'fa-trophy'} text-netflix-red"></i> <span>${recent ? 'Más Recientes' : 'Mejor Valoradas'}</span>`;
    showSkeletons(ctx);

    try {
        const url = `${BASE_URL}/discover/movie?language=es-ES&${sortParams(ctx.sort, 1000, 200)}&${releasedParam()}&include_adult=false`;
        const { results: list, totalPages } = await fetchMovieList(url);
        if (token !== ctx.token) return;
        Object.assign(ctx, { baseUrl: url, nextPage: 4, totalPages, loadingMore: false });
        renderMovies(list, ctx);
    } catch (error) {
        console.error('Error fetching movies:', error);
        if (token === ctx.token) showEmptyState(ctx);
    }
}

// withIds -> with_genres (según el separador), withoutIds -> without_genres
async function fetchDiscover(ctx, opts) {
    const { withIds = [], withoutIds = [], separator = ',', titleHtml = '' } = opts;
    const token = ++ctx.token;
    ctx.excludeIds = withoutIds;
    setFilterBar(ctx, withIds, withoutIds, separator === ',');
    ctx.lastFetch = () => fetchDiscover(ctx, opts);

    let url = `${BASE_URL}/discover/movie?language=es-ES&${sortParams(ctx.sort)}&${releasedParam()}&include_adult=false`;
    if (withIds.length) url += `&with_genres=${encodeURIComponent(withIds.join(separator))}`;
    if (withoutIds.length) url += `&without_genres=${encodeURIComponent(withoutIds.join(','))}`;

    ctx.block.classList.remove('hidden');
    ctx.title.innerHTML = titleHtml;
    showSkeletons(ctx);

    try {
        const { results: list, totalPages } = await fetchMovieList(url);
        if (token !== ctx.token) return;
        Object.assign(ctx, { baseUrl: url, nextPage: 4, totalPages, loadingMore: false });
        renderMovies(list, ctx);
    } catch (error) {
        console.error('Error fetching movies:', error);
        if (token === ctx.token) showEmptyState(ctx);
    }
}

// ============================================================
// Carrusel
// ============================================================
const INFO_OPEN = ['w-44', 'sm:w-[26rem]', 'lg:w-[40rem]'];
const SEL_ON = ['border-netflix-red', 'shadow-[0_0_35px_rgba(229,9,20,0.5)]'];
const SEL_OFF = ['border-neutral-700', 'shadow-xl', 'brightness-75', 'hover:brightness-100', 'hover:-translate-y-2'];

function cardHtml(m) {
    const onErr = "this.onerror=null;this.src='https://placehold.co/500x750/1f1f1f/ffffff?text=Error+Carga'";
        const title = escapeHtml(m.title || 'Título desconocido');
        const year = m.release_date.split('-')[0];
        const rating = m.vote_average ? m.vote_average.toFixed(1) : 'N/D';
        const genres = (m.genre_ids || []).filter(id => genresMap[id])
            .map(id => `<span class="px-2 py-0.5 bg-white/10 text-neutral-200 text-[11px] rounded-full border border-white/10">${escapeHtml(genresMap[id])}</span>`).join('');
        return `
        <div data-movie-id="${m.id}" class="relative shrink-0 flex h-80 sm:h-[26rem] lg:h-[30rem] rounded-xl overflow-hidden bg-neutral-900 border-2 cursor-pointer transition-all duration-500">
            <div class="relative h-full w-40 sm:w-[17.333rem] lg:w-80 shrink-0 bg-neutral-950">
                <img src="${posterUrl(m.poster_path)}" alt="${title}" loading="lazy" class="w-full h-full object-cover" onerror="${onErr}">
                <div class="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded-md flex items-center gap-1 text-xs text-amber-400 font-bold border border-white/10">
                    <i class="fa-solid fa-star"></i><span>${rating}</span>
                </div>
            </div>
            <div data-role="info" class="shrink-0 overflow-hidden transition-all duration-500 w-0">
                <div class="w-44 sm:w-[26rem] lg:w-[40rem] h-full p-3 sm:p-6 flex flex-col justify-between bg-gradient-to-br from-neutral-900 to-neutral-950">
                    <div class="min-h-0">
                        <h3 class="text-base sm:text-3xl font-extrabold text-white leading-tight line-clamp-2 mb-2">${title}</h3>
                        <div class="flex items-center gap-3 text-xs sm:text-sm mb-3">
                            <span class="flex items-center gap-1 text-amber-400 font-bold"><i class="fa-solid fa-star"></i> ${rating}</span>
                            <span class="text-neutral-400">${year}</span>
                        </div>
                        <div class="hidden sm:flex flex-wrap gap-1.5 mb-3 max-h-24 overflow-y-auto no-scrollbar">${genres}</div>
                        <p class="text-xs sm:text-sm text-neutral-300 leading-relaxed line-clamp-4 sm:line-clamp-6">${escapeHtml(m.overview || 'Sinopsis no disponible en español para este título.')}</p>
                    </div>
                    <div class="flex flex-col sm:flex-row gap-2 pt-3">
                        <button type="button" onclick="event.stopPropagation(); openMovieDetails(${m.id})" class="px-3 sm:px-4 py-2 justify-center sm:justify-start bg-netflix-red hover:bg-netflix-redhover text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5">
                            <i class="fa-solid fa-tv"></i> Dónde ver
                        </button>
                        <button type="button" onclick="markSeen(event, ${m.id})" title="Quitar de la lista" class="px-3 sm:px-4 py-2 justify-center sm:justify-start bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg border border-neutral-700 transition-colors flex items-center gap-1.5">
                            <i class="fa-solid fa-eye"></i> Ya la vi
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
}

function bindCard(ctx, card) {
    card.addEventListener('click', () => {
        const idx = [...ctx.grid.querySelectorAll('[data-movie-id]')].indexOf(card);
        if (idx === ctx.selected) openMovieDetails(Number(card.dataset.movieId));
        else applySelection(ctx, idx);
    });
}

function compareMovies(ctx) {
    return (a, b) => ctx.sort === 'recent'
        ? b.release_date.localeCompare(a.release_date)
        : (b.vote_average || 0) - (a.vote_average || 0);
}

function renderMovies(movies, ctx) {
    // Solo estrenadas y no vistas, ordenadas según la opción elegida
    const today = todayStr();
    const list = (movies || [])
        .filter(m => isShown(m, ctx, today))
        .sort((a, b) => ctx.sort === 'recent'
            ? b.release_date.localeCompare(a.release_date)
            : (b.vote_average || 0) - (a.vote_average || 0));

    ctx.raw = movies || [];
    ctx.visible = list;
    ctx.selected = 0;
    updateListUI();

    if (list.length === 0) {
        showEmptyState(ctx);
        return;
    }

    ctx.empty.classList.add('hidden');
    ctx.grid.classList.remove('hidden');

    const onErr = "this.onerror=null;this.src='https://placehold.co/500x750/1f1f1f/ffffff?text=Error+Carga'";
    const arrow = (dir, side, icon) => `<button type="button" onclick="stepSelection('${ctx.key}', ${dir})" aria-label="${dir < 0 ? 'Película anterior' : 'Película siguiente'}"
        class="absolute ${side} top-1/2 -translate-y-1/2 z-[300] w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-black/80 hover:bg-netflix-red text-white border border-white/20 shadow-lg transition-colors">
        <i class="fa-solid ${icon}"></i></button>`;

    const cards = list.map(cardHtml).join('');

    ctx.grid.innerHTML = `
        <div class="relative isolate">
            ${arrow(-1, 'left-1', 'fa-chevron-left')}
            <div data-role="track" class="relative flex items-center overflow-x-auto no-scrollbar py-8 px-3 [--overlap:-7rem] sm:[--overlap:-10.5rem] lg:[--overlap:-13rem]">${cards}<div data-role="spacer" class="shrink-0 w-[70%]" aria-hidden="true"></div></div>
            ${arrow(1, 'right-1', 'fa-chevron-right')}
        </div>`;

    ctx.grid.querySelectorAll('[data-movie-id]').forEach(card => bindCard(ctx, card));

    applySelection(ctx, 0, false);
}

function openInfo(card) {
    const info = card.querySelector('[data-role="info"]');
    info.classList.remove('w-0');
    INFO_OPEN.forEach(c => info.classList.add(c));
}

function closeInfo(card) {
    const info = card.querySelector('[data-role="info"]');
    info.classList.add('w-0');
    INFO_OPEN.forEach(c => info.classList.remove(c));
}

// Superposición, capas y estilo de selección de todas las tarjetas
function layoutCards(ctx, idx) {
    const cards = [...ctx.grid.querySelectorAll('[data-movie-id]')];
    cards.forEach((card, i) => {
        const sel = i === idx;
        card.style.zIndex = String(100 - Math.abs(i - idx));
        card.style.marginLeft = i === 0 ? '0px' : (i === idx + 1 ? '1rem' : 'var(--overlap)');
        SEL_ON.forEach(c => card.classList.toggle(c, sel));
        SEL_OFF.forEach(c => card.classList.toggle(c, !sel));
    });
    return cards;
}

// Desplaza la baraja para que la tarjeta quede a la izquierda (sigue su posición real en cada fotograma)
function slideTo(card, token, ctx, duration = 450) {
    return new Promise(resolve => {
        const track = card.parentElement;
        const start = track.scrollLeft;
        const t0 = performance.now();
        const frame = now => {
            if (ctx.selectToken !== token) return resolve(false);
            const p = Math.min(1, (now - t0) / duration);
            const ease = 1 - Math.pow(1 - p, 3);
            const lead = window.innerWidth < 640 ? 12 : 110; // en celular casi no se deja ver la tarjeta anterior
            const target = Math.max(0, card.offsetLeft - Math.min(card.offsetLeft, lead));
            track.scrollLeft = start + (target - start) * ease;
            if (p < 1) requestAnimationFrame(frame); else resolve(true);
        };
        requestAnimationFrame(frame);
    });
}

// Primero se pliega la anterior y la baraja se desplaza; después se extienden los detalles
function applySelection(ctx, idx, animate = true) {
    const total = ctx.grid.querySelectorAll('[data-movie-id]').length;
    if (!total) return;
    idx = Math.max(0, Math.min(idx, total - 1));
    ctx.selected = idx;
    if (idx >= total - 6) loadMore(ctx);
    const token = ctx.selectToken = (ctx.selectToken || 0) + 1;

    const cards = layoutCards(ctx, idx);
    cards.forEach((card, i) => { if (i !== idx) closeInfo(card); });

    if (!animate) {
        openInfo(cards[idx]);
        return;
    }
    slideTo(cards[idx], token, ctx).then(done => { if (done) openInfo(cards[idx]); });
}

// Carga más películas (2 páginas) cuando te acercas al final del carrusel
async function loadMore(ctx) {
    if (ctx.loadingMore || !ctx.baseUrl || ctx.nextPage > ctx.totalPages) return;
    ctx.loadingMore = true;
    const token = ctx.token;
    const pages = [ctx.nextPage, ctx.nextPage + 1].filter(p => p <= ctx.totalPages);
    ctx.nextPage += 2;

    let added = 0;
    try {
        const { results: more } = await fetchMovieList(ctx.baseUrl, pages);
        if (token !== ctx.token) return;

        const known = new Set(ctx.raw.map(m => m.id));
        const fresh = more.filter(m => !known.has(m.id));
        ctx.raw = ctx.raw.concat(fresh);

        const today = todayStr();
        const add = fresh
            .filter(m => isShown(m, ctx, today))
            .sort(compareMovies(ctx));

        const spacer = ctx.grid.querySelector('[data-role="spacer"]');
        if (add.length && spacer) {
            ctx.visible.push(...add);
            const before = new Set([...ctx.grid.querySelectorAll('[data-movie-id]')]);
            spacer.insertAdjacentHTML('beforebegin', add.map(cardHtml).join(''));
            ctx.grid.querySelectorAll('[data-movie-id]').forEach(card => { if (!before.has(card)) bindCard(ctx, card); });
            layoutCards(ctx, ctx.selected);
            updateListUI();
            added = add.length;
        }
    } catch (error) {
        console.error('Error cargando más películas:', error);
    } finally {
        if (token === ctx.token) ctx.loadingMore = false;
    }
    // Si todo lo traído estaba filtrado (vistas / no estrenadas), seguir buscando
    if (token === ctx.token && added === 0) loadMore(ctx);
}

// Flechas: pasan de una película a la vez
function stepSelection(key, dir) {
    const ctx = results[key];
    applySelection(ctx, ctx.selected + dir);
}

function showSkeletons(ctx) {
    ctx.empty.classList.add('hidden');
    ctx.grid.classList.remove('hidden');
    ctx.count.textContent = '';
    let cards = '';
    for (let i = 0; i < 8; i++) {
        cards += `
            <div class="shrink-0 w-44 sm:w-52 bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                <div class="aspect-[2/3] bg-neutral-800 w-full"></div>
                <div class="p-3 space-y-2">
                    <div class="h-4 bg-neutral-800 rounded w-3/4"></div>
                    <div class="h-8 bg-neutral-800 rounded"></div>
                </div>
            </div>`;
    }
    ctx.grid.innerHTML = `<div class="flex gap-4 overflow-hidden animate-pulse py-2 px-1">${cards}</div>`;
}

// ============================================================
// "Ya la vi" y elección aleatoria
// ============================================================
function updateListUI() {
    Object.values(results).forEach(ctx => {
        ctx.count.textContent = ctx.visible.length ? `${ctx.visible.length}${ctx.nextPage <= ctx.totalPages ? '+' : ''} películas` : '';
        ctx.restoreBtn.classList.toggle('hidden', seenMovies.size === 0);
        ctx.restoreBtn.classList.toggle('flex', seenMovies.size > 0);
        ctx.restoreBtn.querySelector('span').textContent = `Restaurar vistas (${seenMovies.size})`;
    });
}

function markSeen(event, movieId) {
    event.stopPropagation();
    seenMovies.add(movieId);
    saveSeen();

    Object.values(results).forEach(ctx => {
        const idx = ctx.visible.findIndex(m => m.id === movieId);
        if (idx === -1) return;
        const wasSelected = idx === ctx.selected;
        ctx.visible.splice(idx, 1);
        if (idx < ctx.selected) ctx.selected--;
        ctx.selected = Math.max(0, Math.min(ctx.selected, ctx.visible.length - 1));

        const card = ctx.grid.querySelector(`[data-movie-id="${movieId}"]`);
        if (!card) return;

        // 1) la tarjeta se eleva y se desvanece
        card.classList.add('opacity-0', '-translate-y-6', 'scale-95');

        setTimeout(() => {
            // 2) se pliega su ancho: las demás se deslizan y la siguiente toma su lugar
            card.removeAttribute('data-movie-id');
            card.style.pointerEvents = 'none';
            card.style.width = `${card.offsetWidth}px`;
            void card.offsetWidth;
            card.style.width = '0px';
            card.style.marginLeft = '0px';
            card.style.borderWidth = '0px';

            if (ctx.visible.length === 0) setTimeout(() => showEmptyState(ctx), 500);
            else if (wasSelected) applySelection(ctx, ctx.selected);
            else layoutCards(ctx, ctx.selected);

            // 3) se elimina del DOM
            setTimeout(() => card.remove(), 600);
        }, 320);
    });
    updateListUI();
}

function clearSeen() {
    seenMovies.clear();
    saveSeen();
    Object.values(results).forEach(ctx => {
        if (ctx.raw.length) renderMovies(ctx.raw, ctx);
    });
    updateListUI();
}

// Elige una película al azar de la lista filtrada: la selecciona y la expande
function pickFromList(ctx) {
    if (!ctx.visible.length) return;
    const idx = Math.floor(Math.random() * ctx.visible.length);
    applySelection(ctx, idx);
    ctx.grid.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showEmptyState(ctx) {
    ctx.grid.innerHTML = '';
    ctx.grid.classList.add('hidden');
    ctx.empty.classList.remove('hidden');
}

// ============================================================
// Modal de detalles
// ============================================================
async function openMovieDetails(movieId) {
    const movieModal = document.getElementById('movieModal');
    const modalContent = document.getElementById('modalContent');
    const modalPoster = document.getElementById('modalPoster');
    const modalTitle = document.getElementById('modalTitle');
    const modalReleaseDate = document.getElementById('modalReleaseDate').querySelector('span');
    const modalRating = document.getElementById('modalRating').querySelector('span');
    const modalGenres = document.getElementById('modalGenres');
    const modalOverview = document.getElementById('modalOverview');

    modalPoster.src = 'https://placehold.co/500x750/1f1f1f/ffffff?text=Cargando...';
    modalTitle.textContent = 'Cargando información...';
    modalReleaseDate.textContent = '---';
    modalRating.textContent = '---';
    modalGenres.innerHTML = '';
    modalOverview.textContent = 'Por favor espere...';
    const modalProviders = document.getElementById('modalProviders');
    const token = ++detailToken;
    loadProviders(movieId, token, modalProviders);

    movieModal.classList.remove('opacity-0', 'pointer-events-none');
    lockPageScroll();
    modalContent.classList.remove('scale-95');
    modalContent.classList.add('scale-100');

    try {
        const response = await fetch(`${BASE_URL}/movie/${movieId}?language=es-ES`);
        const movie = await response.json();
        if (!response.ok) throw new Error(movie.status_message);

        modalPoster.src = posterUrl(movie.poster_path);
        modalTitle.textContent = movie.title || 'Título desconocido';
        modalReleaseDate.textContent = movie.release_date || 'Fecha desconocida';
        modalRating.textContent = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/D';
        modalOverview.textContent = movie.overview || 'Sinopsis no disponible en español para este título.';

        modalGenres.innerHTML = (movie.genres || [])
            .map(g => `<span class="px-2.5 py-1 bg-neutral-800 text-neutral-300 text-xs rounded-full border border-neutral-700">${escapeHtml(g.name)}</span>`)
            .join('');
    } catch (error) {
        console.error('Error fetching movie details:', error);
        modalTitle.textContent = 'Error al cargar detalles';
        modalOverview.textContent = 'No se pudo obtener la información.';
    }
}

// Plataformas donde ver la película (datos de JustWatch vía TMDb)
async function loadProviders(movieId, token, box) {
    box.innerHTML = '<p class="text-xs text-neutral-500">Buscando plataformas...</p>';
    const heading = '<h4 class="text-xs font-bold text-white uppercase tracking-wide mb-2 flex items-center gap-2"><i class="fa-solid fa-tv text-netflix-red"></i> Dónde ver (Argentina)</h4>';
    try {
        const response = await fetch(`${BASE_URL}/movie/${movieId}/watch/providers`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.status_message);
        if (token !== detailToken) return;

        const info = data.results && data.results[WATCH_REGION];
        const groups = [['flatrate', 'Suscripción'], ['free', 'Gratis'], ['ads', 'Gratis con anuncios'], ['rent', 'Alquiler'], ['buy', 'Compra']]
            .filter(([key]) => info && info[key] && info[key].length);

        if (!groups.length) {
            box.innerHTML = heading + '<p class="text-xs text-neutral-500">No hay plataformas registradas para esta película en Argentina.</p>';
            return;
        }

        box.innerHTML = heading + groups.map(([key, label]) => `
            <div class="mb-3">
                <p class="text-[11px] uppercase tracking-wide text-neutral-500 mb-1.5">${label}</p>
                <div class="flex flex-wrap gap-2">${info[key].map(p => p.logo_path
                    ? `<img src="${LOGO_BASE_URL}${p.logo_path}" alt="${escapeHtml(p.provider_name)}" title="${escapeHtml(p.provider_name)}" draggable="false" class="w-11 h-11 rounded-xl border border-neutral-700 select-none pointer-events-none">`
                    : `<span class="px-2 py-1 text-xs text-neutral-300 bg-neutral-800 rounded-lg border border-neutral-700">${escapeHtml(p.provider_name)}</span>`
                ).join('')}</div>
            </div>`).join('') + '<p class="text-[10px] text-neutral-600">Datos de disponibilidad por JustWatch</p>';
    } catch (error) {
        console.error('Error fetching providers:', error);
        if (token === detailToken) box.innerHTML = heading + '<p class="text-xs text-neutral-500">No se pudo consultar las plataformas.</p>';
    }
}

// Bloquea el scroll de la página mientras el modal está abierto (compensa el ancho de la barra para evitar saltos)
function lockPageScroll() {
    if (document.body.classList.contains('overflow-hidden')) return;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = gap > 0 ? `${gap}px` : '';
    document.body.classList.add('overflow-hidden');
}

function unlockPageScroll() {
    document.body.classList.remove('overflow-hidden');
    document.body.style.paddingRight = '';
}

function closeModal() {
    const movieModal = document.getElementById('movieModal');
    const modalContent = document.getElementById('modalContent');
    movieModal.classList.add('opacity-0', 'pointer-events-none');
    unlockPageScroll();
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
}

window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('movieModal')) closeModal();
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});
