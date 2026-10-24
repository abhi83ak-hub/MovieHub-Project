/* ==========================================
   MovieHub v3 (with AI) - script.js
   STEP 1: paste your TMDB API key on line 7 below (between the quotes)
   Get a free key at: https://www.themoviedb.org/settings/api
========================================== */

const API_KEY = "5d18dc941ad299a9f3924683d7bb18d8";
const BASE_URL = "https://api.themoviedb.org/3";
const IMG_URL = "https://image.tmdb.org/t/p/w500";
const LOGO_URL = "https://image.tmdb.org/t/p/w92";
const REGION = "IN"; // "Where to watch" is shown for India

/* A small grey picture used when a movie has no poster (no internet needed) */
const NO_IMAGE = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450">' +
  '<rect width="100%" height="100%" fill="#2a2a3d"/>' +
  '<text x="50%" y="50%" fill="#9a9ab0" font-family="Arial" font-size="22" text-anchor="middle">No Image</text></svg>'
);

/* ---------- Page elements ---------- */
const movieGrid = document.getElementById("movieGrid");
const searchInput = document.getElementById("searchInput");
const genreFilter = document.getElementById("genreFilter");
const sortSelect = document.getElementById("sortSelect");
const sectionTitle = document.getElementById("currentSectionTitle");
const noResults = document.getElementById("noResults");
const statusMsg = document.getElementById("statusMsg");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const tabBar = document.getElementById("tabBar");
const moodBar = document.getElementById("moodBar");
const surpriseBtn = document.getElementById("surpriseBtn");
const toast = document.getElementById("toast");

const movieModal = document.getElementById("movieModal");
const modalBody = document.getElementById("modalBody");
const closeModal = document.getElementById("closeModal");

const watchlistBtn = document.getElementById("watchlistBtn");
const watchCount = document.getElementById("watchCount");
const watchlistModal = document.getElementById("watchlistModal");
const watchlistGrid = document.getElementById("watchlistGrid");
const watchSummary = document.getElementById("watchSummary");
const watchFilterBar = document.getElementById("watchFilterBar");
const pickFromWatchlist = document.getElementById("pickFromWatchlist");
const closeWatchlist = document.getElementById("closeWatchlist");

const themeToggle = document.getElementById("themeToggle");

const aiBtn = document.getElementById("aiBtn");
const aiModal = document.getElementById("aiModal");
const aiBody = document.getElementById("aiBody");
const closeAI = document.getElementById("closeAI");

/* ---------- Settings for the tabs and mood buttons ---------- */
const TABS = {
  trending:    { label: "🔥 Trending",    title: "Trending Movies",     path: "/trending/movie/week" },
  top_rated:   { label: "⭐ Top Rated",   title: "Top Rated Movies",    path: "/movie/top_rated" },
  now_playing: { label: "🎞️ Now Playing", title: "Now Playing",         path: "/movie/now_playing" },
  upcoming:    { label: "📅 Upcoming",    title: "Upcoming Movies",     path: "/movie/upcoming" },
  foryou:      { label: "🤖 For You (AI)", title: "🤖 For You: AI picks", ai: true }
};

// ids use | which means OR (for example Horror OR Thriller)
const MOODS = {
  laugh:     { label: "😂 Laugh",         ids: "35" },
  scare:     { label: "😱 Scare me",      ids: "27|53" },
  romance:   { label: "❤️ Romance",       ids: "10749" },
  adventure: { label: "🚀 Adventure",     ids: "12|28" },
  mind:      { label: "🧠 Mind-bending",  ids: "878|9648" }
};

/* ---------- App state: what the page is showing right now ---------- */
const state = {
  mode: "tab",        // "tab", "search" or "discover" (genre / mood)
  tab: "trending",
  query: "",
  discover: null,     // { ids, label, moodKey }
  page: 1,
  totalPages: 1,
  movies: [],
  reqId: 0,           // used to ignore old, slow answers
  aiModel: null,      // the trained taste model (rebuilt when feedback changes)
  aiRef: null,        // popular movies used as a yardstick for "AI match"
  aiNotes: new Map(), // movie id -> { match, reasons } for the For You cards
  aiLast: null        // numbers about the last training run
};

let genresMap = {};

/* ---------- Small helper functions ---------- */
// Makes text safe before putting it inside HTML (stops broken layout / XSS)
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

function yearOf(dateText) {
  return dateText ? dateText.slice(0, 4) : "N/A";
}

function posterUrl(path) {
  return path ? IMG_URL + path : NO_IMAGE;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 3000);
}

// One function for every TMDB request. It also checks for HTTP errors.
async function fetchJSON(path, params = {}) {
  if (API_KEY === "YOUR_TMDB_API_KEY") throw new Error("NO_KEY");
  const url = new URL(BASE_URL + path);
  url.searchParams.set("api_key", API_KEY);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error("HTTP " + res.status);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function friendlyError(err) {
  if (err.message === "NO_KEY") return "API key missing. Open script.js and paste your TMDB key on line 7.";
  if (err.status === 401) return "TMDB did not accept the API key. Please check the key in script.js.";
  if (err.status === 429) return "Too many requests. Wait a few seconds and try again.";
  if (err instanceof TypeError) return "No internet connection. Please check your network.";
  return "Something went wrong (" + err.message + ").";
}

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", () => {
  loadTheme();
  buildChips();
  updateWatchCount();
  fetchGenres();
  loadMovies(false);
});

