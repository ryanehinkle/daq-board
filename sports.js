(() => {
  "use strict";

  const STORAGE_KEY = "daq-board-sports-v1";
  const zone = document.getElementById("sports-zone");
  const ticker = document.getElementById("sports-headline-ticker");
  const tickerTrack = document.getElementById("sports-headline-track");
  const settingsRoot = document.getElementById("sports-settings-root");
  if (!zone || !settingsRoot) return;

  const NFL_WEEK_STORAGE_KEY = "daq-board-nfl-active-week-v1";

  const LEAGUES = {
    nfl: {
      label: "NFL",
      sport: "football",
      league: "nfl",
      aliases: { JAC: "JAX", WAS: "WSH" }
    },
    mlb: {
      label: "MLB",
      sport: "baseball",
      league: "mlb",
      aliases: { OAK: "ATH", CHW: "CWS", KC: "KCR", SD: "SDP", SF: "SFG", TB: "TBR", WAS: "WSH", WSN: "WSH", FLA: "MIA", ANA: "LAA" }
    },
    nhl: {
      label: "NHL",
      sport: "hockey",
      league: "nhl",
      aliases: { LA: "LAK", TB: "TBL", SJ: "SJS", MON: "MTL", WAS: "WSH", VGS: "VGK", UTAH: "UTA" }
    }
  };

  const TEAM_LISTS = {
    nfl: [
      ["ARI","Arizona Cardinals"],["ATL","Atlanta Falcons"],["BAL","Baltimore Ravens"],["BUF","Buffalo Bills"],
      ["CAR","Carolina Panthers"],["CHI","Chicago Bears"],["CIN","Cincinnati Bengals"],["CLE","Cleveland Browns"],
      ["DAL","Dallas Cowboys"],["DEN","Denver Broncos"],["DET","Detroit Lions"],["GB","Green Bay Packers"],
      ["HOU","Houston Texans"],["IND","Indianapolis Colts"],["JAX","Jacksonville Jaguars"],["KC","Kansas City Chiefs"],
      ["LV","Las Vegas Raiders"],["LAC","Los Angeles Chargers"],["LAR","Los Angeles Rams"],["MIA","Miami Dolphins"],
      ["MIN","Minnesota Vikings"],["NE","New England Patriots"],["NO","New Orleans Saints"],["NYG","New York Giants"],
      ["NYJ","New York Jets"],["PHI","Philadelphia Eagles"],["PIT","Pittsburgh Steelers"],["SEA","Seattle Seahawks"],
      ["SF","San Francisco 49ers"],["TB","Tampa Bay Buccaneers"],["TEN","Tennessee Titans"],["WSH","Washington Commanders"]
    ],
    mlb: [
      ["ARI","Arizona Diamondbacks"],["ATH","Athletics"],["ATL","Atlanta Braves"],["BAL","Baltimore Orioles"],
      ["BOS","Boston Red Sox"],["CHC","Chicago Cubs"],["CWS","Chicago White Sox"],["CIN","Cincinnati Reds"],
      ["CLE","Cleveland Guardians"],["COL","Colorado Rockies"],["DET","Detroit Tigers"],["HOU","Houston Astros"],
      ["KCR","Kansas City Royals"],["LAA","Los Angeles Angels"],["LAD","Los Angeles Dodgers"],["MIA","Miami Marlins"],
      ["MIL","Milwaukee Brewers"],["MIN","Minnesota Twins"],["NYM","New York Mets"],["NYY","New York Yankees"],
      ["PHI","Philadelphia Phillies"],["PIT","Pittsburgh Pirates"],["SDP","San Diego Padres"],["SFG","San Francisco Giants"],
      ["SEA","Seattle Mariners"],["STL","St. Louis Cardinals"],["TBR","Tampa Bay Rays"],["TEX","Texas Rangers"],
      ["TOR","Toronto Blue Jays"],["WSH","Washington Nationals"]
    ],
    nhl: [
      ["ANA","Anaheim Ducks"],["BOS","Boston Bruins"],["BUF","Buffalo Sabres"],["CAR","Carolina Hurricanes"],
      ["CBJ","Columbus Blue Jackets"],["CGY","Calgary Flames"],["CHI","Chicago Blackhawks"],["COL","Colorado Avalanche"],
      ["DAL","Dallas Stars"],["DET","Detroit Red Wings"],["EDM","Edmonton Oilers"],["FLA","Florida Panthers"],
      ["LAK","Los Angeles Kings"],["MIN","Minnesota Wild"],["MTL","Montreal Canadiens"],["NJD","New Jersey Devils"],
      ["NSH","Nashville Predators"],["NYI","New York Islanders"],["NYR","New York Rangers"],["OTT","Ottawa Senators"],
      ["PHI","Philadelphia Flyers"],["PIT","Pittsburgh Penguins"],["SEA","Seattle Kraken"],["SJS","San Jose Sharks"],
      ["STL","St. Louis Blues"],["TBL","Tampa Bay Lightning"],["TOR","Toronto Maple Leafs"],["UTA","Utah Mammoth"],
      ["VAN","Vancouver Canucks"],["VGK","Vegas Golden Knights"],["WPG","Winnipeg Jets"],["WSH","Washington Capitals"]
    ]
  };

  const DEFAULTS = {
    enabled: true,
    expanded: false,
    appearance: "monotone",
    showBoxes: true,
    headlineMode: "scroll",
    leagues: {
      nfl: { enabled: true, mode: "cycle", cycleSeconds: 15, watchTeams: [] },
      mlb: { enabled: true, mode: "cycle", cycleSeconds: 15, watchTeams: [] },
      nhl: { enabled: true, mode: "cycle", cycleSeconds: 15, watchTeams: [] }
    }
  };

  const runtime = Object.fromEntries(Object.keys(LEAGUES).map(key => [key, {
    games: [],
    currentGameId: "",
    nextCycleAt: 0,
    fetchTimer: null,
    fetching: false,
    error: "",
    updatedAt: 0
  }]));

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }

  function normalizeCode(league, code) {
    const raw = String(code || "").trim().toUpperCase();
    return LEAGUES[league]?.aliases?.[raw] || raw;
  }

  function loadSettings() {
    const base = cloneDefaults();
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!raw || typeof raw !== "object") return base;
      base.enabled = raw.enabled !== false;
      base.expanded = false;
      base.appearance = raw.appearance === "color" ? "color" : "monotone";
      base.showBoxes = raw.showBoxes !== false;
      base.headlineMode = raw.headlineMode === "static" ? "static" : "scroll";
      for (const key of Object.keys(LEAGUES)) {
        const saved = raw.leagues?.[key] || {};
        const target = base.leagues[key];
        target.enabled = saved.enabled !== false;
        target.mode = saved.mode === "watch" ? "watch" : "cycle";
        const seconds = Number(saved.cycleSeconds);
        target.cycleSeconds = [5,10,15,30,45,60].includes(seconds) ? seconds : 15;
        target.watchTeams = Array.isArray(saved.watchTeams)
          ? Array.from(new Set(saved.watchTeams.map(code => normalizeCode(key, code)).filter(Boolean)))
          : [];
      }
      return base;
    } catch {
      return base;
    }
  }

  let config = loadSettings();

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, "&#39;");
  }

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function truthy(value) {
    if (typeof value === "string") {
      const v = value.trim().toLowerCase();
      if (!v || v === "false" || v === "0" || v === "no") return false;
    }
    return !!value;
  }

  function addDays(date, amount) {
    const copy = new Date(date.getTime());
    copy.setDate(copy.getDate() + amount);
    return copy;
  }

  function dateKey(date) {
    return String(date.getFullYear()) +
      String(date.getMonth() + 1).padStart(2, "0") +
      String(date.getDate()).padStart(2, "0");
  }

  function baseballDate() {
    const d = new Date();
    if (d.getHours() < 3) d.setDate(d.getDate() - 1);
    return d;
  }

  function scoreboardUrlsForDate(league, date) {
    const q = "?dates=" + dateKey(date) + "&limit=100";
    if (league === "mlb") {
      return [
        "https://site.web.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard" + q,
        "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard" + q
      ];
    }
    return [
      "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard" + q
    ];
  }

  async function fetchJsonFallback(urls) {
    let lastError = null;
    for (const url of urls) {
      try {
        const response = await fetch(url, { cache: "no-store", credentials: "omit" });
        if (!response.ok) throw new Error("HTTP " + response.status);
        return await response.json();
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("Score feed unavailable");
  }

  function eventsFromPayload(payload) {
    return Array.isArray(payload?.events) ? payload.events.filter(event => event?.id) : [];
  }

  function nflWeekMeta(payload) {
    const season = payload?.season || {};
    const week = payload?.week || {};
    const first = eventsFromPayload(payload)[0] || {};
    const eventSeason = first.season || {};
    const eventWeek = first.week || {};
    return {
      year: safeNumber(season.year, safeNumber(eventSeason.year, new Date().getFullYear())),
      seasonType: safeNumber(season.type, safeNumber(eventSeason.type, 2)),
      week: safeNumber(week.number, safeNumber(eventWeek.number, 1))
    };
  }

  function loadStoredNFLWeek() {
    try {
      const value = JSON.parse(localStorage.getItem(NFL_WEEK_STORAGE_KEY) || "null");
      if (!value || !value.year || !value.week) return null;
      return value;
    } catch {
      return null;
    }
  }

  function storeNFLWeek(info) {
    try {
      localStorage.setItem(NFL_WEEK_STORAGE_KEY, JSON.stringify(info));
    } catch {}
  }

  async function fetchNFLWeek(info) {
    const query = new URLSearchParams({
      dates: String(info.year),
      seasontype: String(info.seasonType || 2),
      week: String(info.week),
      limit: "100"
    });
    return fetchJsonFallback([
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?" + query.toString()
    ]);
  }

  async function fetchNFLEvents() {
    const now = new Date();
    const isTuesday = now.getDay() === 2;
    const stored = loadStoredNFLWeek();

    // Tuesday is the explicit week rollover. On every other day, keep using
    // the stored active week so Monday finals remain visible all day.
    if (stored && !isTuesday) {
      const payload = await fetchNFLWeek(stored).catch(() => null);
      if (payload && eventsFromPayload(payload).length) return eventsFromPayload(payload);
    }

    const current = await fetchJsonFallback([
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=100"
    ]);
    const info = nflWeekMeta(current);
    storeNFLWeek(info);

    const full = await fetchNFLWeek(info).catch(() => current);
    return eventsFromPayload(full);
  }

  async function fetchLeagueEvents(league) {
    if (league === "nfl") return fetchNFLEvents();

    const anchor = league === "mlb" ? baseballDate() : new Date();
    const groups = [
      { day: addDays(anchor, -1), kind: "yesterday" }
    ];

    // Keep yesterday plus today/the coming schedule in memory. displayGames()
    // chooses yesterday + exactly one current/future slate after Watch filtering.
    for (let offset = 0; offset <= 14; offset++) {
      groups.push({ day: addDays(anchor, offset), kind: offset === 0 ? "today" : "future" });
    }

    const payloads = await Promise.all(groups.map(async group => ({
      ...group,
      payload: await fetchJsonFallback(
        scoreboardUrlsForDate(league, group.day)
      ).catch(() => null)
    })));

    const byId = new Map();
    let hadSuccessfulRequest = false;

    for (const row of payloads) {
      if (!row.payload) continue;
      hadSuccessfulRequest = true;
      for (const event of eventsFromPayload(row.payload)) {
        byId.set(String(event.id), event);
      }
    }

    if (!hadSuccessfulRequest) throw new Error("Live score feed unavailable");
    return Array.from(byId.values());
  }

  function pickCompetition(event) {
    return (event?.competitions || []).find(row => row && typeof row === "object") || {};
  }

  function pickCompetitor(comp, side) {
    return (comp?.competitors || []).find(row => row?.homeAway === side) || {};
  }

  function teamLogo(team) {
    if (team?.logo) return team.logo;
    const logos = team?.logos || [];
    const first = logos.find(item => item?.href) || {};
    return first.href || "";
  }

  function teamRecord(competitor) {
    const record = (competitor?.records || []).find(item => item?.summary) || {};
    return record.summary || "";
  }

  function teamStat(competitor, names) {
    const wanted = new Set(names.map(name => name.toLowerCase()));
    const stats = Array.isArray(competitor?.statistics)
      ? competitor.statistics
      : [];
    for (const stat of stats) {
      const name = String(stat?.name || stat?.abbreviation || stat?.label || "").toLowerCase();
      if (!wanted.has(name)) continue;
      const value = stat?.displayValue ?? stat?.value;
      if (value !== undefined && value !== null) return String(value);
    }
    return "";
  }

  function cleanHexColor(value, fallback = "8e95a3") {
    const raw = String(value || "").replace("#", "").trim();
    return /^[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : fallback;
  }

  function hexRgb(value) {
    const hex = cleanHexColor(value);
    return [
      parseInt(hex.slice(0,2), 16),
      parseInt(hex.slice(2,4), 16),
      parseInt(hex.slice(4,6), 16)
    ].join(",");
  }

  function normalizeCompetitor(league, competitor) {
    const team = competitor?.team || {};
    const color = cleanHexColor(team.color || team.primaryColor || "8e95a3");
    const alternateColor = cleanHexColor(team.alternateColor || team.secondaryColor || "d9dce3");
    return {
      id: String(team.id || competitor?.id || ""),
      code: normalizeCode(league, team.abbreviation || team.shortDisplayName || ""),
      name: team.shortDisplayName || team.displayName || team.name || "",
      logo: teamLogo(team),
      color,
      alternateColor,
      colorRgb: hexRgb(color),
      alternateRgb: hexRgb(alternateColor),
      score: safeNumber(competitor?.score, 0),
      winner: !!competitor?.winner,
      record: teamRecord(competitor),
      raw: competitor
    };
  }

  function normalizeState(status) {
    const type = status?.type || {};
    const raw = String(type.state || "").toLowerCase();
    if (raw === "in" || raw === "live") return "in";
    if (raw === "post" || raw === "final" || type.completed) return "post";
    return "pre";
  }

  function normalizeEvent(league, event) {
    const comp = pickCompetition(event);
    const status = comp.status || event.status || {};
    const awayRaw = pickCompetitor(comp, "away");
    const homeRaw = pickCompetitor(comp, "home");
    const situation = comp.situation || event.situation || {};
    return {
      id: String(event.id || comp.id || ""),
      league,
      date: event.date || comp.date || "",
      name: event.shortName || event.name || "",
      state: normalizeState(status),
      statusDetail: status?.type?.shortDetail || status?.type?.detail || status?.type?.description || "",
      statusName: status?.type?.name || "",
      period: safeNumber(status?.period, safeNumber(comp?.status?.period, 0)),
      clock: String(status?.displayClock || comp?.status?.displayClock || ""),
      away: normalizeCompetitor(league, awayRaw),
      home: normalizeCompetitor(league, homeRaw),
      situation,
      raw: event,
      competition: comp
    };
  }

  function gameStartMs(game) {
    const value = new Date(game.date).getTime();
    return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
  }

  function sortGames(games) {
    const stateRank = { in: 0, pre: 1, post: 2 };
    return [...games].sort((a, b) => {
      const rank = (stateRank[a.state] ?? 3) - (stateRank[b.state] ?? 3);
      if (rank) return rank;
      if (a.state === "post" && b.state === "post") return gameStartMs(b) - gameStartMs(a);
      return gameStartMs(a) - gameStartMs(b);
    });
  }

  function localDayKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return dateKey(date);
  }

  function yesterdayAndCurrentSlate(league, games) {
    if (league === "nfl" || !games.length) return games;

    const anchor = league === "mlb" ? baseballDate() : new Date();
    const todayKey = dateKey(anchor);
    const yesterdayKey = dateKey(addDays(anchor, -1));

    const yesterday = games.filter(game => localDayKey(game.date) === yesterdayKey);
    const today = games.filter(game => localDayKey(game.date) === todayKey);

    let current = today;
    if (!current.length) {
      const futureKeys = Array.from(new Set(
        games
          .map(game => localDayKey(game.date))
          .filter(key => key && key > todayKey)
      )).sort();
      const nextKey = futureKeys[0] || "";
      current = nextKey
        ? games.filter(game => localDayKey(game.date) === nextKey)
        : [];
    }

    const ids = new Set();
    return [...yesterday, ...current].filter(game => {
      if (ids.has(game.id)) return false;
      ids.add(game.id);
      return true;
    });
  }

  function displayGames(league) {
    const setting = config.leagues[league];
    let games = runtime[league].games;
    if (setting.mode === "watch") {
      const selected = new Set(setting.watchTeams.map(code => normalizeCode(league, code)));
      if (!selected.size) return [];
      games = games.filter(game => selected.has(game.away.code) || selected.has(game.home.code));
    }
    games = yesterdayAndCurrentSlate(league, games);
    return sortGames(games);
  }

  function stateText(game) {
    if (game.state === "in") return "LIVE";
    if (game.state === "post") return "FINAL";
    return "UPCOMING";
  }

  function sameLocalDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  function formatStart(game) {
    const date = new Date(game.date);
    if (!Number.isFinite(date.getTime())) return "TBD";
    const now = new Date();
    const tomorrow = addDays(now, 1);
    const time = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
    if (sameLocalDay(date, now)) return "Today • " + time;
    if (sameLocalDay(date, tomorrow)) return "Tomorrow • " + time;
    const day = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date);
    return day + " • " + time;
  }

  function ordinal(value) {
    const n = Math.max(1, Math.round(Number(value) || 1));
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return n + "th";
    return n + ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
  }

  function resolveTeamRef(game, raw) {
    let value = raw;
    if (value && typeof value === "object") {
      value = value.id || value.team?.id || value.abbreviation || value.team?.abbreviation || "";
    }
    const text = String(value || "").trim();
    if (!text) return "";
    if (text === game.away.id) return game.away.code;
    if (text === game.home.id) return game.home.code;
    const normalized = normalizeCode(game.league, text);
    if (normalized === game.away.code) return game.away.code;
    if (normalized === game.home.code) return game.home.code;
    return "";
  }

  function timeoutHtml(value) {
    if (!Number.isFinite(Number(value))) return "";
    const count = Math.max(0, Math.min(3, Number(value)));
    return '<span class="sports-timeouts" aria-label="' + count + ' timeouts">' +
      [0,1,2].map(i => '<span class="sports-timeout' + (i < count ? ' on' : '') + '"></span>').join("") +
      '</span>';
  }

  function nflPossession(game) {
    const situation = game.situation || {};
    return resolveTeamRef(game, situation.possession || situation.possessionTeam || situation.team);
  }

  function teamRowHtml(game, side) {
    const team = game[side];
    const situation = game.situation || {};
    const isNFL = game.league === "nfl";
    const possession = isNFL ? nflPossession(game) : "";
    const timeoutValue = side === "away"
      ? Number(situation.awayTimeouts)
      : Number(situation.homeTimeouts);
    const possessionHtml = possession === team.code
      ? '<span class="sports-possession" title="Possession" aria-label="Possession"></span>'
      : "";
    const timeoutMarks = isNFL && game.state === "in" ? timeoutHtml(timeoutValue) : "";
    const scoreHtml = game.state === "pre"
      ? '<div class="sports-score future">—</div>'
      : '<div class="sports-score">' + escapeHtml(team.score) + '</div>';
    const winnerArrow = game.state === "post" && team.winner
      ? '<span class="sports-winner-arrow" title="Winner" aria-label="Winner"></span>'
      : "";
    const hasWinner = game.state === "post" && (game.away.winner || game.home.winner);
    const resultClass = team.winner ? " winner" : (hasWinner ? " loser" : "");
    const rowStyle = '--team-color:#' + escapeAttr(team.color) +
      ';--team-rgb:' + escapeAttr(team.colorRgb) +
      ';--team-alt:#' + escapeAttr(team.alternateColor) + ';';
    return '<div class="sports-team-row' + resultClass + '" style="' + rowStyle + '">' +
      '<div class="sports-team-logo">' +
        (team.logo ? '<img src="' + escapeAttr(team.logo) + '" alt="" referrerpolicy="no-referrer">' : '') +
      '</div>' +
      '<div class="sports-team-main">' +
        '<div class="sports-team-code-line">' +
          '<span class="sports-team-code">' + escapeHtml(team.code || "—") + '</span>' +
          winnerArrow + possessionHtml + timeoutMarks +
          (team.record ? '<span class="sports-record">' + escapeHtml(team.record) + '</span>' : '') +
        '</div>' +
        '<div class="sports-team-name">' + escapeHtml(team.name || "") + '</div>' +
      '</div>' +
      scoreHtml +
    '</div>';
  }

  function nflLiveHtml(game) {
    const s = game.situation || {};
    const detail = String(game.statusDetail || "").toLowerCase();
    const period = game.period > 4 ? "OT" : (game.period ? "Q" + game.period : "");
    const center = detail.includes("half")
      ? "HALFTIME"
      : [period, game.clock].filter(Boolean).join(" • ");
    const down = s.shortDownDistanceText || s.downDistanceText || "";
    const posText = s.possessionText || "";
    const red = truthy(s.isRedZone);
    const parts = [];
    if (down) parts.push('<span>' + escapeHtml(down) + '</span>');
    if (posText) parts.push('<span>' + escapeHtml(posText) + '</span>');
    if (red) parts.push('<span class="sports-chip">Red zone</span>');
    return {
      center: center || game.statusDetail || "LIVE",
      detail: parts.join('<span>•</span>')
    };
  }

  function baseOccupied(value) {
    if (value === null || value === undefined || value === false || value === 0) return false;
    if (typeof value === "string" && ["","0","false","none","null"].includes(value.toLowerCase())) return false;
    return true;
  }

  function mlbLiveHtml(game) {
    const s = game.situation || {};
    const detail = String(game.statusDetail || "");
    const topFromDetail = /^top\b/i.test(detail);
    const bottomFromDetail = /^bot|^bottom\b/i.test(detail);
    const top = typeof s.isTopInning === "boolean" ? s.isTopInning : (topFromDetail ? true : bottomFromDetail ? false : true);
    const inning = game.period || safeNumber(s.inning, 0);
    const center = (top ? "▲ " : "▼ ") + (inning ? ordinal(inning) : (detail || "LIVE"));
    const first = baseOccupied(s.onFirst);
    const second = baseOccupied(s.onSecond);
    const third = baseOccupied(s.onThird);
    const balls = Number(s.balls);
    const strikes = Number(s.strikes);
    const outs = Number(s.outs);
    const countBits = [];
    if (Number.isFinite(balls) && Number.isFinite(strikes)) {
      countBits.push('<span class="sports-count"><span>B</span><b>' + balls + '</b><span>–</span><span>S</span><b>' + strikes + '</b></span>');
    }
    if (Number.isFinite(outs)) {
      countBits.push('<span class="sports-count"><span>OUT</span><b>' + outs + '</b></span>');
    }
    const bases = '<span class="sports-bases" aria-label="Base runners">' +
      '<span class="sports-base first' + (first ? ' on' : '') + '"></span>' +
      '<span class="sports-base second' + (second ? ' on' : '') + '"></span>' +
      '<span class="sports-base third' + (third ? ' on' : '') + '"></span>' +
    '</span>';
    return { center, detail: bases + countBits.join('<span>•</span>') };
  }

  function nhlPowerPlay(game) {
    const s = game.situation || {};
    let away = truthy(s.awayPowerPlay);
    let home = truthy(s.homePowerPlay);
    if (!away && !home && (truthy(s.isPowerPlay) || truthy(s.powerPlay))) {
      const team = resolveTeamRef(game, s.powerPlayTeam || s.possession || s.team);
      away = team === game.away.code;
      home = team === game.home.code;
    }
    return { away, home };
  }

  function nhlLiveHtml(game) {
    const period = game.period > 4 ? "SO" : game.period === 4 ? "OT" : (game.period ? "P" + game.period : "");
    const center = [period, game.clock].filter(Boolean).join(" • ") || game.statusDetail || "LIVE";
    const pp = nhlPowerPlay(game);
    const awaySog = teamStat(game.away.raw, ["shotsonGoal","shotsongoal","sog","shots"]);
    const homeSog = teamStat(game.home.raw, ["shotsonGoal","shotsongoal","sog","shots"]);
    const parts = [];
    if (awaySog || homeSog) {
      parts.push('<span>SOG ' + escapeHtml(game.away.code) + ' ' + escapeHtml(awaySog || "–") +
        ' • ' + escapeHtml(game.home.code) + ' ' + escapeHtml(homeSog || "–") + '</span>');
    }
    if (pp.away || pp.home) {
      parts.push('<span class="sports-chip">PP ' + escapeHtml(pp.away ? game.away.code : game.home.code) + '</span>');
    }
    return { center, detail: parts.join('<span>•</span>') };
  }

  function liveInfo(game) {
    if (game.league === "nfl") return nflLiveHtml(game);
    if (game.league === "mlb") return mlbLiveHtml(game);
    return nhlLiveHtml(game);
  }

  function finalLabel(game) {
    const text = String(game.statusDetail || "").trim();
    if (/final/i.test(text)) return text.toUpperCase();
    if (game.league === "nhl" && game.period === 4) return "FINAL/OT";
    if (game.league === "nhl" && game.period > 4) return "FINAL/SO";
    return "FINAL";
  }

  function pageDots(index, total) {
    if (total <= 1) return "";
    if (total > 8) return '<span>' + (index + 1) + ' / ' + total + '</span>';
    return '<span class="sports-page-dots">' +
      Array.from({ length: total }, (_, i) =>
        '<span class="sports-page-dot' + (i === index ? ' active' : '') + '"></span>'
      ).join("") +
    '</span>';
  }

  function renderLeague(league) {
    const module = zone.querySelector('[data-sports-league="' + league + '"]');
    if (!module) return;
    const games = displayGames(league);
    const rt = runtime[league];

    if (!games.length) {
      const message = config.leagues[league].mode === "watch" && !config.leagues[league].watchTeams.length
        ? "Select one or more teams to watch."
        : rt.error
          ? "Live score feed is reconnecting…"
          : "No matching games in the current slate.";
      module.dataset.gameId = "";
      module.innerHTML =
        '<div class="sports-module-head"><span class="sports-league-name">' + LEAGUES[league].label + '</span><span class="sports-state">—</span></div>' +
        '<div class="sports-empty">' + escapeHtml(message) + '</div>' +
        '<div class="sports-module-foot"></div>';
      return;
    }

    let index = games.findIndex(game => game.id === rt.currentGameId);
    if (index < 0) {
      index = 0;
      rt.currentGameId = games[0].id;
      rt.nextCycleAt = nextCycleBoundary(config.leagues[league].cycleSeconds);
    }
    const game = games[index];
    const changedGame = module.dataset.gameId && module.dataset.gameId !== game.id;
    module.dataset.gameId = game.id;
    module.style.setProperty("--away-rgb", game.away.colorRgb || "142,149,163");
    module.style.setProperty("--home-rgb", game.home.colorRgb || "142,149,163");

    let center = "";
    let detail = "";
    if (game.state === "pre") {
      center = formatStart(game);
      detail = "Scheduled";
    } else if (game.state === "post") {
      center = finalLabel(game);
      detail = game.statusDetail && !/final/i.test(game.statusDetail) ? game.statusDetail : "";
    } else {
      const info = liveInfo(game);
      center = info.center;
      detail = info.detail;
    }

    module.innerHTML =
      '<div class="sports-module-head">' +
        '<span class="sports-league-name">' + LEAGUES[league].label + '</span>' +
        '<span class="sports-state ' + (game.state === "in" ? 'live' : '') + '">' + escapeHtml(stateText(game)) + '</span>' +
      '</div>' +
      '<div class="sports-scorebug">' +
        teamRowHtml(game, "away") +
        teamRowHtml(game, "home") +
        '<div class="sports-center-line">' + center + '</div>' +
        '<div class="sports-detail-line">' + detail + '</div>' +
      '</div>' +
      '<div class="sports-module-foot">' + pageDots(index, games.length) + '</div>';

    if (changedGame) {
      module.classList.remove("switching");
      void module.offsetWidth;
      module.classList.add("switching");
      setTimeout(() => module.classList.remove("switching"), 380);
    }
  }

  function enabledLeagueKeys() {
    if (!config.enabled) return [];
    return Object.keys(LEAGUES).filter(key => config.leagues[key].enabled);
  }

  function renderAllModules() {
    const enabled = enabledLeagueKeys();
    zone.hidden = enabled.length === 0;
    zone.dataset.count = String(enabled.length || 1);
    zone.classList.toggle("color-mode", config.appearance === "color");
    zone.classList.toggle("boxes-hidden", !config.showBoxes);

    if (ticker) {
      ticker.hidden = !config.enabled || !headlineSignature;
    }

    for (const key of Object.keys(LEAGUES)) {
      let module = zone.querySelector('[data-sports-league="' + key + '"]');
      if (!enabled.includes(key)) {
        module?.remove();
        continue;
      }
      if (!module) {
        module = document.createElement("section");
        module.className = "sports-module";
        module.dataset.sportsLeague = key;
        module.setAttribute("aria-label", LEAGUES[key].label + " scores");
        zone.appendChild(module);
      }
    }

    enabled.forEach(key => {
      const module = zone.querySelector('[data-sports-league="' + key + '"]');
      if (module) zone.appendChild(module);
      renderLeague(key);
    });
  }

  const HEADLINE_CACHE_KEY = "daq-board-espn-exact-top-headlines-v3";
  const ESPN_HOME_URL = "https://www.espn.com/";
  const ESPN_TOP_HEADLINES_SECTION_ID = "45672706";
  const ESPN_HOME_PROXIES = [
    url => "https://api.allorigins.win/raw?url=" + encodeURIComponent(url),
    url => "https://corsproxy.io/?" + encodeURIComponent(url),
    url => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(url)
  ];

  let headlineTimer = null;
  let headlineFetching = false;
  let headlineSignature = "";
  let headlineItems = [];
  let staticHeadlineIndex = 0;
  let staticHeadlineTimer = null;

  function leagueFromEspnHref(href) {
    const match = String(href || "").match(/^\/(nfl|mlb|nhl|nba)(?:\/|$)/i);
    return match ? match[1].toUpperCase() : "";
  }

  function extractExactEspnTopHeadlines(htmlText) {
    const html = String(htmlText || "");
    if (!html) return [];

    const doc = new DOMParser().parseFromString(html, "text/html");
    const section = doc.querySelector(
      'section[data-id="' + ESPN_TOP_HEADLINES_SECTION_ID + '"], ' +
      'section[data-now-id="1-' + ESPN_TOP_HEADLINES_SECTION_ID + '"]'
    );
    if (!section) return [];

    const heading = section.querySelector("h2");
    if (!heading || heading.textContent.trim() !== "Top Headlines") return [];

    const items = [];
    const seen = new Set();
    section.querySelectorAll('.headlineStack.top-headlines a[data-mpType="headline"]').forEach(anchor => {
      const href = anchor.getAttribute("href") || "";
      const league = leagueFromEspnHref(href);
      const headline = anchor.textContent.replace(/\s+/g, " ").trim();
      if (!league || !headline) return;

      const key = league + ":" + headline.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      items.push({ league, headline, href });
    });

    // Preserve ESPN's exact box order. Do not rank, re-sort, score, infer, or
    // supplement with any other feed.
    return items.slice(0, 14);
  }

  function loadCachedTopHeadlines() {
    try {
      const cached = JSON.parse(localStorage.getItem(HEADLINE_CACHE_KEY) || "null");
      if (!cached || !Array.isArray(cached.items)) return [];
      return cached.items.filter(item =>
        item &&
        typeof item.headline === "string" &&
        ["NFL", "MLB", "NHL", "NBA"].includes(item.league)
      ).slice(0, 14);
    } catch {
      return [];
    }
  }

  function saveCachedTopHeadlines(items) {
    try {
      localStorage.setItem(HEADLINE_CACHE_KEY, JSON.stringify({
        savedAt: Date.now(),
        items: items.slice(0, 14)
      }));
    } catch {}
  }

  async function fetchSameOriginTopHeadlines() {
    const response = await fetch("headlines.json?_=" + Date.now(), {
      cache: "no-store",
      credentials: "same-origin"
    });
    if (!response.ok) throw new Error("headlines.json HTTP " + response.status);
    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];
    return items.filter(item =>
      item &&
      typeof item.headline === "string" &&
      ["NFL", "MLB", "NHL", "NBA"].includes(item.league)
    ).slice(0, 14);
  }

  async function fetchLiveExactEspnTopHeadlines() {
    const target = ESPN_HOME_URL + "?_daq=" + Date.now();
    let lastError = null;

    for (const buildProxyUrl of ESPN_HOME_PROXIES) {
      try {
        const response = await fetch(buildProxyUrl(target), {
          cache: "no-store",
          credentials: "omit"
        });
        if (!response.ok) throw new Error("proxy HTTP " + response.status);
        const html = await response.text();
        const items = extractExactEspnTopHeadlines(html);
        if (items.length) return items;
        throw new Error("Top Headlines section not found");
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("ESPN Top Headlines unavailable");
  }

  function clearStaticHeadlineTimer() {
    clearTimeout(staticHeadlineTimer);
    staticHeadlineTimer = null;
  }

  function fitStaticHeadlineToOneLine() {
    if (!ticker || !tickerTrack || config.headlineMode !== "static") return;
    const row = tickerTrack.querySelector(".sports-headline-static");
    const textNode = tickerTrack.querySelector(".sports-headline-static-text");
    const leagueNode = tickerTrack.querySelector(".sports-headline-league");
    if (!row || !textNode) return;

    // Always begin at the exact normal headline size used by scrolling mode.
    textNode.style.fontSize = "";
    const baseSize = parseFloat(getComputedStyle(textNode).fontSize) || 28;
    const minSize = baseSize * 0.72;
    let size = baseSize;

    const rowStyle = getComputedStyle(row);
    const padding =
      (parseFloat(rowStyle.paddingLeft) || 0) +
      (parseFloat(rowStyle.paddingRight) || 0);
    const gap = parseFloat(rowStyle.columnGap || rowStyle.gap) || 0;
    const leagueWidth = leagueNode ? leagueNode.getBoundingClientRect().width : 0;
    const availableTextWidth = Math.max(
      80,
      ticker.clientWidth - padding - gap - leagueWidth
    );

    // Measure only the actual headline text. The old logic measured the 100%-wide
    // row itself, which caused short headlines to shrink even when they fit.
    while (textNode.scrollWidth > availableTextWidth && size > minSize) {
      size -= 0.5;
      textNode.style.fontSize = size.toFixed(1) + "px";
    }
  }

  function renderStaticHeadline() {
    clearStaticHeadlineTimer();
    if (!ticker || !tickerTrack || !headlineItems.length || !config.enabled) {
      if (ticker) ticker.hidden = true;
      return;
    }

    staticHeadlineIndex = Math.max(0, Math.min(staticHeadlineIndex, headlineItems.length - 1));
    const item = headlineItems[staticHeadlineIndex];

    ticker.classList.add("static-mode");
    tickerTrack.classList.remove("running");
    tickerTrack.innerHTML =
      '<div class="sports-headline-static">' +
        '<span class="sports-headline-league">' + escapeHtml(item.league) + '</span>' +
        '<span class="sports-headline-static-text">' + escapeHtml(item.headline) + '</span>' +
      '</div>';
    ticker.hidden = false;

    requestAnimationFrame(() => {
      fitStaticHeadlineToOneLine();
      const row = tickerTrack.querySelector(".sports-headline-static");
      if (row) {
        row.classList.remove("entering");
        void row.offsetWidth;
        row.classList.add("entering");
      }
    });

    if (headlineItems.length > 1) {
      staticHeadlineTimer = setTimeout(() => {
        staticHeadlineIndex = (staticHeadlineIndex + 1) % headlineItems.length;
        renderStaticHeadline();
      }, 5000);
    }
  }

  function renderScrollingHeadlines() {
    clearStaticHeadlineTimer();
    if (!ticker || !tickerTrack || !headlineItems.length || !config.enabled) {
      if (ticker) ticker.hidden = true;
      return;
    }

    ticker.classList.remove("static-mode");

    const groupHtml = '<div class="sports-headline-group">' +
      headlineItems.map(item =>
        '<span class="sports-headline-item">' +
          '<span class="sports-headline-league">' + escapeHtml(item.league) + '</span>' +
          '<span class="sports-headline-text">' + escapeHtml(item.headline) + '</span>' +
          '<span class="sports-headline-separator" aria-hidden="true">•</span>' +
        '</span>'
      ).join("") +
    '</div>';

    tickerTrack.innerHTML = groupHtml + groupHtml;
    ticker.hidden = false;

    const totalChars = headlineItems.reduce((sum, item) => sum + item.headline.length + 8, 0);
    const duration = Math.max(48, Math.min(130, totalChars * 0.21));
    tickerTrack.style.setProperty("--headline-duration", duration.toFixed(1) + "s");

    tickerTrack.classList.remove("running");
    void tickerTrack.offsetWidth;
    tickerTrack.classList.add("running");
  }

  function renderHeadlineMode() {
    if (!ticker || !tickerTrack) return;
    if (!config.enabled || !headlineItems.length) {
      ticker.hidden = true;
      clearStaticHeadlineTimer();
      return;
    }
    if (config.headlineMode === "static") renderStaticHeadline();
    else renderScrollingHeadlines();
  }

  function renderHeadlines(items) {
    const cleanItems = (Array.isArray(items) ? items : [])
      .filter(item =>
        item &&
        typeof item.headline === "string" &&
        item.headline.trim() &&
        ["NFL", "MLB", "NHL", "NBA"].includes(item.league)
      )
      .slice(0, 14);

    const signature = cleanItems.map(item => item.league + ":" + item.headline).join("|");
    const changed = signature !== headlineSignature;
    headlineSignature = signature;
    headlineItems = cleanItems;

    if (!cleanItems.length) {
      clearStaticHeadlineTimer();
      if (ticker) ticker.hidden = true;
      if (tickerTrack) tickerTrack.innerHTML = "";
      return;
    }

    if (changed) {
      staticHeadlineIndex = 0;
      renderHeadlineMode();
    } else if (ticker?.hidden && config.enabled) {
      renderHeadlineMode();
    }
  }

  async function refreshHeadlines() {
    clearTimeout(headlineTimer);

    if (!config.enabled) {
      if (ticker) ticker.hidden = true;
      clearStaticHeadlineTimer();
      return;
    }

    if (headlineFetching) return;
    headlineFetching = true;

    try {
      let headlines = [];

      // First choice: scrape the literal Top Headlines box from ESPN.com right now.
      try {
        headlines = await fetchLiveExactEspnTopHeadlines();
      } catch {}

      // Reliable fallback: the repo refreshes this exact same ESPN box on a
      // schedule, so even if a display/browser blocks the proxy we still never
      // substitute generic news/article feeds.
      if (!headlines.length) {
        try {
          headlines = await fetchSameOriginTopHeadlines();
        } catch {}
      }

      if (headlines.length) {
        saveCachedTopHeadlines(headlines);
        renderHeadlines(headlines);
      } else if (!headlineItems.length) {
        const cached = loadCachedTopHeadlines();
        if (cached.length) renderHeadlines(cached);
      }
    } finally {
      headlineFetching = false;
      if (config.enabled) {
        headlineTimer = setTimeout(refreshHeadlines, 30 * 1000);
      }
    }
  }

  function leagueHasActiveGame(league) {
    const now = Date.now();
    return runtime[league].games.some(game => {
      if (game.state === "in") return true;
      if (game.state !== "pre") return false;
      const delta = gameStartMs(game) - now;
      return delta >= 0 && delta <= 5 * 60 * 1000;
    });
  }

  function nextPollDelay(league) {
    if (leagueHasActiveGame(league)) return 5000;
    if (runtime[league].games.length) return 60000;
    return 300000;
  }

  function stopLeaguePolling(league) {
    const rt = runtime[league];
    clearTimeout(rt.fetchTimer);
    rt.fetchTimer = null;
  }

  async function refreshLeague(league) {
    const setting = config.leagues[league];
    if (!config.enabled || !setting.enabled) {
      stopLeaguePolling(league);
      return;
    }
    const rt = runtime[league];
    if (rt.fetching) return;
    stopLeaguePolling(league);
    rt.fetching = true;
    try {
      const events = await fetchLeagueEvents(league);
      rt.games = events.map(event => normalizeEvent(league, event));
      rt.error = "";
      rt.updatedAt = Date.now();
      if (rt.currentGameId && !displayGames(league).some(game => game.id === rt.currentGameId)) {
        rt.currentGameId = "";
      }
      renderLeague(league);
    } catch (error) {
      rt.error = String(error?.message || error || "Feed unavailable");
      renderLeague(league);
    } finally {
      rt.fetching = false;
      if (config.enabled && config.leagues[league].enabled) {
        rt.fetchTimer = setTimeout(() => refreshLeague(league), rt.error ? 15000 : nextPollDelay(league));
      }
    }
  }

  function reconcilePolling({ immediate = false } = {}) {
    for (const key of Object.keys(LEAGUES)) {
      if (!config.enabled || !config.leagues[key].enabled) {
        stopLeaguePolling(key);
        continue;
      }
      if (immediate || (!runtime[key].fetchTimer && !runtime[key].fetching)) {
        refreshLeague(key);
      }
    }
  }

  function nextCycleBoundary(seconds, now = Date.now()) {
    const period = Math.max(1, Number(seconds) || 15) * 1000;
    return Math.floor(now / period) * period + period;
  }

  function resetCycle(league, clearGame = false) {
    const rt = runtime[league];
    if (clearGame) rt.currentGameId = "";
    rt.nextCycleAt = nextCycleBoundary(config.leagues[league].cycleSeconds);
    renderLeague(league);
  }

  setInterval(() => {
    if (!config.enabled) return;
    const now = Date.now();
    for (const league of Object.keys(LEAGUES)) {
      const setting = config.leagues[league];
      if (!setting.enabled) continue;
      const games = displayGames(league);
      if (games.length <= 1) continue;
      const rt = runtime[league];
      if (!rt.nextCycleAt) rt.nextCycleAt = nextCycleBoundary(setting.cycleSeconds, now);
      if (now < rt.nextCycleAt) continue;
      let index = games.findIndex(game => game.id === rt.currentGameId);
      if (index < 0) index = 0;
      index = (index + 1) % games.length;
      rt.currentGameId = games[index].id;
      rt.nextCycleAt = nextCycleBoundary(setting.cycleSeconds, now);
      renderLeague(league);
    }
  }, 350);

  function switchHtml(id, checked, label) {
    return '<label class="sports-switch" title="' + escapeAttr(label) + '">' +
      '<input type="checkbox" id="' + escapeAttr(id) + '"' + (checked ? ' checked' : '') + '>' +
      '<span class="sports-switch-track" aria-hidden="true"></span>' +
    '</label>';
  }

  function cycleButtons(league, value) {
    return '<div class="sports-cycle-options">' +
      [5,10,15,30,45,60].map(seconds =>
        '<button type="button" data-sports-cycle="' + league + '" data-seconds="' + seconds + '" class="' + (value === seconds ? 'active' : '') + '">' +
          seconds + 's' +
        '</button>'
      ).join("") +
    '</div>';
  }

  function teamPicker(league, selected) {
    const selectedSet = new Set(selected);
    return '<div class="sports-team-picker">' +
      TEAM_LISTS[league].map(([code, name]) =>
        '<button type="button" class="sports-team-pick' + (selectedSet.has(code) ? ' selected' : '') + '"' +
          ' data-sports-team="' + league + '" data-team="' + escapeAttr(code) + '" title="' + escapeAttr(name) + '">' +
          escapeHtml(code) +
        '</button>'
      ).join("") +
    '</div>';
  }

  function leagueSettingsHtml(league) {
    const setting = config.leagues[league];
    const options = setting.enabled
      ? '<div class="sports-league-options">' +
          '<div class="sports-setting-row">' +
            '<span class="sports-setting-label">Mode</span>' +
            '<div class="sports-segmented">' +
              '<button type="button" data-sports-mode="' + league + '" data-mode="cycle" class="' + (setting.mode === "cycle" ? 'active' : '') + '">Cycle</button>' +
              '<button type="button" data-sports-mode="' + league + '" data-mode="watch" class="' + (setting.mode === "watch" ? 'active' : '') + '">Watch</button>' +
            '</div>' +
          '</div>' +
          '<div class="sports-setting-row">' +
            '<span class="sports-setting-label">Cycle time</span>' +
            cycleButtons(league, setting.cycleSeconds) +
          '</div>' +
          (setting.mode === "watch"
            ? '<div class="sports-setting-label">Watch team(s)</div>' + teamPicker(league, setting.watchTeams)
            : '') +
        '</div>'
      : "";

    return '<div class="sports-league-settings">' +
      '<div class="sports-league-settings-head">' +
        '<span class="sports-league-settings-name">' + LEAGUES[league].label + '</span>' +
        switchHtml("sports-" + league + "-enabled", setting.enabled, "Show " + LEAGUES[league].label) +
      '</div>' +
      options +
    '</div>';
  }

  function renderSettings() {
    settingsRoot.innerHTML =
      '<div class="sports-settings-wrap' + (config.expanded ? ' expanded' : '') + '">' +
        '<div class="sports-settings-head">' +
          '<button type="button" class="sports-expand-button" data-sports-expand>' +
            '<span>Sports settings</span><span class="sports-expand-caret" aria-hidden="true"></span>' +
          '</button>' +
          switchHtml("sports-master-enabled", config.enabled, "Show sports scores") +
        '</div>' +
        '<div class="sports-settings-panel">' +
          '<div class="sports-style-setting">' +
            '<span class="sports-setting-label">Style</span>' +
            '<div class="sports-segmented">' +
              '<button type="button" data-sports-appearance="monotone" class="' + (config.appearance === "monotone" ? 'active' : '') + '">Monotone</button>' +
              '<button type="button" data-sports-appearance="color" class="' + (config.appearance === "color" ? 'active' : '') + '">Color</button>' +
            '</div>' +
          '</div>' +
          '<div class="sports-style-setting">' +
            '<span class="sports-setting-label">Scoreboard boxes</span>' +
            '<div class="sports-segmented">' +
              '<button type="button" data-sports-boxes="show" class="' + (config.showBoxes ? 'active' : '') + '">Show</button>' +
              '<button type="button" data-sports-boxes="hide" class="' + (!config.showBoxes ? 'active' : '') + '">Hide</button>' +
            '</div>' +
          '</div>' +
          '<div class="sports-style-setting">' +
            '<span class="sports-setting-label">Headlines</span>' +
            '<div class="sports-segmented">' +
              '<button type="button" data-headline-mode="scroll" class="' + (config.headlineMode === "scroll" ? 'active' : '') + '">Scroll</button>' +
              '<button type="button" data-headline-mode="static" class="' + (config.headlineMode === "static" ? 'active' : '') + '">Static</button>' +
            '</div>' +
          '</div>' +
          Object.keys(LEAGUES).map(leagueSettingsHtml).join("") +
        '</div>' +
      '</div>';
  }

  function afterConfigChange({ refresh = false, league = null, clearGame = false } = {}) {
    saveSettings();
    renderSettings();
    renderAllModules();
    if (league) resetCycle(league, clearGame);
    if (refresh) reconcilePolling({ immediate: true });
    else reconcilePolling();
  }

  settingsRoot.addEventListener("click", event => {
    const expand = event.target.closest("[data-sports-expand]");
    if (expand) {
      config.expanded = !config.expanded;
      afterConfigChange();
      return;
    }

    const appearance = event.target.closest("[data-sports-appearance]");
    if (appearance) {
      config.appearance = appearance.dataset.sportsAppearance === "color" ? "color" : "monotone";
      afterConfigChange();
      return;
    }

    const boxes = event.target.closest("[data-sports-boxes]");
    if (boxes) {
      config.showBoxes = boxes.dataset.sportsBoxes !== "hide";
      afterConfigChange();
      return;
    }

    const headlineMode = event.target.closest("[data-headline-mode]");
    if (headlineMode) {
      config.headlineMode = headlineMode.dataset.headlineMode === "static" ? "static" : "scroll";
      saveSettings();
      renderSettings();
      renderHeadlineMode();
      return;
    }

    const mode = event.target.closest("[data-sports-mode]");
    if (mode) {
      const league = mode.dataset.sportsMode;
      config.leagues[league].mode = mode.dataset.mode === "watch" ? "watch" : "cycle";
      afterConfigChange({ league, clearGame: true });
      return;
    }

    const cycle = event.target.closest("[data-sports-cycle]");
    if (cycle) {
      const league = cycle.dataset.sportsCycle;
      config.leagues[league].cycleSeconds = Number(cycle.dataset.seconds) || 15;
      afterConfigChange({ league });
      return;
    }

    const team = event.target.closest("[data-sports-team]");
    if (team) {
      const league = team.dataset.sportsTeam;
      const code = normalizeCode(league, team.dataset.team);
      const selected = config.leagues[league].watchTeams;
      config.leagues[league].watchTeams = selected.includes(code)
        ? selected.filter(item => item !== code)
        : [...selected, code];
      afterConfigChange({ league, clearGame: true });
    }
  });

  settingsRoot.addEventListener("change", event => {
    if (event.target.id === "sports-master-enabled") {
      config.enabled = event.target.checked;
      if (!config.enabled) {
        clearTimeout(headlineTimer);
        clearStaticHeadlineTimer();
        if (ticker) ticker.hidden = true;
      }
      afterConfigChange({ refresh: config.enabled });
      if (config.enabled) refreshHeadlines();
      return;
    }

    for (const league of Object.keys(LEAGUES)) {
      if (event.target.id === "sports-" + league + "-enabled") {
        config.leagues[league].enabled = event.target.checked;
        afterConfigChange({ refresh: event.target.checked, league, clearGame: true });
        return;
      }
    }
  });

  window.addEventListener("focus", () => {
    if (config.enabled) {
      reconcilePolling({ immediate: true });
      refreshHeadlines();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      if (config.enabled) {
        reconcilePolling({ immediate: true });
        refreshHeadlines();
      }
    }
  });

  const dashboardSettings = document.getElementById("settings");
  if (dashboardSettings) {
    const settingsObserver = new MutationObserver(() => {
      if (dashboardSettings.classList.contains("open") && config.expanded) {
        config.expanded = false;
        saveSettings();
        renderSettings();
      }
    });
    settingsObserver.observe(dashboardSettings, { attributes: true, attributeFilter: ["class"] });
  }

  renderSettings();
  renderAllModules();
  reconcilePolling({ immediate: true });
  if (config.enabled) {
    const cachedHeadlines = loadCachedTopHeadlines();
    if (cachedHeadlines.length) renderHeadlines(cachedHeadlines);
    refreshHeadlines();
  }

  window.DAQSports = {
    refresh: () => reconcilePolling({ immediate: true }),
    getSettings: () => JSON.parse(JSON.stringify(config)),
    getGames: league => JSON.parse(JSON.stringify(runtime[league]?.games || []))
  };
})();
