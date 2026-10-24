/* ==========================================================
   MovieHub - demo.js   (OFFLINE DEMO MODE)
   If TMDB cannot be reached (no internet, blocked network),
   the app switches to this built-in list of sample movies.
   It copies the shape of TMDB answers, so every feature
   (search, genres, moods, details, watchlist and the AI)
   keeps working without any change.
   Ratings are approximate and the reviews are samples.
========================================================== */

const Demo = (() => {
  const BASE_ID = 9000000; // demo ids start here so they never clash with real TMDB ids

  const GN = {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime", 18: "Drama",
    10751: "Family", 14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music", 9648: "Mystery",
    10749: "Romance", 878: "Science Fiction", 53: "Thriller"
  };

  // t=title, d=release date, v=rating, g=genre ids, l=language, p=popularity, dir=director, c=cast, o=story
  const RAW = [
    { t: "Inception", d: "2010-07-16", v: 8.4, g: [28, 878, 12], l: "en", p: 98, dir: "Christopher Nolan", c: ["Leonardo DiCaprio", "Joseph Gordon-Levitt", "Elliot Page", "Tom Hardy"], o: "A thief who steals secrets by entering people's dreams is given a final job: instead of stealing an idea, he must plant one." },
    { t: "Interstellar", d: "2014-11-05", v: 8.4, g: [12, 18, 878], l: "en", p: 97, dir: "Christopher Nolan", c: ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain", "Michael Caine"], o: "With Earth dying, a team of astronauts travels through a wormhole in search of a new home for humanity." },
    { t: "The Dark Knight", d: "2008-07-16", v: 8.5, g: [18, 28, 80, 53], l: "en", p: 96, dir: "Christopher Nolan", c: ["Christian Bale", "Heath Ledger", "Aaron Eckhart", "Michael Caine"], o: "Batman faces the Joker, a chaos-loving criminal who pushes Gotham City and its heroes to their limits." },
    { t: "The Shawshank Redemption", d: "1994-09-23", v: 8.7, g: [18, 80], l: "en", p: 80, dir: "Frank Darabont", c: ["Tim Robbins", "Morgan Freeman", "Bob Gunton"], o: "A banker jailed for a crime he says he did not commit finds hope and friendship during decades in prison." },
    { t: "The Godfather", d: "1972-03-14", v: 8.7, g: [18, 80], l: "en", p: 79, dir: "Francis Ford Coppola", c: ["Marlon Brando", "Al Pacino", "James Caan", "Robert Duvall"], o: "The aging head of a crime family hands control of his empire to his reluctant youngest son." },
    { t: "Pulp Fiction", d: "1994-09-10", v: 8.5, g: [53, 80], l: "en", p: 78, dir: "Quentin Tarantino", c: ["John Travolta", "Samuel L. Jackson", "Uma Thurman", "Bruce Willis"], o: "Stories of hitmen, a boxer and a gangster's wife in Los Angeles cross in unexpected ways." },
    { t: "Forrest Gump", d: "1994-06-23", v: 8.5, g: [35, 18, 10749], l: "en", p: 77, dir: "Robert Zemeckis", c: ["Tom Hanks", "Robin Wright", "Gary Sinise"], o: "A kind man with a low IQ unknowingly takes part in major moments of history while chasing his childhood love." },
    { t: "Fight Club", d: "1999-10-15", v: 8.4, g: [18], l: "en", p: 76, dir: "David Fincher", c: ["Brad Pitt", "Edward Norton", "Helena Bonham Carter"], o: "An office worker with insomnia starts an underground fight club with a charismatic stranger, and it spirals out of control." },
    { t: "The Matrix", d: "1999-03-30", v: 8.2, g: [28, 878], l: "en", p: 90, dir: "Lana and Lilly Wachowski", c: ["Keanu Reeves", "Laurence Fishburne", "Carrie-Anne Moss"], o: "A hacker learns that his world is a simulation run by machines and joins a rebellion to free humanity." },
    { t: "Gladiator", d: "2000-05-04", v: 8.2, g: [28, 18, 12], l: "en", p: 74, dir: "Ridley Scott", c: ["Russell Crowe", "Joaquin Phoenix", "Connie Nielsen"], o: "A betrayed Roman general becomes a gladiator and seeks revenge on the emperor who destroyed his family." },
    { t: "Parasite", d: "2019-05-30", v: 8.5, g: [35, 53, 18], l: "ko", p: 88, dir: "Bong Joon-ho", c: ["Song Kang-ho", "Lee Sun-kyun", "Cho Yeo-jeong", "Choi Woo-shik"], o: "A poor family schemes to work for a wealthy household, until a hidden secret threatens everyone." },
    { t: "Joker", d: "2019-10-02", v: 8.1, g: [80, 53, 18], l: "en", p: 86, dir: "Todd Phillips", c: ["Joaquin Phoenix", "Robert De Niro", "Zazie Beetz"], o: "A lonely, struggling comedian in Gotham slowly turns into a violent criminal figure." },
    { t: "Avengers: Endgame", d: "2019-04-24", v: 8.3, g: [12, 878, 28], l: "en", p: 95, dir: "Anthony and Joe Russo", c: ["Robert Downey Jr.", "Chris Evans", "Mark Ruffalo", "Scarlett Johansson"], o: "The remaining heroes assemble to undo the damage done by a cosmic villain and restore the universe." },
    { t: "Avatar", d: "2009-12-15", v: 7.6, g: [28, 12, 14, 878], l: "en", p: 85, dir: "James Cameron", c: ["Sam Worthington", "Zoe Saldana", "Sigourney Weaver"], o: "A former marine sent to the planet Pandora is torn between following orders and protecting the native Na'vi." },
    { t: "Titanic", d: "1997-11-18", v: 7.9, g: [18, 10749], l: "en", p: 84, dir: "James Cameron", c: ["Leonardo DiCaprio", "Kate Winslet", "Billy Zane"], o: "A young artist and a first-class passenger fall in love aboard the doomed ocean liner." },
    { t: "Spirited Away", d: "2001-07-20", v: 8.5, g: [16, 10751, 14], l: "ja", p: 72, dir: "Hayao Miyazaki", c: ["Rumi Hiiragi", "Miyu Irino"], o: "A girl trapped in a world of spirits must work in a bathhouse to free her parents and herself." },
    { t: "3 Idiots", d: "2009-12-24", v: 8.0, g: [35, 18], l: "hi", p: 83, dir: "Rajkumar Hirani", c: ["Aamir Khan", "R. Madhavan", "Sharman Joshi", "Kareena Kapoor"], o: "Three engineering students become close friends, and one of them changes how the others think about learning and success." },
    { t: "Dangal", d: "2016-12-21", v: 8.0, g: [28, 18], l: "hi", p: 82, dir: "Nitesh Tiwari", c: ["Aamir Khan", "Fatima Sana Shaikh", "Sanya Malhotra"], o: "A former wrestler trains his two daughters to become champions in a society that does not expect it of them." },
    { t: "Taare Zameen Par", d: "2007-12-21", v: 8.0, g: [18, 10751], l: "hi", p: 70, dir: "Aamir Khan", c: ["Darsheel Safary", "Aamir Khan", "Tisca Chopra"], o: "A dyslexic eight-year-old struggles at school until a caring art teacher finds the reason and helps him shine." },
    { t: "Lagaan", d: "2001-06-15", v: 7.9, g: [18, 10402], l: "hi", p: 68, dir: "Ashutosh Gowariker", c: ["Aamir Khan", "Gracy Singh", "Rachel Shelley"], o: "Villagers in colonial India accept a cricket match against British officers to escape a crushing tax." },
    { t: "Drishyam", d: "2015-07-31", v: 8.0, g: [53, 80, 18], l: "hi", p: 75, dir: "Nishikant Kamat", c: ["Ajay Devgn", "Tabu", "Shriya Saran"], o: "A father uses his wits to protect his family after an accident that could destroy their lives." },
    { t: "Zindagi Na Milegi Dobara", d: "2011-07-15", v: 8.0, g: [35, 18, 12], l: "hi", p: 73, dir: "Zoya Akhtar", c: ["Hrithik Roshan", "Farhan Akhtar", "Abhay Deol", "Katrina Kaif"], o: "Three friends take a road trip across Spain before one of them gets married, and rediscover what matters in life." },
    { t: "Queen", d: "2014-03-07", v: 7.9, g: [35, 18], l: "hi", p: 66, dir: "Vikas Bahl", c: ["Kangana Ranaut", "Lisa Haydon", "Rajkummar Rao"], o: "A young woman goes on her honeymoon trip alone after her wedding is called off, and finds herself along the way." },
    { t: "Andhadhun", d: "2018-10-05", v: 8.0, g: [53, 35, 80], l: "hi", p: 71, dir: "Sriram Raghavan", c: ["Ayushmann Khurrana", "Tabu", "Radhika Apte"], o: "A pianist pretending to be blind gets pulled into a murder and a web of lies." },
    { t: "Oppenheimer", d: "2023-07-19", v: 8.1, g: [18, 36], l: "en", p: 94, dir: "Christopher Nolan", c: ["Cillian Murphy", "Emily Blunt", "Matt Damon", "Robert Downey Jr."], o: "The story of the scientist who led the creation of the atomic bomb and the cost that followed." },
    { t: "Dune", d: "2021-09-15", v: 7.8, g: [878, 12], l: "en", p: 92, dir: "Denis Villeneuve", c: ["Timothee Chalamet", "Zendaya", "Rebecca Ferguson", "Oscar Isaac"], o: "A young nobleman's family takes control of a desert planet that holds the most valuable resource in the universe." },
    { t: "Whiplash", d: "2014-10-10", v: 8.4, g: [18, 10402], l: "en", p: 69, dir: "Damien Chazelle", c: ["Miles Teller", "J.K. Simmons", "Paul Reiser"], o: "A young jazz drummer pushes himself to the limit under a ruthless and demanding teacher." },
    { t: "Coco", d: "2017-10-27", v: 8.2, g: [16, 10751, 14, 10402], l: "en", p: 81, dir: "Lee Unkrich", c: ["Anthony Gonzalez", "Gael Garcia Bernal", "Benjamin Bratt"], o: "A boy who dreams of becoming a musician travels to the Land of the Dead to uncover his family's past." },
    { t: "Toy Story", d: "1995-10-30", v: 8.0, g: [16, 10751, 35], l: "en", p: 67, dir: "John Lasseter", c: ["Tom Hanks", "Tim Allen"], o: "A cowboy doll feels threatened when a shiny space ranger toy becomes his owner's new favourite." },
    { t: "The Lion King", d: "1994-06-24", v: 8.3, g: [16, 10751, 18], l: "en", p: 87, dir: "Roger Allers and Rob Minkoff", c: ["Matthew Broderick", "Jeremy Irons", "James Earl Jones"], o: "A young lion prince flees after his father's death and must return to take his place as king." },
    { t: "Jurassic Park", d: "1993-06-11", v: 8.0, g: [12, 878], l: "en", p: 89, dir: "Steven Spielberg", c: ["Sam Neill", "Laura Dern", "Jeff Goldblum"], o: "A theme park of cloned dinosaurs turns deadly when its security systems fail." },
    { t: "Mad Max: Fury Road", d: "2015-05-13", v: 7.6, g: [28, 12, 878], l: "en", p: 65, dir: "George Miller", c: ["Tom Hardy", "Charlize Theron", "Nicholas Hoult"], o: "In a desert wasteland, a drifter and a rebel driver flee a tyrant in a violent, nonstop chase." },
    { t: "John Wick", d: "2014-10-22", v: 7.4, g: [28, 53], l: "en", p: 64, dir: "Chad Stahelski", c: ["Keanu Reeves", "Michael Nyqvist", "Alfie Allen"], o: "A retired hitman comes back to take revenge on the men who wronged him." },
    { t: "Top Gun: Maverick", d: "2022-05-24", v: 8.2, g: [28, 18], l: "en", p: 91, dir: "Joseph Kosinski", c: ["Tom Cruise", "Miles Teller", "Jennifer Connelly"], o: "A veteran Navy pilot trains a new generation of elite flyers for a dangerous mission." },
    { t: "Barbie", d: "2023-07-19", v: 7.1, g: [35, 12, 14], l: "en", p: 93, dir: "Greta Gerwig", c: ["Margot Robbie", "Ryan Gosling", "America Ferrera"], o: "Barbie leaves her perfect world to explore the real one, and discovers who she wants to be." },
    { t: "Spider-Man: Into the Spider-Verse", d: "2018-12-06", v: 8.4, g: [16, 28, 12, 878, 10751], l: "en", p: 63, dir: "Bob Persichetti, Peter Ramsey and Rodney Rothman", c: ["Shameik Moore", "Jake Johnson", "Hailee Steinfeld"], o: "Teenager Miles Morales becomes Spider-Man and meets other Spider-heroes from different dimensions." },
    { t: "La La Land", d: "2016-12-01", v: 7.9, g: [35, 18, 10402, 10749], l: "en", p: 62, dir: "Damien Chazelle", c: ["Ryan Gosling", "Emma Stone"], o: "A jazz pianist and an aspiring actress fall in love while chasing their dreams in Los Angeles." },
    { t: "Get Out", d: "2017-02-24", v: 7.6, g: [27, 9648, 53], l: "en", p: 61, dir: "Jordan Peele", c: ["Daniel Kaluuya", "Allison Williams", "Catherine Keener"], o: "A young photographer visits his girlfriend's family and slowly discovers a disturbing secret." },
    { t: "Knives Out", d: "2019-11-27", v: 7.8, g: [35, 80, 9648], l: "en", p: 60, dir: "Rian Johnson", c: ["Daniel Craig", "Chris Evans", "Ana de Armas"], o: "A detective investigates the death of a famous crime novelist surrounded by his scheming family." },
    { t: "Se7en", d: "1995-09-22", v: 8.4, g: [80, 9648, 53], l: "en", p: 59, dir: "David Fincher", c: ["Brad Pitt", "Morgan Freeman", "Gwyneth Paltrow"], o: "Two detectives hunt a serial killer who uses the seven deadly sins as his guide." },
    { t: "Shutter Island", d: "2010-02-18", v: 8.2, g: [18, 9648, 53], l: "en", p: 58, dir: "Martin Scorsese", c: ["Leonardo DiCaprio", "Mark Ruffalo", "Ben Kingsley"], o: "A US marshal investigates a patient's disappearance from a hospital for the criminally insane." },
    { t: "The Prestige", d: "2006-10-17", v: 8.2, g: [18, 9648, 878], l: "en", p: 57, dir: "Christopher Nolan", c: ["Christian Bale", "Hugh Jackman", "Michael Caine", "Scarlett Johansson"], o: "Two rival magicians in Victorian London take their competition to dangerous extremes." },
    { t: "Back to the Future", d: "1985-07-03", v: 8.3, g: [12, 35, 878], l: "en", p: 56, dir: "Robert Zemeckis", c: ["Michael J. Fox", "Christopher Lloyd", "Lea Thompson"], o: "A teenager is sent back to 1955 in a time machine and must make sure his parents fall in love." },
    { t: "The Conjuring", d: "2013-07-18", v: 7.5, g: [27, 53], l: "en", p: 55, dir: "James Wan", c: ["Vera Farmiga", "Patrick Wilson", "Lili Taylor"], o: "Paranormal investigators help a family terrorised by a dark presence in their farmhouse." }
  ];

  const MOVIES = RAW.map((m, i) => ({
    id: BASE_ID + i + 1,
    title: m.t, date: m.d, vote: m.v, genres: m.g, lang: m.l, pop: m.p,
    director: m.dir, cast: m.c, overview: m.o,
    votes: 3000 + (i * 997) % 20000
  }));
  const byId = new Map(MOVIES.map(m => [m.id, m]));

  /* ---------- Posters: a coloured SVG drawn from the title (no internet needed) ---------- */
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function wrap(title, max) {
    const words = title.split(" ");
    const lines = [];
    let line = "";
    words.forEach(w => {
      if ((line + " " + w).trim().length > max) { lines.push(line); line = w; }
      else line = (line + " " + w).trim();
    });
    if (line) lines.push(line);
    return lines.slice(0, 4);
  }
  function poster(id) {
    const m = byId.get(id);
    if (!m) return "";
    const hue = (id * 47) % 360;
    const lines = wrap(m.title, 14);
    const startY = 215 - (lines.length - 1) * 18;
    const text = lines.map((l, i) =>
      `<text x="150" y="${startY + i * 36}" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="28" fill="#fff">${esc(l)}</text>`
    ).join("");
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="hsl(${hue},55%,34%)"/><stop offset="1" stop-color="hsl(${(hue + 50) % 360},60%,14%)"/></linearGradient></defs>` +
      `<rect width="100%" height="100%" fill="url(#g)"/>${text}` +
      `<text x="150" y="368" text-anchor="middle" font-family="Arial" font-size="22" fill="#ffffffaa">${m.date.slice(0, 4)}</text></svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  /* ---------- Sample reviews (written for the demo, clearly not real) ---------- */
  const REVIEWS = {
    pos: [
      "Absolutely brilliant. The acting is superb and the story kept me gripped from start to finish. Highly recommended.",
      "A masterpiece. Beautiful visuals, a powerful story and a memorable ending. I loved every minute of it.",
      "Fantastic and engaging. One of the best films I have seen, and it is worth watching more than once."
    ],
    mixed: [
      "Good but a bit slow in the middle. The acting is strong, though the ending felt rushed.",
      "Some great moments and some boring ones. Worth a watch but not perfect."
    ],
    neg: [
      "Not good. The story is predictable and I found it boring and a waste of time."
    ]
  };
  function reviewsFor(m) {
    let picks;
    if (m.vote >= 8) picks = [[REVIEWS.pos[0], 9], [REVIEWS.pos[1], 10], [REVIEWS.pos[2], 8]];
    else if (m.vote >= 7.5) picks = [[REVIEWS.pos[1], 9], [REVIEWS.pos[2], 8], [REVIEWS.mixed[0], 6]];
    else picks = [[REVIEWS.pos[2], 8], [REVIEWS.mixed[1], 6], [REVIEWS.neg[0], 3]];
    return picks.map(([content, rating]) => ({ content, author_details: { rating } }));
  }

  /* ---------- Shapes that look like TMDB answers ---------- */
  function card(m) {
    return {
      id: m.id, title: m.title, poster_path: "demo:" + m.id, release_date: m.date,
      vote_average: m.vote, vote_count: m.votes, popularity: m.pop,
      genre_ids: m.genres, overview: m.overview, original_language: m.lang
    };
  }

  function pageOf(list, page) {
    const per = 20;
    const p = Math.max(1, Number(page) || 1);
    return {
      page: p,
      results: list.slice((p - 1) * per, p * per).map(card),
      total_pages: Math.max(1, Math.ceil(list.length / per)),
      total_results: list.length
    };
  }

  function similarTo(m) {
    const shared = other => other.genres.filter(g => m.genres.includes(g)).length;
    return MOVIES.filter(o => o.id !== m.id && shared(o) > 0)
      .sort((a, b) => shared(b) - shared(a) || b.vote - a.vote);
  }

  function detail(m) {
    return {
      ...card(m),
      genres: m.genres.map(id => ({ id, name: GN[id] })),
      tagline: "",
      credits: { cast: m.cast.map(name => ({ name })), crew: [{ job: "Director", name: m.director }] },
      videos: { results: [] },
      "watch/providers": { results: {} },
      recommendations: { results: similarTo(m).slice(0, 8).map(card) },
      reviews: { results: reviewsFor(m) }
    };
  }

  function genreMatch(m, spec) {
    if (!spec) return true;
    const text = String(spec);
    if (text.includes("|")) return text.split("|").some(g => m.genres.includes(Number(g)));
    if (text.includes(",")) return text.split(",").every(g => m.genres.includes(Number(g)));
    return m.genres.includes(Number(text));
  }

  function notFound() {
    const err = new Error("HTTP 404");
    err.status = 404;
    return err;
  }

  /* ---------- The fake TMDB server ---------- */
  function route(path, params = {}) {
    let m;
    if (path === "/genre/movie/list") {
      return Promise.resolve({ genres: Object.entries(GN).map(([id, name]) => ({ id: Number(id), name })) });
    }
    if (path === "/trending/movie/week") {
      return Promise.resolve(pageOf(MOVIES.slice().sort((a, b) => b.pop - a.pop), params.page));
    }
    if (path === "/movie/top_rated") {
      return Promise.resolve(pageOf(MOVIES.slice().sort((a, b) => b.vote - a.vote), params.page));
    }
    if (path === "/movie/now_playing") {
      return Promise.resolve(pageOf(MOVIES.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12), params.page));
    }
    if (path === "/movie/upcoming") {
      return Promise.resolve(pageOf([], params.page)); // no future movies in the demo
    }
    if (path === "/search/movie") {
      const q = String(params.query || "").toLowerCase();
      return Promise.resolve(pageOf(MOVIES.filter(x => x.title.toLowerCase().includes(q)), params.page));
    }
    if (path === "/discover/movie") {
      let list = MOVIES.filter(x => genreMatch(x, params.with_genres));
      if (params["vote_count.gte"]) list = list.filter(x => x.votes >= Number(params["vote_count.gte"]));
      if (params["vote_average.gte"]) list = list.filter(x => x.vote >= Number(params["vote_average.gte"]));
      list.sort((a, b) => b.pop - a.pop);
      return Promise.resolve(pageOf(list, params.page));
    }
    if ((m = path.match(/^\/movie\/(\d+)\/recommendations$/))) {
      const movie = byId.get(Number(m[1]));
      return movie ? Promise.resolve(pageOf(similarTo(movie), params.page)) : Promise.reject(notFound());
    }
    if ((m = path.match(/^\/movie\/(\d+)$/))) {
      const movie = byId.get(Number(m[1]));
      return movie ? Promise.resolve(detail(movie)) : Promise.reject(notFound());
    }
    return Promise.reject(notFound());
  }

  // true for addresses that only exist in the demo data
  function owns(path) {
    const m = path.match(/^\/movie\/(\d+)/);
    return !!m && Number(m[1]) > BASE_ID;
  }

  return { route, owns, poster, count: MOVIES.length };
})();