/* ---------- THEME TOGGLE ---------- */
function loadTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "light") {
    document.body.classList.add("light");
    themeToggle.textContent = "☀️";
  }
}

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("light");
  const isLight = document.body.classList.contains("light");
  themeToggle.textContent = isLight ? "☀️" : "🌙";
  localStorage.setItem("theme", isLight ? "light" : "dark");
});

/* ---------- GENRES (for the dropdown) ---------- */
async function fetchGenres() {
  try {
    const data = await fetchJSON("/genre/movie/list");
    data.genres.forEach(g => {
      genresMap[g.id] = g.name;
      const opt = document.createElement("option");
      opt.value = g.id;
      opt.textContent = g.name;
      genreFilter.appendChild(opt);
    });
  } catch (err) {
    console.error("Error fetching genres:", err);
  }
}

genreFilter.addEventListener("change", () => {
  const id = genreFilter.value;
  if (!id) {
    selectTab(state.tab);
  } else {
    setDiscover({ ids: id, label: `${genresMap[id]} Movies`, moodKey: null });
  }
});

/* ---------- TABS AND MOOD BUTTONS ---------- */
function buildChips() {
  Object.entries(TABS).forEach(([key, t]) => {
    const b = document.createElement("button");
    b.className = "chip" + (t.ai ? " chip-ai" : "");
    b.dataset.tab = key;
    b.textContent = t.label;
    b.addEventListener("click", () => selectTab(key));
    tabBar.appendChild(b);
  });
  Object.entries(MOODS).forEach(([key, m]) => {
    const b = document.createElement("button");
    b.className = "chip chip-mood";
    b.dataset.mood = key;
    b.textContent = m.label;
    b.addEventListener("click", () => selectMood(key));
    moodBar.appendChild(b);
  });
  updateChips();
}

function updateChips() {
  tabBar.querySelectorAll(".chip").forEach(b => {
    b.classList.toggle("active", state.mode === "tab" && state.tab === b.dataset.tab);
  });
  moodBar.querySelectorAll(".chip").forEach(b => {
    b.classList.toggle("active", state.mode === "discover" && state.discover?.moodKey === b.dataset.mood);
  });
}

function selectTab(key) {
  state.mode = "tab";
  state.tab = key;
  state.query = "";
  state.discover = null;
  searchInput.value = "";
  genreFilter.value = "";
  updateChips();
  loadMovies(false);
}

function selectMood(key) {
  const isActive = state.mode === "discover" && state.discover?.moodKey === key;
  if (isActive) {            // pressing the same mood again switches it off
    selectTab(state.tab);
    return;
  }
  genreFilter.value = "";
  setDiscover({ ids: MOODS[key].ids, label: `${MOODS[key].label} picks`, moodKey: key });
}

function setDiscover(info) {
  state.mode = "discover";
  state.discover = info;
  state.query = "";
  searchInput.value = "";
  updateChips();
  loadMovies(false);
}

/* ---------- SEARCH (debounced: waits 500 ms after the user stops typing) ---------- */
let debounceTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const query = searchInput.value.trim();
    if (query) {
      state.mode = "search";
      state.query = query;
      state.discover = null;
      genreFilter.value = "";
    } else {
      state.mode = "tab";
      state.query = "";
    }
    updateChips();
    loadMovies(false);
  }, 500);
});

/* ---------- LOAD MOVIES (one function for trending, search, genre, mood, load more) ---------- */
function buildRequest() {
  if (state.mode === "search") {
    return { path: "/search/movie", params: { query: state.query } };
  }
  if (state.mode === "discover") {
    return {
      path: "/discover/movie",
      params: { with_genres: state.discover.ids, sort_by: "popularity.desc", "vote_count.gte": 50 }
    };
  }
  return { path: TABS[state.tab].path, params: {} };
}

function currentTitle() {
  if (state.mode === "search") return `Search results for "${state.query}"`;
  if (state.mode === "discover") return state.discover.label;
  return TABS[state.tab].title;
}

async function loadMovies(append) {
  const myReq = ++state.reqId;
  statusMsg.classList.add("hidden");
  sectionTitle.textContent = currentTitle();

  if (isForYou()) {            // the AI tab does not use a normal TMDB list
    loadForYou(myReq);
    return;
  }

  if (append) {
    state.page += 1;
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = "Loading...";
  } else {
    state.page = 1;
    state.movies = [];
    loadMoreBtn.classList.add("hidden");
    showSkeletons();
  }

  const { path, params } = buildRequest();
  try {
    const data = await fetchJSON(path, { ...params, page: state.page });
    if (myReq !== state.reqId) return; // a newer request started, ignore this old answer
    state.totalPages = Math.min(data.total_pages || 1, 500);
    const known = new Set(state.movies.map(m => m.id));
    state.movies = state.movies.concat((data.results || []).filter(m => !known.has(m.id)));
    renderMovies();
  } catch (err) {
    if (myReq !== state.reqId) return;
    console.error("Error loading movies:", err);
    if (append) state.page -= 1;
    showError(err, append);
  }
}

