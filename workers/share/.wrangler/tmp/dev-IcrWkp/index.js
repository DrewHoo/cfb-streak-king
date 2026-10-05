var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../src/lib/chips.ts
var num = /* @__PURE__ */ __name((p) => p, "num");
var pre = /* @__PURE__ */ __name((c) => ({ ...c, pregame: true }), "pre");
var post = /* @__PURE__ */ __name((c) => ({ ...c, pregame: false }), "post");
var oppRankKnown = /* @__PURE__ */ __name((g) => g.oppRank != null, "oppRankKnown");
var ownRankKnown = /* @__PURE__ */ __name((g) => g.ownRank != null, "ownRankKnown");
var lined = /* @__PURE__ */ __name((g) => g.sp != null, "lined");
var BETTING = { exclusive: true, known: lined, floor: { season: 1978, what: "closing-line" } };
var HALF = { season: 2001, what: "halftime-score" };
var CLOCK = { season: 2004, what: "possession" };
var CHIPS = [
  pre({ key: "home", label: "at home", group: "site", exclusive: true, test: /* @__PURE__ */ __name((x) => x.home && !x.neutral, "test") }),
  pre({ key: "road", label: "on the road", group: "site", exclusive: true, test: /* @__PURE__ */ __name((x) => !x.home && !x.neutral, "test") }),
  pre({ key: "neutral", label: "neutral site", group: "site", exclusive: true, test: /* @__PURE__ */ __name((x) => x.neutral, "test") }),
  pre({ key: "away", label: "not at home", group: "site", exclusive: true, test: /* @__PURE__ */ __name((x) => !(x.home && !x.neutral), "test") }),
  pre({ key: "state", label: "in [state]", group: "site", param: "state", test: /* @__PURE__ */ __name((x, p) => x.vst === p, "test") }),
  pre({ key: "ranked", label: "vs ranked opponents", group: "opp rank", exclusive: true, known: oppRankKnown, test: /* @__PURE__ */ __name((x) => x.oppRank > 0, "test") }),
  pre({ key: "top10", label: "vs top-10 opponents", group: "opp rank", exclusive: true, known: oppRankKnown, test: /* @__PURE__ */ __name((x) => x.oppRank >= 1 && x.oppRank <= 10, "test") }),
  pre({ key: "top5", label: "vs top-5 opponents", group: "opp rank", exclusive: true, known: oppRankKnown, test: /* @__PURE__ */ __name((x) => x.oppRank >= 1 && x.oppRank <= 5, "test") }),
  pre({ key: "unranked", label: "vs unranked opponents", group: "opp rank", exclusive: true, known: oppRankKnown, test: /* @__PURE__ */ __name((x) => x.oppRank === 0, "test") }),
  pre({ key: "whileranked", label: "while ranked", group: "own rank", exclusive: true, known: ownRankKnown, test: /* @__PURE__ */ __name((x) => x.ownRank > 0, "test") }),
  pre({ key: "whileunranked", label: "while unranked", group: "own rank", exclusive: true, known: ownRankKnown, test: /* @__PURE__ */ __name((x) => x.ownRank === 0, "test") }),
  // a scheduled game's line moves until kickoff, so betting chips are post-hoc
  post({ key: "fav", label: "as the favorite", group: "betting", ...BETTING, test: /* @__PURE__ */ __name((x) => x.sp < 0, "test") }),
  post({ key: "dog", label: "as an underdog", group: "betting", ...BETTING, test: /* @__PURE__ */ __name((x) => x.sp > 0, "test") }),
  post({ key: "dog7", label: "as a 7+ point underdog", group: "betting", ...BETTING, test: /* @__PURE__ */ __name((x) => x.sp >= 7, "test") }),
  post({ key: "dog14", label: "as a 14+ point underdog", group: "betting", ...BETTING, test: /* @__PURE__ */ __name((x) => x.sp >= 14, "test") }),
  post({ key: "close", label: "close spread (\u2264 3)", group: "betting", ...BETTING, test: /* @__PURE__ */ __name((x) => Math.abs(x.sp) <= 3, "test") }),
  pre({ key: "confgame", label: "in conference games", group: "conference", exclusive: true, test: /* @__PURE__ */ __name((x) => x.conf, "test") }),
  pre({ key: "nonconf", label: "in non-conference games", group: "conference", exclusive: true, test: /* @__PURE__ */ __name((x) => !x.conf, "test") }),
  pre({ key: "vsconf", label: "vs the [conference]", group: "conference", param: "conf", test: /* @__PURE__ */ __name((x, p) => x.oppConf === p, "test") }),
  pre({ key: "vsteam", label: "vs [team]", group: "opponent", param: "team", test: /* @__PURE__ */ __name((x, p) => x.oppIdx === p, "test") }),
  // mascot kinds and school colors come from data/ref rulings; a team the
  // rulings don't know never qualifies
  pre({ key: "vsmascot", label: "vs [mascots]", group: "opponent", param: "mascot", test: /* @__PURE__ */ __name((x, p) => typeof p === "number" && x.oppMascots.includes(p), "test") }),
  pre({ key: "vscolor", label: "vs [color] schools", group: "opponent", param: "color", test: /* @__PURE__ */ __name((x, p) => typeof p === "number" && x.oppColor === p, "test") }),
  pre({ key: "rivalry", label: "rivalry game", group: "opponent", test: /* @__PURE__ */ __name((x) => x.rv > 0, "test") }),
  pre({ key: "instate", label: "in-state opponent", group: "opponent", test: /* @__PURE__ */ __name((x) => x.inState, "test") }),
  pre({ key: "curcoach", label: "under current head coach", group: "coach", test: /* @__PURE__ */ __name((x) => x.hcCur, "test") }),
  pre({ key: "newcoach", label: "in a coach\u2019s first season", group: "coach", test: /* @__PURE__ */ __name((x) => x.hcNew, "test") }),
  pre({ key: "vsnewcoach", label: "vs a first-year head coach", group: "coach", test: /* @__PURE__ */ __name((x) => x.vsNew, "test") }),
  pre({ key: "month", label: "in [month]", group: "calendar", param: "month", test: /* @__PURE__ */ __name((x, p) => x.month === p, "test") }),
  pre({ key: "opener", label: "season opener", group: "calendar", test: /* @__PURE__ */ __name((x) => !!x.opener, "test") }),
  pre({ key: "finale", label: "regular-season finale", group: "calendar", test: /* @__PURE__ */ __name((x) => !!x.finale, "test") }),
  pre({ key: "postseason", label: "bowl or playoff game", group: "calendar", exclusive: true, test: /* @__PURE__ */ __name((x) => x.post, "test") }),
  // the previous game can still be unplayed when a scheduled game is decided
  post({ key: "afterloss", label: "after a loss", group: "context", exclusive: true, test: /* @__PURE__ */ __name((x) => x.prevR === "L", "test") }),
  post({ key: "afterwin", label: "after a win", group: "context", exclusive: true, test: /* @__PURE__ */ __name((x) => x.prevR === "W", "test") }),
  post({ key: "afterbye", label: "after a bye", group: "context", test: /* @__PURE__ */ __name((x) => x.rest != null && x.rest >= 13, "test") }),
  post({ key: "leadhalf", label: "leading at half", group: "half", exclusive: true, param: "hmargin", known: /* @__PURE__ */ __name((x) => x.h1 != null, "known"), test: /* @__PURE__ */ __name((x, p) => x.h1 >= num(p), "test"), floor: HALF }),
  post({ key: "trailhalf", label: "trailing at half", group: "half", exclusive: true, param: "hmargin", known: /* @__PURE__ */ __name((x) => x.h1 != null, "known"), test: /* @__PURE__ */ __name((x, p) => x.h1 <= -num(p), "test"), floor: HALF }),
  post({ key: "wonpos", label: "won the clock", group: "possession", exclusive: true, known: /* @__PURE__ */ __name((x) => x.pos != null, "known"), test: /* @__PURE__ */ __name((x) => x.pos > 0.5, "test"), floor: CLOCK }),
  post({ key: "lostpos", label: "lost the clock", group: "possession", exclusive: true, known: /* @__PURE__ */ __name((x) => x.pos != null, "known"), test: /* @__PURE__ */ __name((x) => x.pos < 0.5, "test"), floor: CLOCK }),
  post({ key: "onescore", label: "one-score game", group: "shape", exclusive: true, notWith: ["C", "N"], test: /* @__PURE__ */ __name((x) => x.margin <= 8, "test") }),
  // a shootout is high-scoring AND contested: 70+ combined (1σ above the
  // all-time mean of 51.0) decided by fewer than 10 — 4.9% of games. A 73-0
  // blowout is not a shootout. struggle keeps the 1σ low bound (~15% tail).
  post({ key: "shootout", label: "shootout (70+, decided by <10)", group: "shape", exclusive: true, notWith: ["C", "N"], test: /* @__PURE__ */ __name((x) => x.total >= 70 && x.margin < 10, "test") }),
  post({ key: "struggle", label: "rock fight (\u2264 33)", group: "shape", exclusive: true, test: /* @__PURE__ */ __name((x) => x.total <= 33, "test") }),
  post({ key: "overtime", label: "overtime game", group: "shape", known: /* @__PURE__ */ __name((x) => x.ot >= 0, "known"), test: /* @__PURE__ */ __name((x) => x.ot > 0, "test"), floor: { season: 2001, what: "overtime" } }),
  // weekend and weekday by the game date; a full moon within a day of its evening (moon.ts)
  pre({ key: "weekend", label: "on a weekend", group: "almanac", exclusive: true, test: /* @__PURE__ */ __name((x) => x.wday === 0 || x.wday === 6, "test") }),
  pre({ key: "weekday", label: "on a weekday", group: "almanac", exclusive: true, test: /* @__PURE__ */ __name((x) => x.wday >= 1 && x.wday <= 5, "test") }),
  pre({ key: "fullmoon", label: "under a full moon", group: "almanac", test: /* @__PURE__ */ __name((x) => x.moon, "test") }),
  pre({ key: "night", label: "night game (6pm+)", group: "kickoff", known: /* @__PURE__ */ __name((x) => x.hh !== 31, "known"), test: /* @__PURE__ */ __name((x) => x.hh >= 18, "test"), floor: { season: 2002, what: "kickoff-time" } })
];
var chipByKey = new Map(CHIPS.map((c) => [c.key, c]));
var fitsDir = /* @__PURE__ */ __name((c, dir) => !c.notWith?.includes(dir), "fitsDir");
var conflicts = /* @__PURE__ */ __name((a, b) => !!a.exclusive && !!b.exclusive && a.group === b.group, "conflicts");
var PLAIN_CHIPS = CHIPS.filter((c) => !c.param);
var [PLAIN_DEFINITIONS, PLAIN_STREAK_KINDS] = (() => {
  const outcomes = ["W", "L", "U", "C", "N"];
  let defs = 0, kinds = 0;
  (/* @__PURE__ */ __name((function walk(start, chosen) {
    defs++;
    kinds += outcomes.filter((d) => chosen.every((j) => fitsDir(PLAIN_CHIPS[j], d))).length;
    if (chosen.length === 4) return;
    for (let i = start; i < PLAIN_CHIPS.length; i++) {
      if (chosen.some((j) => conflicts(PLAIN_CHIPS[j], PLAIN_CHIPS[i]))) continue;
      walk(i + 1, [...chosen, i]);
    }
  }), "walk"))(0, []);
  return [defs, kinds];
})();

