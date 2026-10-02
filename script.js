/* ==========================================
   MovieHub - script.js
   TODO: Replace YOUR_TMDB_API_KEY below with your real key
   Get a free key at: https://www.themoviedb.org/settings/api
========================================== */

const API_KEY = "5d18dc941ad299a9f3924683d7bb18d8";
const BASE_URL = "https://api.themoviedb.org/3";
const IMG_URL = "https://image.tmdb.org/t/p/w500";

const movieGrid = document.getElementById("movieGrid");
const searchInput = document.getElementById("searchInput");
const genreFilter = document.getElementById("genreFilter");
const sectionTitle = document.getElementById("currentSectionTitle");
const noResults = document.getElementById("noResults");

const movieModal = document.getElementById("movieModal");
const modalBody = document.getElementById("modalBody");
const closeModal = document.getElementById("closeModal");

const watchlistBtn = document.getElementById("watchlistBtn");
const watchlistModal = document.getElementById("watchlistModal");
const watchlistGrid = document.getElementById("watchlistGrid");
const closeWatchlist = document.getElementById("closeWatchlist");

const themeToggle = document.getElementById("themeToggle");

let genresMap = {};

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", () => {
  loadTheme();
  fetchGenres();
  fetchTrending();
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

/* ---------- FETCH GENRES (for filter dropdown) ---------- */
async function fetchGenres() {
  try {
    const res = await fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}`);
    const data = await res.json();
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

/* ---------- FETCH TRENDING (default view) ---------- */
async function fetchTrending() {
  sectionTitle.textContent = "Trending Movies";
  showSkeletons();
  try {
    const res = await fetch(`${BASE_URL}/trending/movie/week?api_key=${API_KEY}`);
    const data = await res.json();
    renderMovies(data.results);
  } catch (err) {
    console.error("Error fetching trending movies:", err);
    movieGrid.innerHTML = "<p>Something went wrong. Check your API key or connection.</p>";
  }
}

/* ---------- SEARCH MOVIES (debounced) ---------- */
let debounceTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  const query = searchInput.value.trim();

  debounceTimer = setTimeout(() => {
    if (query.length === 0) {
      fetchTrending();
    } else {
      searchMovies(query);
    }
  }, 500); // waits 500ms after user stops typing
});

async function searchMovies(query) {
  sectionTitle.textContent = `Search results for "${query}"`;
  showSkeletons();
  try {
    const res = await fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}`);
    const data = await res.json();
    renderMovies(data.results);
  } catch (err) {
    console.error("Error searching movies:", err);
  }
}