function showError(err, append) {
  if (!append) movieGrid.innerHTML = "";
  noResults.classList.add("hidden");
  statusMsg.innerHTML = `<span>${esc(friendlyError(err))}</span> <button id="retryBtn" class="btn">Try again</button>`;
  statusMsg.classList.remove("hidden");
  document.getElementById("retryBtn").addEventListener("click", () => loadMovies(append));
  loadMoreBtn.disabled = false;
  loadMoreBtn.textContent = "Load more";
  loadMoreBtn.classList.toggle("hidden", !append);
}

/* ---------- SORTING (done in the browser on the movies already loaded) ---------- */
function sortedMovies() {
  const list = state.movies.slice();
  const mode = sortSelect.value;
  if (mode === "rating") list.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
  if (mode === "newest") list.sort((a, b) => (b.release_date || "").localeCompare(a.release_date || ""));
  if (mode === "az") list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  return list;
}

sortSelect.addEventListener("change", renderMovies);

/* ---------- RENDER MOVIE CARDS ---------- */
function markFor(movieId) {
  const saved = getWatchlist().find(m => m.id === movieId);
  if (!saved) return "";
  return saved.watched ? "✓" : "⭐";
}

function applyMark(markEl, movieId) {
  const text = markFor(movieId);
  markEl.textContent = text;
  markEl.classList.toggle("done", text === "✓");
}

function createCard(movie, options = {}) {
  const card = document.createElement("div");
  card.className = "movie-card";
  card.dataset.id = movie.id;
  card.tabIndex = 0;

  const img = document.createElement("img");
  img.src = posterUrl(movie.poster_path);
  img.alt = movie.title || "Movie poster";
  img.loading = "lazy";
  img.addEventListener("error", () => { img.src = NO_IMAGE; }, { once: true });

  const info = document.createElement("div");
  info.className = "movie-card-info";
  info.innerHTML = `
    <h3>${esc(movie.title)}</h3>
    <p>${esc(yearOf(movie.release_date))}</p>
    <span class="rating-badge">⭐ ${movie.vote_average ? movie.vote_average.toFixed(1) : "N/A"}</span>
  `;

  const mark = document.createElement("span");
  mark.className = "mark";
  applyMark(mark, movie.id);

  if (options.note) {          // AI line on For You cards
    const note = document.createElement("p");
    note.className = "ai-note";
    note.textContent = `🤖 ${options.note.match}% match` +
      (options.note.reasons.length ? " · " + options.note.reasons.slice(0, 2).join(", ") : "");
    info.appendChild(note);
  }

  card.append(img, info, mark);

  if (options.removable) {
    const rm = document.createElement("button");
    rm.className = "remove-btn";
    rm.title = "Remove from watchlist";
    rm.textContent = "×";
    rm.addEventListener("click", (e) => {
      e.stopPropagation();
      removeFromWatchlist(movie.id);
    });
    card.appendChild(rm);
  }

  const open = () => {
    if (options.closeWatchlistFirst) watchlistModal.classList.add("hidden");
    openMovieDetail(movie.id);
  };
  card.addEventListener("click", open);
  card.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
  return card;
}

function renderMovies() {
  movieGrid.innerHTML = "";
  statusMsg.classList.add("hidden");

  if (state.movies.length === 0) {
    noResults.classList.remove("hidden");
    loadMoreBtn.classList.add("hidden");
    return;
  }
  noResults.classList.add("hidden");

  const forYou = isForYou();
  sortedMovies().forEach(movie => {
    movieGrid.appendChild(createCard(movie, { note: forYou ? state.aiNotes.get(movie.id) : null }));
  });

  loadMoreBtn.disabled = false;
  loadMoreBtn.textContent = "Load more";
  loadMoreBtn.classList.toggle("hidden", state.page >= state.totalPages);
}

loadMoreBtn.addEventListener("click", () => loadMovies(true));

function showSkeletons() {
  movieGrid.innerHTML = "";
  noResults.classList.add("hidden");
  for (let i = 0; i < 10; i++) {
    const skeleton = document.createElement("div");
    skeleton.className = "skeleton";
    movieGrid.appendChild(skeleton);
  }
}

// Updates the small ⭐ / ✓ marks on every visible card
function refreshBadges() {
  document.querySelectorAll(".movie-card[data-id]").forEach(card => {
    const mark = card.querySelector(".mark");
    if (mark) applyMark(mark, Number(card.dataset.id));
  });
}

