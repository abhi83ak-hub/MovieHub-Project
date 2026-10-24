/* ==========================================================
   MovieHub - ai.js   (the AI / Machine Learning part)
   Everything here runs inside the browser. No server and no
   paid AI service is used.

   PART 1  Recommender  : TF-IDF + cosine similarity + a "taste
                          profile" learned from the user's feedback
                          (content-based filtering, Rocchio method)
   PART 2  Sentiment    : reads review text and decides if it is
                          positive or negative (NLP, lexicon based)
========================================================== */

const AI = (() => {

  /* ---------------------------------------------------------
     PART 1 - TEXT PROCESSING (turn a movie into numbers)
  --------------------------------------------------------- */

  // Very common words carry no meaning for matching, so we drop them
  const STOP = new Set((
    "a an the and or but if then of to in on at for with without from by as is are was were be been being " +
    "it its this that these those he she they them his her their we you i me my our your not no nor so very " +
    "too can will just than into out up down over under again once about after before during while who whom " +
    "what which when where why how all any both each few more most other some such only own same also has " +
    "have had do does did doing would could should may might must one two film movie movies story films " +
    "based new man woman young life world back find finds city through across"
  ).split(" "));

  // Cuts word endings so "running", "runs" and "ran" are treated alike (simple stemming)
  function stem(w) {
    if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
    if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
    if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
    return w;
  }

  function tokenize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP.has(w))
      .map(stem);
  }

  // A movie becomes a bag of "features" with counts:
  //   g:28 = genre, l:en = language, d:2010 = decade, r:high = rating band, w:space = word from the story
  function movieTokens(m) {
    const t = new Map();
    const add = (key, n = 1) => t.set(key, (t.get(key) || 0) + n);
    const genreIds = m.genre_ids || (m.genres || []).map(g => g.id);
    genreIds.forEach(id => add("g:" + id, 3));            // genre counts more than a single word
    if (m.original_language) add("l:" + m.original_language);
    const year = parseInt((m.release_date || "").slice(0, 4), 10);
    if (year) add("d:" + Math.floor(year / 10) * 10);
    const v = m.vote_average || 0;
    add("r:" + (v >= 7.5 ? "high" : v >= 6.5 ? "good" : "low"));
    tokenize(m.overview).forEach(w => add("w:" + w));
    return t;
  }

  // TF-IDF: a feature is important if it appears often in THIS movie
  // but is rare in other movies. Then the vector is scaled to length 1.
  function toVector(tokens, idf) {
    const v = new Map();
    let norm = 0;
    tokens.forEach((tf, key) => {
      const w = (1 + Math.log(tf)) * idf(key);
      v.set(key, w);
      norm += w * w;
    });
    norm = Math.sqrt(norm) || 1;
    v.forEach((w, key) => v.set(key, w / norm));
    return v;
  }

  // Dot product of two vectors. For length-1 vectors this IS the cosine similarity.
  function dot(a, b) {
    const [small, big] = a.size < b.size ? [a, b] : [b, a];
    let sum = 0;
    small.forEach((w, key) => { const o = big.get(key); if (o) sum += w * o; });
    return sum;
  }

  /* ---------------------------------------------------------
     PART 1 - THE MODEL
     training = [{ movie, weight }]  weight > 0 liked, < 0 disliked
     pool     = movies we may recommend (used to measure rarity)
  --------------------------------------------------------- */
  function buildModel(training, pool) {
    const tokenMaps = new Map();
    const df = new Map();           // in how many movies does each feature appear?
    training.map(t => t.movie).concat(pool).forEach(m => {
      if (tokenMaps.has(m.id)) return;
      const t = movieTokens(m);
      tokenMaps.set(m.id, t);
      t.forEach((_, key) => df.set(key, (df.get(key) || 0) + 1));
    });
    const N = tokenMaps.size;
    const idf = key => Math.log((N + 1) / ((df.get(key) || 0) + 1)) + 1;
    const vector = m => toVector(tokenMaps.get(m.id) || movieTokens(m), idf);

    // Taste profile = weighted sum of the vectors of movies the user reacted to.
    // Liked movies pull the profile towards them, disliked movies push it away.
    const profile = new Map();
    training.forEach(({ movie, weight }) => {
      vector(movie).forEach((w, key) => profile.set(key, (profile.get(key) || 0) + weight * w));
    });
    let pNorm = 0;
    profile.forEach(w => { pNorm += w * w; });
    pNorm = Math.sqrt(pNorm) || 1;

    const model = {
      profile,
      size: N,
      vocab: df.size,
      trainCount: training.length,
      vector,
      // cosine similarity between the taste profile and one movie
      score: m => dot(profile, vector(m)) / pNorm,
      // the 3 features that made this movie match the most
      explain(m, names = {}) {
        const parts = [];
        vector(m).forEach((w, key) => {
          const p = profile.get(key);
          if (p > 0) parts.push([key, p * w]);
        });
        parts.sort((a, b) => b[1] - a[1]);
        const out = [];
        for (const [key] of parts) {
          const label = labelFor(key, names);
          if (label && !out.includes(label)) out.push(label);
          if (out.length === 3) break;
        }
        return out;
      }
    };
    return model;
  }

  function labelFor(key, names) {
    const value = key.slice(2);
    if (key.startsWith("g:")) return names[value] || null;
    if (key.startsWith("d:")) return value + "s era";
    if (key.startsWith("l:")) return "language " + value.toUpperCase();
    if (key.startsWith("w:") && value.length >= 4) return "theme \"" + value + "\"";
    return null;
  }

  // Score every candidate and keep the best k
  function rank(model, candidates, k, names) {
    const scored = candidates
      .map(movie => ({ movie, score: model.score(movie) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
    const top = scored.length && scored[0].score > 0 ? scored[0].score : 1;
    return scored.map(s => ({
      movie: s.movie,
      score: s.score,
      match: Math.max(0, Math.round(100 * s.score / top)),   // best pick = 100
      reasons: model.explain(s.movie, names)
    }));
  }

  // "This movie matches you better than X% of popular movies"
  function percentile(model, movie, referencePool) {
    const others = referencePool.filter(m => m.id !== movie.id);
    if (others.length === 0) return null;
    const s = model.score(movie);
    const below = others.filter(m => model.score(m) <= s).length;
    return { score: s, pct: Math.round(100 * below / others.length), n: others.length };
  }

  // The genres the user likes most (used to fetch extra candidates)
  function topGenreIds(training, n) {
    const sums = new Map();
    training.filter(t => t.weight > 0).forEach(({ movie, weight }) => {
      (movie.genre_ids || (movie.genres || []).map(g => g.id)).forEach(id => {
        sums.set(id, (sums.get(id) || 0) + weight);
      });
    });
    return [...sums.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0]);
  }

  // Numbers for the "taste profile" bars in the AI Lab
  function tasteSummary(training, model, names) {
    const genres = new Map(), decades = new Map(), langs = new Map();
    const bump = (map, key, w) => map.set(key, (map.get(key) || 0) + w);
    training.filter(t => t.weight > 0).forEach(({ movie, weight }) => {
      (movie.genre_ids || (movie.genres || []).map(g => g.id)).forEach(id => bump(genres, names[id] || "Genre " + id, weight));
      const y = parseInt((movie.release_date || "").slice(0, 4), 10);
      if (y) bump(decades, Math.floor(y / 10) * 10 + "s", weight);
      if (movie.original_language) bump(langs, movie.original_language.toUpperCase(), weight);
    });
    const themes = [];
    model.profile.forEach((w, key) => {
      if (key.startsWith("w:") && key.length >= 6 && w > 0) themes.push([key.slice(2), w]);
    });
    const top = (entries, n) => {
      const list = [...entries].sort((a, b) => b[1] - a[1]).slice(0, n);
      const max = list.length ? list[0][1] : 1;
      return list.map(([label, value]) => ({ label, value: value / max }));
    };
    return {
      genres: top(genres, 5),
      decades: top(decades, 4),
      languages: top(langs, 3),
      themes: top(themes, 6)
    };
  }

  /* ---------------------------------------------------------
     PART 2 - SENTIMENT ANALYSIS (is a review positive or negative?)
     Each word has a score. Negation words flip the meaning ("not good"),
     booster words make it stronger ("very good").
  --------------------------------------------------------- */
  const LEXICON = {
    // positive words
    good: 1.9, great: 3.1, amazing: 3.4, awesome: 3.1, excellent: 3.2, brilliant: 3.0, fantastic: 3.2,
    masterpiece: 3.6, perfect: 3.0, love: 3.2, loved: 3.0, loves: 3.0, enjoy: 2.2, enjoyed: 2.3,
    enjoyable: 2.4, fun: 2.3, funny: 2.0, hilarious: 2.6, beautiful: 2.9, stunning: 3.0, gorgeous: 2.8,
    impressive: 2.5, powerful: 2.3, moving: 2.0, touching: 2.4, charming: 2.4, clever: 2.2, smart: 2.0,
    thrilling: 2.5, exciting: 2.5, gripping: 2.6, engaging: 2.3, entertaining: 2.5, stellar: 3.0,
    superb: 3.2, outstanding: 3.2, favorite: 2.5, favourite: 2.5, recommend: 2.2, recommended: 2.2,
    best: 3.0, nice: 1.8, solid: 1.8, strong: 1.6, memorable: 2.4, fresh: 1.6, refreshing: 2.0,
    delightful: 2.8, wonderful: 3.0, incredible: 3.0, epic: 2.6, satisfying: 2.4, uplifting: 2.4,
    heartwarming: 2.8, flawless: 3.2, spectacular: 3.0, remarkable: 2.6, riveting: 2.8, compelling: 2.5,
    captivating: 2.8, genius: 3.0, worth: 1.5, well: 1.2, enjoyment: 2.4, like: 1.0, liked: 1.6,
    // negative words
    bad: -2.5, worst: -3.4, terrible: -3.2, awful: -3.2, horrible: -3.2, boring: -2.6, dull: -2.2,
    disappointing: -2.6, disappointed: -2.6, disappointment: -2.6, waste: -2.8, poor: -2.2, weak: -1.9,
    mess: -2.2, messy: -1.8, confusing: -1.8, slow: -1.4, predictable: -1.6, cliche: -1.6, cliched: -1.6,
    forgettable: -2.0, mediocre: -2.0, bland: -2.0, lame: -2.3, annoying: -2.4, cringe: -2.5,
    stupid: -2.6, ridiculous: -1.8, pointless: -2.5, unnecessary: -1.6, overrated: -2.2, flawed: -1.4,
    flop: -2.4, trash: -3.0, garbage: -3.0, hate: -3.0, hated: -3.0, dislike: -2.0, unwatchable: -3.2,
    painful: -2.4, tedious: -2.4, lackluster: -2.0, shallow: -1.8, lazy: -1.8, rushed: -1.4,
    underwhelming: -2.2, nonsense: -2.2, fail: -2.2, failed: -2.2, fails: -2.2, sloppy: -2.0,
    flat: -1.6, tiresome: -2.2, dreadful: -3.0, atrocious: -3.4, disaster: -3.0, laughable: -2.0
  };
  const NEGATORS = new Set(["not", "no", "never", "hardly", "barely", "without", "neither", "nor",
    "dont", "doesnt", "didnt", "isnt", "wasnt", "arent", "werent", "cant", "couldnt", "wouldnt",
    "wont", "shouldnt", "aint"]);
  const BOOSTERS = { very: 0.3, really: 0.3, extremely: 0.5, absolutely: 0.4, totally: 0.3,
    incredibly: 0.4, truly: 0.3, highly: 0.3, so: 0.2, super: 0.3, slightly: -0.3, somewhat: -0.25, bit: -0.2 };

  // Returns a number from -1 (very negative) to +1 (very positive)
  function sentiment(text) {
    const words = String(text || "")
      .toLowerCase()
      .replace(/[‘’']/g, "")      // don't -> dont
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    let sum = 0;
    words.forEach((w, i) => {
      let v = LEXICON[w];
      if (v === undefined) return;
      const before = words.slice(Math.max(0, i - 3), i);
      const prev = words[i - 1];
      if (prev && BOOSTERS[prev] !== undefined) v += Math.sign(v) * BOOSTERS[prev] * 2;
      if (before.some(b => NEGATORS.has(b))) v *= -0.74;    // "not good" turns negative
      sum += v;
    });
    return sum / Math.sqrt(sum * sum + 15);                  // squash into -1 .. +1
  }

  function sentimentLabel(c) {
    if (c >= 0.1) return "positive";
    if (c <= -0.1) return "negative";
    return "neutral";
  }

  // Analyse all reviews of one movie and compare with the reviewers' own star ratings
  function analyzeReviews(reviews) {
    const list = (reviews || []).filter(r => r && r.content && r.content.length > 20);
    const counts = { positive: 0, neutral: 0, negative: 0 };
    let checked = 0, matched = 0;
    list.forEach(r => {
      const c = sentiment(r.content);
      counts[sentimentLabel(c)] += 1;
      const stars = r.author_details && r.author_details.rating;
      if (typeof stars === "number" && (stars >= 7 || stars <= 4)) {
        checked += 1;
        if ((c > 0) === (stars >= 7)) matched += 1;
      }
    });
    const total = list.length;
    let verdict = "Mixed";
    if (total) {
      if (counts.positive / total >= 0.6) verdict = "Mostly positive";
      else if (counts.negative / total >= 0.5) verdict = "Mostly negative";
    }
    return { total, counts, verdict, checked, matched };
  }

  return {
    tokenize, movieTokens, buildModel, rank, percentile, topGenreIds, tasteSummary,
    sentiment, sentimentLabel, analyzeReviews
  };
})();

// lets us test this file in Node.js (it does nothing in the browser)
if (typeof module !== "undefined") module.exports = AI;
