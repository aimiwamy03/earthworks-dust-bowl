// EARTHWORKS · Dust Bowl engine. Deterministic: same input -> same output on every device.
// Board: ROWS x COLS tiles, encoded as a string of 2 chars per tile: type + soil digit (0-9).
// Types: P prairie (native grass), Y young grass (re-seeded), W wheat, C wheat + cover crop,
//        S sapling tree row, T mature tree row.
var DB = (function () {
  var ROWS = 6, COLS = 8, N = ROWS * COLS, SOIL_MAX = 9;

  var ROUNDS = [
    { year: 1926, title: "Wet years", blurb: "Rain is good and wheat prices are high. Every neighbor is plowing.",
      yieldMul: 1.0, moist: 0.15, gusts: 3, strength: 1.0, wind: "W" },
    { year: 1932, title: "The drought", blurb: "The rain stops. Dry soil, steady wind from the west.",
      yieldMul: 0.5, moist: 1.0, gusts: 4, strength: 1.0, wind: "W" },
    { year: 1935, title: "Black Sunday", blurb: "A huge storm is coming, and this time it blows from the NORTH.",
      yieldMul: 0.35, moist: 1.0, gusts: 5, strength: 1.35, wind: "N" }
  ];

  // Economics per round (cash).
  var COST = { W: 0, C: 1, S_plant: 2, Y_plant: 1 };
  var INCOME = { P: 1, Y: 0, W: 3, C: 3, S: 0, T: 0 };
  var LAND_VALUE_PER_SOIL = 0.2;           // end-of-game value of each unit of topsoil kept
  var START_CASH = 30;
  var COVER_DROUGHT = 0.8;

  // How exposed bare ground is (science: grass roots hold soil; cover crops cut loss ~31-100%).
  var EXPOSE = { P: 0, Y: 0.5, W: 1, C: 0.4, S: 0.5, T: 0 };
  // Tiles that trap moving dust (break the "avalanche").
  var TRAPS = { P: 1, Y: 0.5, W: 0, C: 0.4, S: 0.3, T: 1 };

  function fresh() { var s = ""; for (var i = 0; i < N; i++) s += "P" + SOIL_MAX; return s; }
  function decode(str) {
    var t = [];
    for (var i = 0; i < N; i++) t.push({ type: str[i * 2], soil: +str[i * 2 + 1] });
    return t;
  }
  function encode(tiles) { return tiles.map(function (x) { return x.type + Math.max(0, Math.min(9, x.soil)); }).join(""); }

  // Cost for this round to go from canonical board to plan.
  function planCost(board, plan) {
    var a = decode(board), b = decode(plan), c = 0;
    for (var i = 0; i < N; i++) {
      var from = a[i].type, to = b[i].type;
      if (to === "W") c += COST.W;
      if (to === "C") c += COST.C;
      if (to === "S" && from !== "S" && from !== "T") c += COST.S_plant;
      if (to === "Y" && from !== "Y" && from !== "P") c += COST.Y_plant;
    }
    return c;
  }

  // What a player may turn a tile into, given its canonical type.
  function allowed(fromType, toType) {
    if (toType === "P") return fromType === "P";            // native sod can't be "restored" in one year
    if (toType === "Y") return fromType !== "P";
    if (toType === "T") return fromType === "T";            // trees take years to grow
    if (toType === "S") return fromType !== "T";
    return true;                                             // W, C
  }

  // Index helpers along the wind. "lane" runs with the wind; "pos" is how far downwind.
  function laneInfo(wind) {
    if (wind === "W") return { lanes: ROWS, len: COLS, idx: function (lane, pos) { return lane * COLS + pos; } };
    return { lanes: COLS, len: ROWS, idx: function (lane, pos) { return pos * COLS + lane; } }; // N wind: blows down rows
  }

  // Wind multiplier for each tile from tree rows (science: shelter ~10H downwind, 2H upwind; gaps funnel).
  function shelterMap(tiles, wind) {
    var L = laneInfo(wind), m = new Array(N), why = new Array(N);
    function treeAt(lane, pos) {
      if (lane < 0 || lane >= L.lanes || pos < 0 || pos >= L.len) return null;
      var t = tiles[L.idx(lane, pos)].type;
      return t === "T" ? "T" : t === "S" ? "S" : null;
    }
    for (var lane = 0; lane < L.lanes; lane++) {
      for (var pos = 0; pos < L.len; pos++) {
        var i = L.idx(lane, pos), mul = 1, reason = "";
        var t = tiles[i].type;
        if (t === "T" || t === "S") { m[i] = 1; why[i] = ""; continue; }
        // look upwind in this lane
        for (var d = 1; d <= 3; d++) {
          var tr = treeAt(lane, pos - d);
          if (tr === "T") { mul = Math.min(mul, 0.25); reason = "shelter"; break; }
          if (tr === "S" && d === 1) { mul = Math.min(mul, 0.65); reason = "shelter"; break; }
          if (tr) break;
        }
        // just upwind of a mature row: slight shelter (2H-5H)
        if (mul === 1 && treeAt(lane, pos + 1) === "T") { mul = 0.8; reason = "shelter"; }
        // gap funnel: no shelter here, but trees in neighbouring lanes at the same distance upwind
        if (mul === 1) {
          for (var d2 = 1; d2 <= 2; d2++) {
            var left = treeAt(lane - 1, pos - d2), right = treeAt(lane + 1, pos - d2);
            if (left === "T" && right === "T" || (left === "T" && lane === L.lanes - 1) || (right === "T" && lane === 0)) {
              mul = 1.45; reason = "funnel"; break;
            }
          }
        }
        m[i] = mul; why[i] = reason;
      }
    }
    return { mul: m, why: why };
  }

  // Simulate one round's wind for ALL farms (ordered upwind -> downwind).
  // boards: array of plan strings. Returns frames for animation and final soil.
  function simulateWind(plans, roundIdx) {
    var R = ROUNDS[roundIdx], wind = R.wind, L = laneInfo(wind);
    var farms = plans.map(decode);
    var acc = farms.map(function () { var a = []; for (var i = 0; i < N; i++) a.push(0); return a; });
    var shelters = farms.map(function (f) { return shelterMap(f, wind); });
    var startSoil = farms.map(function (f) { return f.map(function (x) { return x.soil; }); });
    var frames = [];            // per gust: array of farm soil arrays
    var spill = farms.map(function () { return 0; });   // dust received from upwind farm
    var stats = farms.map(function () { return { funnel: 0, shelter: 0, avalanche: 0, lostWheat: 0, lostGrass: 0, wheatTiles: 0, grassTiles: 0, sent: 0, got: 0 }; });

    for (var g = 0; g < R.gusts; g++) {
      var carry = [];           // dust leaving each lane of the previous farm (W wind only spills farm-to-farm)
      for (var f = 0; f < farms.length; f++) {
        var tiles = farms[f], sh = shelters[f];
        var outLanes = [];
        for (var lane = 0; lane < L.lanes; lane++) {
          var load = (wind === "W" && f > 0 && carry[lane]) ? carry[lane] : 0;
          if (load > 0) stats[f].got += load;
          for (var pos = 0; pos < L.len; pos++) {
            var i = L.idx(lane, pos), tile = tiles[i];
            var exp = EXPOSE[tile.type];
            if (tile.soil <= 0) exp = Math.max(exp, 0.2);
            var w = sh.mul[i];
            // amount of soil this gust strips: strength * dryness * exposure * shelter * avalanche
            var aval = 1 + 0.35 * Math.min(load, 4);
            var loss = R.strength * R.moist * exp * w * aval * 0.55;
            if (sh.why[i] === "funnel" && exp > 0) stats[f].funnel++;
            if (sh.why[i] === "shelter" && exp > 0) stats[f].shelter++;
            if (aval > 1.6 && exp > 0) stats[f].avalanche++;
            if (tile.soil > 0 && loss > 0) {
              acc[f][i] += loss;
              var whole = Math.floor(acc[f][i]);
              if (whole > 0) { acc[f][i] -= whole; var took = Math.min(whole, tile.soil); tile.soil -= took; load += took * 0.6; }
            }
            // traps catch moving dust
            load = load * (1 - TRAPS[tile.type]);
          }
          outLanes[lane] = load;
          if (load > 0.05) stats[f].sent += load;
        }
        carry = outLanes;
      }
      frames.push(farms.map(function (t) { return t.map(function (x) { return x.soil; }); }));
    }

    // tally soil kept by land use
    for (var f2 = 0; f2 < farms.length; f2++) {
      for (var k = 0; k < N; k++) {
        var ty = farms[f2][k].type, lost = startSoil[f2][k] - farms[f2][k].soil;
        if (ty === "W" || ty === "C") { stats[f2].wheatTiles++; stats[f2].lostWheat += lost; }
        if (ty === "P" || ty === "Y") { stats[f2].grassTiles++; stats[f2].lostGrass += lost; }
      }
    }
    return { frames: frames, after: farms.map(encode), shelters: shelters, stats: stats };
  }

  // Money earned this round from a post-wind board.
  function harvest(after, roundIdx) {
    var R = ROUNDS[roundIdx], tiles = decode(after), cash = 0;
    tiles.forEach(function (t) {
      var inc = INCOME[t.type] * R.yieldMul * (t.type === "P" ? 1 : t.soil / SOIL_MAX);
      if (t.type === "C" && R.moist >= 1) inc *= COVER_DROUGHT;   // cover crops use scarce water in a drought
      cash += inc;
    });
    return Math.round(cash * 10) / 10;
  }

  // Year-end growth: young grass becomes prairie, saplings become tree rows.
  function grow(after) {
    return encode(decode(after).map(function (t) {
      if (t.type === "Y") t.type = "P";
      else if (t.type === "S") t.type = "T";
      return t;
    }));
  }

  function soilTotal(board) { return decode(board).reduce(function (s, t) { return s + t.soil; }, 0); }
  function soilPct(board) { return Math.round(100 * soilTotal(board) / (N * SOIL_MAX)); }
  function landValue(board) { return Math.round(soilTotal(board) * LAND_VALUE_PER_SOIL); }
  // Final score: cash multiplied by the share of topsoil still on the farm.
  function finalScore(money, board) { return Math.round(Math.max(0, money) * soilTotal(board) / (N * SOIL_MAX)); }

  // Resolve a whole round for all players. players: [{board, money}], plans: [string]
  function resolveRound(players, plans, roundIdx) {
    var costs = plans.map(function (p, i) { return planCost(players[i].board, p); });
    var sim = simulateWind(plans, roundIdx);
    var out = players.map(function (pl, i) {
      var income = harvest(sim.after[i], roundIdx);
      return {
        cost: costs[i], income: income,
        money: Math.round((pl.money - costs[i] + income) * 10) / 10,
        after: sim.after[i], next: grow(sim.after[i]), stats: sim.stats[i]
      };
    });
    return { sim: sim, results: out };
  }

  // --- bots, for solo play and empty seats ---
  function botPlan(kind, board, money, roundIdx) {
    var t = decode(board), wind = ROUNDS[roundIdx].wind;
    t.forEach(function (x, i) {
      var r = Math.floor(i / COLS), c = i % COLS;
      if (kind === "boomer") { x.type = x.type === "T" ? "T" : "W"; }
      else if (kind === "rancher") { if (x.type !== "P" && x.type !== "T") x.type = x.type === "Y" ? "Y" : "Y"; }
      else if (kind === "steward") {
        // tree rows ACROSS the wind, wheat between; adds an east-west row once storms start
        if (x.type === "T") return;
        if (c === 0 || c === 4) x.type = "S";
        else if (roundIdx >= 1 && r === 0) x.type = "S";
        else x.type = "W";
      }
    });
    var plan = encode(t);
    // stay within budget: downgrade C->W->keep from the end
    var guard = 0;
    while (planCost(board, plan) > money && guard++ < 200) {
      var tt = decode(plan), changed = false;
      for (var i = N - 1; i >= 0 && !changed; i--) {
        var orig = decode(board)[i].type;
        if (tt[i].type === "C") { tt[i].type = "W"; changed = true; }
        else if (tt[i].type === "S" && orig !== "S" && orig !== "T") { tt[i].type = orig === "W" || orig === "C" ? "Y" : orig; changed = true; }
        else if (tt[i].type === "W") { tt[i].type = orig === "P" ? "P" : "Y"; changed = true; }
      }
      plan = encode(tt);
      if (!changed) break;
    }
    return plan;
  }

  return {
    ROWS: ROWS, COLS: COLS, N: N, SOIL_MAX: SOIL_MAX, ROUNDS: ROUNDS, COST: COST, INCOME: INCOME,
    START_CASH: START_CASH, LAND_VALUE_PER_SOIL: LAND_VALUE_PER_SOIL,
    fresh: fresh, decode: decode, encode: encode, planCost: planCost, allowed: allowed,
    shelterMap: shelterMap, simulateWind: simulateWind, harvest: harvest, grow: grow,
    resolveRound: resolveRound, soilPct: soilPct, finalScore: finalScore, soilTotal: soilTotal, landValue: landValue, botPlan: botPlan
  };
})();
if (typeof module !== "undefined") module.exports = DB;