/* ---------- SURPRISE ME ---------- */
surpriseBtn.addEventListener("click", async () => {
  surpriseBtn.disabled = true;
  const oldText = surpriseBtn.textContent;
  surpriseBtn.textContent = "🎲 Picking...";
  try {
    const params = {
      sort_by: "popularity.desc",
      "vote_average.gte": 6.5,
      "vote_count.gte": 500,
      page: 1 + Math.floor(Math.random() * 15)
    };
    if (state.mode === "discover") params.with_genres = state.discover.ids; // respects mood / genre
    let data = await fetchJSON("/discover/movie", params);
    if (!data.results || data.results.length === 0) {
      data = await fetchJSON("/discover/movie", { ...params, page: 1 });
    }
    if (!data.results || data.results.length === 0) {
      showToast("No movie found. Try another mood.");
    } else {
      const pick = data.results[Math.floor(Math.random() * data.results.length)];
      openMovieDetail(pick.id);
    }
  } catch (err) {
    showToast(friendlyError(err));
  } finally {
    surpriseBtn.disabled = false;
    surpriseBtn.textContent = oldText;
  }
});

/* ---------- MOVIE DETAIL POP-UP ---------- */
let modalReq = 0;

async function openMovieDetail(movieId) {
  const myReq = ++modalReq;
  movieModal.classList.remove("hidden");
  modalBody.innerHTML = '<p class="loading">Loading...</p>';
  try {
    // ONE request brings details + cast + trailers + where-to-watch + similar movies
    const movie = await fetchJSON(`/movie/${movieId}`, {
      append_to_response: "credits,videos,watch/providers,recommendations,reviews"
    });
    if (myReq !== modalReq) return;
    renderDetail(movie);
  } catch (err) {
    if (myReq !== modalReq) return;
    console.error("Error loading movie details:", err);
    modalBody.innerHTML = `<p class="loading">${esc(friendlyError(err))}</p>`;
  }
}

function pickTrailer(videos) {
  const youtube = videos.filter(v => v.site === "YouTube" && /^[\w-]+$/.test(v.key));
  return youtube.find(v => v.type === "Trailer" && v.official)
      || youtube.find(v => v.type === "Trailer")
      || youtube.find(v => v.type === "Teaser")
      || null;
}

function providersHTML(prov) {
  const groups = [["flatrate", "Stream"], ["rent", "Rent"], ["buy", "Buy"]];
  let html = "";
  groups.forEach(([key, label]) => {
    const list = prov?.[key];
    if (!list || list.length === 0) return;
    html += `<div class="prov-group"><span class="prov-label">${label}</span>` +
      list.map(p => `<span class="prov-chip">${p.logo_path ? `<img src="${LOGO_URL}${esc(p.logo_path)}" alt="">` : ""}${esc(p.provider_name)}</span>`).join("") +
      `</div>`;
  });
  if (!html) return '<p class="muted">Not listed for India right now.</p>';
  if (prov.link && prov.link.startsWith("https://")) {
    html += `<p class="muted small"><a href="${esc(prov.link)}" target="_blank" rel="noopener">Full list ↗</a></p>`;
  }
  return html;
}

