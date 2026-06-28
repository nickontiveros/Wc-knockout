// api/standings.js — reads the live ESPN World Cup feed and returns pool standings.
// No database, no keys. Runs on Vercel as a serverless function at /api/standings.

const ESPN_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=300&dates=20260611-20260719";

// Pool scoring: points awarded to the team that advances from each knockout round.
// Group stage and the 3rd-place playoff award nothing.
function roundPoints(slug) {
  const s = (slug || "").toLowerCase();
  if (s.includes("group")) return null;
  if (s.includes("third") || s.includes("3rd")) return null;
  if (s.includes("32")) return 1; // Round of 32
  if (s.includes("16")) return 1; // Round of 16
  if (s.includes("quarter")) return 2; // Quarterfinal
  if (s.includes("semi")) return 2; // Semifinal
  if (s.includes("final")) return 3; // Final
  return null;
}
const isKnockout = (slug) => {
  const s = (slug || "").toLowerCase();
  return !!s && !s.includes("group");
};

const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");

// Canonical pool names -> accepted aliases / abbreviations from ESPN.
const TEAMS = {
  Argentina: ["argentina", "arg"],
  Spain: ["spain", "esp"],
  France: ["france", "fra"],
  England: ["england", "eng"],
  Brazil: ["brazil", "bra"],
  Netherlands: ["netherlands", "ned", "nld", "holland"],
  Belgium: ["belgium", "bel"],
  Germany: ["germany", "ger", "deu"],
  Colombia: ["colombia", "col"],
  Mexico: ["mexico", "mex"],
  USA: ["usa", "unitedstates", "unitedstatesofamerica", "us", "ussoccer"],
  Switzerland: ["switzerland", "sui", "swi", "che"],
  Portugal: ["portugal", "por"],
  Morocco: ["morocco", "mar", "mor"],
  Croatia: ["croatia", "cro"],
  Japan: ["japan", "jpn"],
  Austria: ["austria", "aut"],
  Australia: ["australia", "aus"],
  Egypt: ["egypt", "egy"],
  Canada: ["canada", "can"],
  Norway: ["norway", "nor"],
  "Ivory Coast": ["ivorycoast", "cotedivoire", "civ"],
  "South Africa": ["southafrica", "rsa", "saf"],
  "Cape Verde": ["capeverde", "caboverde", "cpv"],
  Senegal: ["senegal", "sen"],
  Ghana: ["ghana", "gha"],
  "DR Congo": ["drcongo", "congodr", "democraticrepublicofthecongo", "cod", "cgo"],
  Algeria: ["algeria", "alg"],
  Iran: ["iran", "iriran", "irn"],
  Ecuador: ["ecuador", "ecu"],
  Sweden: ["sweden", "swe"],
  Bosnia: ["bosnia", "bosniaandherzegovina", "bosniaherzegovina", "bih"],
};

const LOOKUP = {};
for (const [canon, aliases] of Object.entries(TEAMS)) {
  LOOKUP[norm(canon)] = canon;
  for (const a of aliases) LOOKUP[a] = canon;
}
function resolveTeam(t) {
  if (!t) return null;
  for (const c of [t.abbreviation, t.displayName, t.name, t.shortDisplayName, t.location]) {
    const key = norm(c);
    if (key && LOOKUP[key]) return LOOKUP[key];
  }
  return null;
}

const PLAYERS = [
  { n: 1, name: "Miller", teams: ["France", "Morocco", "Egypt", "DR Congo"] },
  { n: 2, name: "Baron", teams: ["Spain", "Mexico", "Austria", "Bosnia"] },
  { n: 3, name: "Nick", teams: ["Brazil", "Colombia", "Australia", "Ecuador"] },
  { n: 4, name: "Alex", teams: ["Germany", "Portugal", "Ivory Coast", "Iran"] },
  { n: 5, name: "Ben", teams: ["Belgium", "Japan", "Cape Verde", "Sweden"] },
  { n: 6, name: "Rob", teams: ["England", "USA", "South Africa", "Algeria"] },
  { n: 7, name: "Helsel", teams: ["Argentina", "Croatia", "Norway", "Ghana"] },
  { n: 8, name: "Matt", teams: ["Netherlands", "Switzerland", "Canada", "Senegal"] },
];

module.exports = async (req, res) => {
  try {
    const r = await fetch(ESPN_URL, { headers: { "User-Agent": "wc-knockout-pool" } });
    if (!r.ok) throw new Error("ESPN feed returned " + r.status);
    const data = await r.json();
    const events = data.events || [];

    const team = {};
    for (const canon of Object.keys(TEAMS)) team[canon] = { points: 0, koGoals: 0, wins: 0 };

    for (const ev of events) {
      const comp = (ev.competitions && ev.competitions[0]) || {};
      const done = comp.status && comp.status.type && comp.status.type.completed;
      if (!done) continue;
      const slug = (ev.season && ev.season.slug) || "";
      if (!isKnockout(slug)) continue; // ignore the group stage
      const pts = roundPoints(slug);
      for (const c of comp.competitors || []) {
        const canon = resolveTeam(c.team);
        if (!canon) continue;
        const goals = parseInt(c.score, 10);
        if (!isNaN(goals)) team[canon].koGoals += goals; // goals tiebreaker (knockout stage)
        const advanced = c.winner === true || c.advance === true;
        if (advanced && pts != null) {
          team[canon].points += pts;
          team[canon].wins += 1;
        }
      }
    }

    let champion = null;
    for (const [canon, t] of Object.entries(team)) if (t.wins >= 5) champion = canon;

    const players = PLAYERS.map((p) => {
      const points = p.teams.reduce((s, t) => s + team[t].points, 0);
      const goals = p.teams.reduce((s, t) => s + team[t].koGoals, 0);
      const detail = p.teams.map((t) => ({ name: t, points: team[t].points, wins: team[t].wins }));
      return { n: p.n, name: p.name, points, goals, teams: detail };
    });
    players.sort((a, b) => b.points - a.points || b.goals - a.goals || a.n - b.n);
    players.forEach((p, i) => {
      p.rank = i + 1;
      p.prize = i < 2;
    });

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ ok: true, updatedAt: new Date().toISOString(), champion, players });
  } catch (e) {
    res.status(200).json({ ok: false, error: String((e && e.message) || e), updatedAt: new Date().toISOString() });
  }
};