/* ---------- GENRE FILTER ---------- */
genreFilter.addEventListener("change", async () => {
  const genreId = genreFilter.value;
  if (!genreId) {
    fetchTrending();
    return;
  }
  sectionTitle.textContent = `${genresMap[genreId]} Movies`;
  showSkeletons();
  try {
    const res = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=${genreId}`);
    const data = await res.json();
    renderMovies(data.results);
  } catch (err) {
    console.error("Error filtering by genre:", err);
  }
});

/* ---------- RENDER MOVIE CARDS ---------- */
function renderMovies(movies) {
  movieGrid.innerHTML = "";

  if (!movies || movies.length === 0) {
    noResults.classList.remove("hidden");
    return;
  }
  noResults.classList.add("hidden");

  movies.forEach(movie => {
    const card = document.createElement("div");
    card.className = "movie-card";
    card.innerHTML = `
      <img src="${movie.poster_path ? IMG_URL + movie.poster_path : 'https://via.placeholder.com/300x450?text=No+Image'}" alt="${movie.title}">
      <div class="movie-card-info">
        <h3>${movie.title}</h3>
        <p>${movie.release_date ? movie.release_date.split("-")[0] : "N/A"}</p>
        <span class="rating-badge">⭐ ${movie.vote_average ? movie.vote_average.toFixed(1) : "N/A"}</span>
      </div>
    `;
    card.addEventListener("click", () => openMovieDetail(movie.id));
    movieGrid.appendChild(card);
  });
}

/* ---------- SKELETON LOADING ---------- */
function showSkeletons() {
  movieGrid.innerHTML = "";
  noResults.classList.add("hidden");
  for (let i = 0; i < 10; i++) {
    const skeleton = document.createElement("div");
    skeleton.className = "skeleton";
    movieGrid.appendChild(skeleton);
  }
}

/* ---------- MOVIE DETAIL MODAL ---------- */

   async function openMovieDetail(movieId) {
  movieModal.classList.remove("hidden");
  modalBody.innerHTML = "<p>Loading...</p>";
  try {
    const res = await fetch(`${BASE_URL}/movie/${movieId}?api_key=${API_KEY}&append_to_response=credits`);
    const movie = await res.json();
    const cast = movie.credits?.cast?.slice(0, 5).map(c => c.name).join(", ") || "N/A";
    const inWatchlist = isInWatchlist(movie.id);

    modalBody.innerHTML = `
      <div style="display:flex; gap:20px; flex-wrap:wrap;">
        <img src="${movie.poster_path ? IMG_URL + movie.poster_path : ''}" style="width:200px; border-radius:8px;">
        <div>
          <h2>${movie.title} (${movie.release_date ? movie.release_date.split("-")[0] : "N/A"})</h2>
          <p class="rating-badge">⭐ ${movie.vote_average?.toFixed(1) || "N/A"}</p>
          <p style="margin-top:10px;">${movie.overview || "No description available."}</p>
          <p style="margin-top:10px;"><strong>Genres:</strong> ${movie.genres?.map(g => g.name).join(", ") || "N/A"}</p>
          <p style="margin-top:6px;"><strong>Cast:</strong> ${cast}</p>
          <button id="addToWatchlistBtn" style="margin-top:16px; padding:8px 16px; border-radius:20px; border:none; background:var(--accent); color:white; cursor:pointer;">
            ${inWatchlist ? "✓ In Watchlist" : "+ Add to Watchlist"}
          </button>
        </div>
      </div>
    `;

    document.getElementById("addToWatchlistBtn").addEventListener("click", () => {
      toggleWatchlist(movie);
      openMovieDetail(movieId);
    });
  } catch (err) {
    console.error("Error loading movie details:", err);
    modalBody.innerHTML = "<p>Failed to load movie details.</p>";
  }
}

closeModal.addEventListener("click", () => movieModal.classList.add("hidden"));
movieModal.addEventListener("click", (e) => {
  if (e.target === movieModal) movieModal.classList.add("hidden");
});

/* ---------- WATCHLIST (localStorage) ---------- */
function getWatchlist() {
  return JSON.parse(localStorage.getItem("watchlist")) || [];
}

function isInWatchlist(movieId) {
  return getWatchlist().some(m => m.id === movieId);
}

function toggleWatchlist(movie) {
  let list = getWatchlist();
  if (isInWatchlist(movie.id)) {
    list = list.filter(m => m.id !== movie.id);
  } else {
    list.push({
      id: movie.id,
      title: movie.title,
      poster_path: movie.poster_path,
      release_date: movie.release_date,
      vote_average: movie.vote_average
    });
  }
  localStorage.setItem("watchlist", JSON.stringify(list));
}

watchlistBtn.addEventListener("click", () => {
  const list = getWatchlist();
  watchlistGrid.innerHTML = "";
  if (list.length === 0) {
    watchlistGrid.innerHTML = "<p>Your watchlist is empty. Add movies from their detail page!</p>";
  } else {
    renderMoviesInto(watchlistGrid, list);
  }
  watchlistModal.classList.remove("hidden");
});

function renderMoviesInto(container, movies) {
  container.innerHTML = "";
  movies.forEach(movie => {
    const card = document.createElement("div");
    card.className = "movie-card";
    card.innerHTML = `
      <img src="${movie.poster_path ? IMG_URL + movie.poster_path : 'https://via.placeholder.com/300x450?text=No+Image'}" alt="${movie.title}">
      <div class="movie-card-info">
        <h3>${movie.title}</h3>
        <p>${movie.release_date ? movie.release_date.split("-")[0] : "N/A"}</p>
        <span class="rating-badge">⭐ ${movie.vote_average ? movie.vote_average.toFixed(1) : "N/A"}</span>
      </div>
    `;
    card.addEventListener("click", () => {
      watchlistModal.classList.add("hidden");
      openMovieDetail(movie.id);
    });
    container.appendChild(card);
  });
}

closeWatchlist.addEventListener("click", () => watchlistModal.classList.add("hidden"));
watchlistModal.addEventListener("click", (e) => {
  if (e.target === watchlistModal) watchlistModal.classList.add("hidden");
});