function renderDetail(movie) {
  const cast = (movie.credits?.cast || []).slice(0, 6).map(c => c.name).join(", ") || "N/A";
  const director = (movie.credits?.crew || []).filter(c => c.job === "Director").slice(0, 2).map(c => c.name).join(", ");
  const trailer = pickTrailer(movie.videos?.results || []);
  const prov = movie["watch/providers"]?.results?.[REGION];
  const recs = (movie.recommendations?.results || []).filter(m => m.poster_path).slice(0, 8);
  const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : "";
  const genres = movie.genres?.map(g => g.name).join(", ") || "N/A";

  modalBody.innerHTML = `
    <div class="detail">
      <img class="detail-poster" src="${esc(posterUrl(movie.poster_path))}" alt="${esc(movie.title)} poster">
      <div class="detail-info">
        <h2>${esc(movie.title)} (${esc(yearOf(movie.release_date))})</h2>
        ${movie.tagline ? `<p class="tagline">${esc(movie.tagline)}</p>` : ""}
        <p class="meta">
          <span class="rating-badge">⭐ ${movie.vote_average ? movie.vote_average.toFixed(1) : "N/A"}</span>
          ${runtime ? `<span>${esc(runtime)}</span>` : ""}
          ${movie.original_language ? `<span>${esc(movie.original_language.toUpperCase())}</span>` : ""}
        </p>
        <p class="overview">${esc(movie.overview || "No description available.")}</p>
        <p><strong>Genres:</strong> ${esc(genres)}</p>
        ${director ? `<p><strong>Director:</strong> ${esc(director)}</p>` : ""}
        <p><strong>Cast:</strong> ${esc(cast)}</p>
        <div class="btn-row">
          <button id="watchBtn" class="btn"></button>
          <button id="watchedBtn" class="btn btn-ghost hidden"></button>
          ${trailer
            ? '<button id="trailerBtn" class="btn btn-ghost">▶ Watch Trailer</button>'
            : '<span class="muted small">No trailer available</span>'}
        </div>
      </div>
    </div>
    <div id="trailerBox"></div>
    <h3 class="sub-title">Where to watch in India</h3>
    ${providersHTML(prov)}
    <p class="muted small">Streaming data by JustWatch (via TMDB).</p>
    ${recs.length ? '<h3 class="sub-title">More like this</h3><div id="recRow" class="rec-row"></div>' : ""}
    <h3 class="sub-title">🤖 AI insights</h3>
    <div class="ai-panel">
      <div class="ai-row"><strong>Match for you</strong><div id="aiMatch" class="muted">Thinking...</div></div>
      <div class="ai-row"><strong>Audience mood</strong><div id="aiMood"></div></div>
      <div class="btn-row">
        <span class="muted small">Teach the AI:</span>
        <button id="likeBtn" class="btn btn-ghost">👍 I like this</button>
        <button id="dislikeBtn" class="btn btn-ghost">👎 Not for me</button>
      </div>
    </div>
  `;

  setupAIPanel(movie);

  const watchBtn = document.getElementById("watchBtn");
  const watchedBtn = document.getElementById("watchedBtn");

  function syncButtons() {
    const entry = getWatchlist().find(m => m.id === movie.id);
    watchBtn.textContent = entry ? "✓ In Watchlist (click to remove)" : "+ Add to Watchlist";
    watchedBtn.classList.toggle("hidden", !entry);
    watchedBtn.classList.toggle("on", !!(entry && entry.watched));
    watchedBtn.textContent = entry && entry.watched ? "✓ Watched" : "Mark as watched";
  }
  syncButtons();

  watchBtn.addEventListener("click", () => {
    toggleWatchlist(movie);
    syncButtons();
    refreshBadges();
    updateWatchCount();
  });

  watchedBtn.addEventListener("click", () => {
    toggleWatched(movie.id);
    syncButtons();
    refreshBadges();
  });

  if (trailer) {
    const trailerBtn = document.getElementById("trailerBtn");
    const trailerBox = document.getElementById("trailerBox");
    trailerBtn.addEventListener("click", () => {
      if (trailerBox.innerHTML) {
        trailerBox.innerHTML = "";
        trailerBtn.textContent = "▶ Watch Trailer";
      } else {
        trailerBox.innerHTML =
          `<iframe src="https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&rel=0" ` +
          `title="Trailer" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`;
        trailerBtn.textContent = "■ Hide Trailer";
        trailerBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }

  if (recs.length) {
    const row = document.getElementById("recRow");
    recs.forEach(r => {
      const item = document.createElement("div");
      item.className = "rec-card";
      item.tabIndex = 0;
      item.title = r.title;
      const img = document.createElement("img");
      img.src = IMG_URL + r.poster_path;
      img.alt = r.title;
      img.loading = "lazy";
      const name = document.createElement("span");
      name.textContent = r.title;
      item.append(img, name);
      const open = () => {
        movieModal.querySelector(".modal-content").scrollTop = 0;
        openMovieDetail(r.id);
      };
      item.addEventListener("click", open);
      item.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
      row.appendChild(item);
    });
  }
}

function closeDetail() {
  movieModal.classList.add("hidden");
  modalReq++;
  modalBody.innerHTML = ""; // also stops a playing trailer
}

closeModal.addEventListener("click", closeDetail);
movieModal.addEventListener("click", (e) => {
  if (e.target === movieModal) closeDetail();
});

/* ---------- WATCHLIST (localStorage) ---------- */
function getWatchlist() {
  try {
    const list = JSON.parse(localStorage.getItem("watchlist"));
    return Array.isArray(list) ? list : [];
  } catch (err) {
    return []; // saved data was damaged, start fresh instead of crashing
  }
}

function saveWatchlist(list) {
  state.aiModel = null; // taste changed, the AI must learn again
  localStorage.setItem("watchlist", JSON.stringify(list));
}

function toggleWatchlist(movie) {
  let list = getWatchlist();
  if (list.some(m => m.id === movie.id)) {
    list = list.filter(m => m.id !== movie.id);
  } else {
    list.push({
      id: movie.id,
      title: movie.title,
      poster_path: movie.poster_path,
      release_date: movie.release_date,
      vote_average: movie.vote_average,
      watched: false
    });
    rememberMovie(movie); // the AI needs genres + story text of saved movies
  }
  saveWatchlist(list);
}

function toggleWatched(movieId) {
  const list = getWatchlist();
  const entry = list.find(m => m.id === movieId);
  if (entry) {
    entry.watched = !entry.watched;
    saveWatchlist(list);
  }
}

function removeFromWatchlist(movieId) {
  saveWatchlist(getWatchlist().filter(m => m.id !== movieId));
  updateWatchCount();
  refreshBadges();
  renderWatchlist();
}

function updateWatchCount() {
  const n = getWatchlist().length;
  watchCount.textContent = n;
  watchCount.classList.toggle("hidden", n === 0);
}

/* ---------- WATCHLIST POP-UP ---------- */
let watchFilter = "all"; // "all", "todo" or "done"

function renderWatchlist() {
  const all = getWatchlist();
  const done = all.filter(m => m.watched).length;
  watchSummary.textContent = all.length
    ? `${all.length} saved • ${done} watched • ${all.length - done} to watch`
    : "";

  let list = all;
  if (watchFilter === "todo") list = all.filter(m => !m.watched);
  if (watchFilter === "done") list = all.filter(m => m.watched);

  watchlistGrid.innerHTML = "";
  if (all.length === 0) {
    watchlistGrid.innerHTML = '<p class="muted">Your watchlist is empty. Open a movie and press "Add to Watchlist".</p>';
  } else if (list.length === 0) {
    watchlistGrid.innerHTML = '<p class="muted">Nothing here yet.</p>';
  } else {
    list.forEach(m => watchlistGrid.appendChild(createCard(m, { removable: true, closeWatchlistFirst: true })));
  }

  watchFilterBar.querySelectorAll("button").forEach(b => {
    b.classList.toggle("active", b.dataset.filter === watchFilter);
  });
}

watchFilterBar.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  watchFilter = btn.dataset.filter;
  renderWatchlist();
});

pickFromWatchlist.addEventListener("click", () => {
  const todo = getWatchlist().filter(m => !m.watched);
  if (todo.length === 0) {
    showToast("No unwatched movies in your watchlist.");
    return;
  }
  const pick = todo[Math.floor(Math.random() * todo.length)];
  watchlistModal.classList.add("hidden");
  openMovieDetail(pick.id);
});

watchlistBtn.addEventListener("click", () => {
  renderWatchlist();
  watchlistModal.classList.remove("hidden");
});

closeWatchlist.addEventListener("click", () => watchlistModal.classList.add("hidden"));
watchlistModal.addEventListener("click", (e) => {
  if (e.target === watchlistModal) watchlistModal.classList.add("hidden");
});

/* ---------- ESCAPE KEY closes any pop-up ---------- */
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!movieModal.classList.contains("hidden")) closeDetail();
  if (!watchlistModal.classList.contains("hidden")) watchlistModal.classList.add("hidden");
  if (!aiModal.classList.contains("hidden")) aiModal.classList.add("hidden");
});