// ../../src/lib/format.ts
var DIR_WORDS = { W: "winning", L: "losing", U: "undefeated", C: "covering", N: "not covering" };
var dirWord = /* @__PURE__ */ __name((dir) => DIR_WORDS[dir] ?? "winning", "dirWord");
var STATE_NAMES = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "Washington, DC",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming"
};
var stateName = /* @__PURE__ */ __name((code) => STATE_NAMES[code] ?? code, "stateName");

// ../../src/lib/shareWords.ts
var DEFAULT_WORDS = ["vs unranked opponents"];
var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
var MASCOT_CLASS_WORDS = {
  animal: "animal mascots",
  people: "human mascots",
  bird: "bird mascots",
  cat: "cat mascots",
  canine: "dog & wolf mascots",
  myth: "mythical mascots",
  force: "forces of nature"
};
var mascotKey = /* @__PURE__ */ __name((entry) => entry.toLowerCase().replace(/[^a-z0-9]+/g, "-"), "mascotKey");
function word(c, raw, meta) {
  if (!c.param) return c.label;
  if (raw == null || raw === "") return null;
  switch (c.param) {
    case "month": {
      const n = Number(raw);
      return MONTH_NAMES[n - 1] ? `in ${MONTH_NAMES[n - 1]}` : null;
    }
    case "hmargin": {
      const n = Number(raw);
      return Number.isFinite(n) ? n > 1 ? `${c.label} by ${n}+` : c.label : null;
    }
    case "state":
      return `in ${stateName(raw)}`;
    case "conf":
      return `vs the ${raw}`;
    case "team":
      return meta.teams[raw] ? `vs ${meta.teams[raw]}` : null;
    case "mascot": {
      const m = meta.mascots.find((x) => mascotKey(x) === raw);
      return m ? `vs ${MASCOT_CLASS_WORDS[m] ?? m}` : null;
    }
    case "color":
      return meta.colors.includes(raw) ? `vs ${raw} schools` : null;
  }
}
__name(word, "word");
function defWords(c, meta) {
  if (c == null) return null;
  if (c === "all") return [];
  const out = [];
  for (const part of c.split(",").slice(0, 4)) {
    const [key, ...rest] = part.split(":");
    const chip = chipByKey.get(key);
    if (!chip) continue;
    const w = word(chip, rest.length ? rest.join(":") : void 0, meta);
    if (w) out.push(w);
  }
  return out;
}
__name(defWords, "defWords");
var SCOPE = /* @__PURE__ */ __name((q) => q.get("scope") === "active" ? "active" : "all-time", "SCOPE");
var DIR = /* @__PURE__ */ __name((q) => {
  const d = q.get("dir");
  return dirWord(d === "L" || d === "U" || d === "C" || d === "N" ? d : "W");
}, "DIR");
function shareText(pathname, q, meta) {
  const team = /\/team\/([a-z0-9-]+)\/?$/.exec(pathname)?.[1];
  if (team) {
    const vs = q.get("vs");
    if (!vs || !meta.teams[team]) return null;
    const name = meta.teams[team];
    const opp = vs === "next" ? null : meta.teams[vs];
    if (vs !== "next" && !opp) return null;
    const title = opp ? `${name} vs ${opp} \xB7 ${meta.site}` : `${name}\u2019s next game \xB7 ${meta.site}`;
    return { title, description: `Every streak either side puts on the line in the game, with the line and both teams\u2019 records.` };
  }
  if (!/\/$/.test(pathname) || /\/(team|games)\//.test(pathname) || /\/games\/?$/.test(pathname)) return null;
  if (!["c", "dir", "scope", "t", "run", "week"].some((k) => q.has(k))) return null;
  const words = defWords(q.get("c"), meta) ?? DEFAULT_WORDS;
  const t = q.get("t");
  const who = t && meta.teams[t] ? `${meta.teams[t]} \u2014 ` : "";
  const tail = words.length ? ` \xB7 ${words.join(" \xB7 ")}` : "";
  return {
    title: `${who}Longest ${SCOPE(q)} ${DIR(q)} streaks${tail} \xB7 ${meta.site}`,
    description: `Every current FBS team\u2019s longest ${SCOPE(q)} ${DIR(q)} streak${words.length ? ` ${words.join(", ")}` : ""}, ranked since 1936. Open a column for every game in the run.`
  };
}
__name(shareText, "shareText");

// index.ts
var ORIGIN = "https://drewhoover.com";
var FALLBACK_META = { site: "College Football Streak King", teams: {}, mascots: [], colors: [] };
var metaCache = null;
async function loadMeta() {
  if (metaCache) return metaCache;
  const res = await fetch(`${ORIGIN}/cfb-streak-king/share/meta.json`, {
    cf: { cacheTtl: 3600, cacheEverything: true }
  });
  if (!res.ok) {
    await res.body?.cancel();
    return FALLBACK_META;
  }
  const meta = await res.json();
  if (!meta?.site || typeof meta.teams !== "object") return FALLBACK_META;
  return metaCache = meta;
}
__name(loadMeta, "loadMeta");
var content = /* @__PURE__ */ __name((text) => ({
  element(e) {
    e.setAttribute("content", text);
  }
}), "content");
var index_default = {
  async fetch(request) {
    const url = new URL(request.url);
    const res = await fetch(new Request(`${ORIGIN}${url.pathname}${url.search}`, request));
    try {
      if (request.method !== "GET") return res;
      if (!(res.headers.get("content-type") ?? "").includes("text/html")) return res;
      const text = shareText(url.pathname, url.searchParams, await loadMeta());
      if (!text) return res;
      return new HTMLRewriter().on("title", { element(e) {
        e.setInnerContent(text.title);
      } }).on('meta[name="description"]', content(text.description)).on('meta[property="og:title"]', content(text.title)).on('meta[property="og:description"]', content(text.description)).on('meta[property="og:url"]', content(`${ORIGIN}${url.pathname}${url.search}`)).on('meta[name="twitter:title"]', content(text.title)).on('meta[name="twitter:description"]', content(text.description)).transform(res);
    } catch (e) {
      console.log(JSON.stringify({ event: "share_rewrite_failed", url: url.pathname + url.search, error: String(e) }));
      return res;
    }
  }
};

// ../../../../../../../.npm/_npx/d77349f55c2be1c0/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../../../.npm/_npx/d77349f55c2be1c0/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-NgWEIN/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = index_default;

// ../../../../../../../.npm/_npx/d77349f55c2be1c0/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-NgWEIN/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