/* =====================================================================
   AI FEATURES  (the maths is in ai.js, this part connects it to the page)
===================================================================== */
const AI_MIN = 3; // movies the user must save / like before the AI can learn

function isForYou() {
  return state.mode === "tab" && !!TABS[state.tab].ai;
}

/* ---------- What the AI remembers (stored only in this browser) ---------- */
function readJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
  } catch (err) {
    return fallback;
  }
}

function getFeedback() { return readJSON("feedback", {}); }
function getMemory() { return readJSON("aiMovies", {}); }

// Saves the facts the AI needs about a movie (genres + story text)
function rememberMovie(movie) {
  const compact = {
    id: movie.id,
    title: movie.title,
    poster_path: movie.poster_path,
    release_date: movie.release_date,
    vote_average: movie.vote_average,
    genre_ids: movie.genre_ids || (movie.genres || []).map(g => g.id),
    overview: movie.overview || "",
    original_language: movie.original_language
  };
  try {
    const memory = getMemory();
    memory[movie.id] = compact;
    const ids = Object.keys(memory);
    if (ids.length > 200) delete memory[ids[0]];
    localStorage.setItem("aiMovies", JSON.stringify(memory));
  } catch (err) {
    console.error("Could not save AI memory:", err);
  }
  return compact;
}

// value: 1 = like, -1 = dislike, 0 = clear
function setFeedback(movie, value) {
  const feedback = getFeedback();
  if (value === 0) {
    delete feedback[movie.id];
  } else {
    feedback[movie.id] = value;
    rememberMovie(movie);
  }
  localStorage.setItem("feedback", JSON.stringify(feedback));
  state.aiModel = null;
}

/* ---------- Training data: every movie the user reacted to, with a weight ---------- */
async function getTrainingSet() {
  const weights = new Map();
  const add = (id, w) => weights.set(id, (weights.get(id) || 0) + w);
  getWatchlist().forEach(m => { add(m.id, 1); if (m.watched) add(m.id, 0.5); });
  Object.entries(getFeedback()).forEach(([id, v]) => add(Number(id), v === 1 ? 2 : -3));

  const memory = getMemory();
  const training = [];
  for (const [id, weight] of weights) {
    if (weight === 0) continue;
    let movie = memory[id];
    if (!movie || !movie.overview) {            // saved by an older version: ask TMDB once
      try {
        movie = rememberMovie(await fetchJSON(`/movie/${id}`));
      } catch (err) {
        continue;
      }
    }
    training.push({ movie, weight });
  }
  return training;
}

function countPositive(training) {
  return training.filter(t => t.weight > 0).length;
}

/* ---------- Popular movies, used as a yardstick ---------- */
async function getRefPool() {
  if (state.aiRef) return state.aiRef;
  const [a, b] = await Promise.all([fetchJSON("/trending/movie/week"), fetchJSON("/movie/top_rated")]);
  const seen = new Set();
  const pool = [];
  [...(a.results || []), ...(b.results || [])].forEach(m => {
    if (!seen.has(m.id) && m.overview) { seen.add(m.id); pool.push(m); }
  });
  state.aiRef = pool;
  return pool;
}

/* ---------- Make sure a trained model exists ---------- */
async function ensureModel() {
  const training = await getTrainingSet();
  const positives = countPositive(training);
  if (positives < AI_MIN) return { model: null, positives, training };
  if (!state.aiModel) {
    const pool = await getRefPool();
    state.aiModel = AI.buildModel(training, pool);
    state.aiLast = { trained: training.length, candidates: pool.length, vocab: state.aiModel.vocab };
  }
  return { model: state.aiModel, positives, training };
}

/* ---------- FOR YOU tab ---------- */
async function loadForYou(myReq) {
  loadMoreBtn.classList.add("hidden");
  showSkeletons();
  try {
    const training = await getTrainingSet();
    if (myReq !== state.reqId) return;
    const positives = countPositive(training);
    if (positives < AI_MIN) {
      state.movies = [];
      state.aiNotes = new Map();
      movieGrid.innerHTML = "";
      statusMsg.innerHTML = `<span>🤖 The AI is waiting to learn your taste. Save or 👍 at least ${AI_MIN} movies you like ` +
        `(you have ${positives} so far), then open this tab again.</span>`;
      statusMsg.classList.remove("hidden");
      return;
    }
    const ranked = await aiRecommend(training);
    if (myReq !== state.reqId) return;
    state.movies = ranked.map(r => r.movie);
    state.aiNotes = new Map(ranked.map(r => [r.movie.id, r]));
    state.page = 1;
    state.totalPages = 1;
    renderMovies();
  } catch (err) {
    if (myReq !== state.reqId) return;
    console.error("Error in For You:", err);
    showError(err, false);
  }
}

async function aiRecommend(training) {
  // Step 1: collect candidate movies = TMDB "similar" lists of my best movies + popular movies of my top genres
  const seeds = training.filter(t => t.weight > 0).sort((a, b) => b.weight - a.weight).slice(0, 6);
  const calls = seeds.map(s => fetchJSON(`/movie/${s.movie.id}/recommendations`).then(d => d.results || []));
  AI.topGenreIds(training, 2).forEach(g => {
    calls.push(fetchJSON("/discover/movie", {
      with_genres: g, sort_by: "popularity.desc", "vote_count.gte": 200
    }).then(d => d.results || []));
  });
  const settled = await Promise.allSettled(calls);
  const fulfilled = settled.filter(s => s.status === "fulfilled");
  if (fulfilled.length === 0) throw settled[0].reason;

  // Step 2: remove movies the user already reacted to, and duplicates
  const skip = new Set(training.map(t => t.movie.id));
  const pool = [];
  fulfilled.forEach(s => s.value.forEach(m => {
    if (!skip.has(m.id) && m.overview) { skip.add(m.id); pool.push(m); }
  }));

  // Step 3: learn the taste profile, score every candidate, keep the best 24
  const model = AI.buildModel(training, pool);
  state.aiModel = model;
  state.aiLast = { trained: training.length, candidates: pool.length, vocab: model.vocab };
  return AI.rank(model, pool, 24, genresMap);
}

/* ---------- AI panel inside the movie pop-up ---------- */
function setupAIPanel(movie) {
  const matchEl = document.getElementById("aiMatch");
  const moodEl = document.getElementById("aiMood");
  const likeBtn = document.getElementById("likeBtn");
  const dislikeBtn = document.getElementById("dislikeBtn");
  const myReq = modalReq;

  // Audience mood: sentiment analysis of TMDB reviews
  moodEl.innerHTML = sentimentHTML(AI.analyzeReviews(movie.reviews?.results));

  function syncThumbs() {
    const value = getFeedback()[movie.id] || 0;
    likeBtn.classList.toggle("on", value === 1);
    dislikeBtn.classList.toggle("bad", value === -1);
    likeBtn.textContent = value === 1 ? "👍 Liked" : "👍 I like this";
    dislikeBtn.textContent = value === -1 ? "👎 Disliked" : "👎 Not for me";
  }
  syncThumbs();

  likeBtn.addEventListener("click", () => {
    setFeedback(movie, getFeedback()[movie.id] === 1 ? 0 : 1);
    syncThumbs();
    updateAIMatch(movie, matchEl, myReq);
  });
  dislikeBtn.addEventListener("click", () => {
    setFeedback(movie, getFeedback()[movie.id] === -1 ? 0 : -1);
    syncThumbs();
    updateAIMatch(movie, matchEl, myReq);
  });

  updateAIMatch(movie, matchEl, myReq);
}

async function updateAIMatch(movie, el, myReq) {
  el.textContent = "Thinking...";
  try {
    const { model, positives } = await ensureModel();
    if (myReq !== modalReq) return;
    if (!model) {
      el.innerHTML = `Save or 👍 ${AI_MIN} movies to unlock your personal AI match (you have ${positives} so far).`;
      return;
    }
    const ref = await getRefPool();
    if (myReq !== modalReq) return;
    const result = AI.percentile(model, movie, ref);
    const reasons = model.explain(movie, genresMap);
    if (!result) { el.textContent = "Not enough data."; return; }
    const word = result.pct >= 80 ? "Strong match" : result.pct >= 50 ? "Decent match" : "Probably not your style";
    el.innerHTML = `<span class="ai-score">${result.pct}</span> <strong>${word}</strong><br>` +
      `<span class="muted small">Matches your taste better than ${result.pct}% of ${result.n} popular movies.` +
      (reasons.length ? ` Because: ${esc(reasons.join(", "))}.` : "") + `</span>`;
  } catch (err) {
    if (myReq !== modalReq) return;
    el.textContent = friendlyError(err);
  }
}

function sentimentHTML(r) {
  if (r.total === 0) return '<span class="muted">No reviews on TMDB yet for this movie.</span>';
  const pct = n => Math.round(100 * n / r.total);
  const c = r.counts;
  let html = `<div class="sent-bar" title="green = positive, grey = neutral, red = negative">` +
    `<span class="pos" style="width:${pct(c.positive)}%"></span>` +
    `<span class="neu" style="width:${pct(c.neutral)}%"></span>` +
    `<span class="neg" style="width:${pct(c.negative)}%"></span></div>` +
    `<strong>${esc(r.verdict)}</strong> ` +
    `<span class="muted small">(${c.positive} positive, ${c.neutral} neutral, ${c.negative} negative, out of ${r.total} reviews)</span>`;
  if (r.checked > 0) {
    html += `<br><span class="muted small">Self-check: our NLP agreed with the reviewers' own star ratings in ${r.matched} of ${r.checked} reviews.</span>`;
  }
  return html;
}

/* ---------- AI LAB pop-up (taste profile + how it works) ---------- */
function barsHTML(title, items) {
  if (!items.length) return "";
  return `<div class="bar-block"><h4>${esc(title)}</h4>` + items.map(i =>
    `<div class="bar-row"><span>${esc(i.label)}</span><div class="bar"><i style="width:${Math.max(6, Math.round(i.value * 100))}%"></i></div></div>`
  ).join("") + `</div>`;
}

async function openAILab() {
  aiModal.classList.remove("hidden");
  aiBody.innerHTML = '<p class="loading">Loading...</p>';
  let profileHTML;
  try {
    const { model, positives, training } = await ensureModel();
    if (!model) {
      profileHTML = `<p class="muted">The AI has not learned your taste yet. Save or 👍 ${AI_MIN} movies (you have ${positives}). ` +
        `Then open this page again to see your profile.</p>`;
    } else {
      const t = AI.tasteSummary(training, model, genresMap);
      const last = state.aiLast || {};
      profileHTML = `<div class="bars">` +
        barsHTML("Favourite genres", t.genres) + barsHTML("Favourite decades", t.decades) +
        barsHTML("Favourite languages", t.languages) + barsHTML("Story themes you like", t.themes) +
        `</div><p class="muted small">Trained on ${last.trained ?? training.length} movies you reacted to, ` +
        `using ${last.vocab ?? model.vocab} features (words, genres, decades). ` +
        `Compared against ${last.candidates ?? "?"} candidate movies.</p>`;
    }
  } catch (err) {
    profileHTML = `<p class="muted">${esc(friendlyError(err))}</p>`;
  }

  aiBody.innerHTML = `
    <h2>🤖 AI Lab</h2>
    <p class="muted">MovieHub uses machine learning that runs inside your browser. No server and no paid AI service is used,
    and your taste data never leaves this device.</p>

    <h3 class="sub-title">Your taste profile (learned)</h3>
    ${profileHTML}

    <h3 class="sub-title">How the recommender works</h3>
    <ol class="steps">
      <li><strong>Turn movies into numbers.</strong> Genres, language, decade and the words of the story are counted for every movie.</li>
      <li><strong>TF-IDF weighting.</strong> A word matters more if it is special to a movie and rare in other movies.</li>
      <li><strong>Learn your taste.</strong> Movies you save or like are added up into one "taste profile". Movies you dislike are subtracted.</li>
      <li><strong>Cosine similarity.</strong> Every candidate movie is compared with your profile. The closer the direction, the higher the match.</li>
      <li><strong>Explain.</strong> The features that matched the most are shown as the reason ("because: Sci-Fi, theme dream").</li>
    </ol>
    <p class="muted small">Type of ML: content-based filtering with relevance feedback (Rocchio method). It learns from your reactions only.</p>

    <h3 class="sub-title">How the review mood works</h3>
    <p class="muted">Natural Language Processing: every word of a review has a score (for example "brilliant" is positive, "boring" is negative).
    Words like "not" flip the meaning and words like "very" make it stronger. We then compare our result with the star rating the reviewer gave.</p>

    <div class="btn-row">
      <button id="resetAI" class="btn btn-ghost">Reset AI memory (keeps your watchlist)</button>
    </div>
  `;

  document.getElementById("resetAI").addEventListener("click", () => {
    localStorage.removeItem("feedback");
    localStorage.removeItem("aiMovies");
    state.aiModel = null;
    state.aiNotes = new Map();
    showToast("AI memory cleared.");
    openAILab();
  });
}

aiBtn.addEventListener("click", openAILab);
closeAI.addEventListener("click", () => aiModal.classList.add("hidden"));
aiModal.addEventListener("click", (e) => {
  if (e.target === aiModal) aiModal.classList.add("hidden");
});
