/**
 * Data layer — fetches from ESPN gambit API via proxy, computes pick statuses.
 *
 * ESPN data model:
 * - 63 propositions across 6 rounds (32 + 16 + 8 + 4 + 2 + 1)
 * - Each proposition has possibleOutcomes (the teams that could play)
 * - Propositions with `correctOutcomes` array tell us who won
 * - Each entry has 63 picks with `round` (1-6), `propositionId`, `outcomesPicked`, `result`
 * - `result` on each pick: CORRECT / INCORRECT / UNDECIDED
 */
const Data = (() => {
  let _state = null;

  async function loadAllData() {
    const groupID = CONFIG.ESPN_GROUP_ID;
    if (!groupID) {
      throw new Error('ESPN Group ID not configured. Set CONFIG.ESPN_GROUP_ID in js/config.js');
    }

    const challengeKey = `tournament-challenge-bracket-${CONFIG.YEAR}`;
    const url = `${CONFIG.ESPN_BRACKET_API}?groupID=${encodeURIComponent(groupID)}&challengeKey=${encodeURIComponent(challengeKey)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.error || `ESPN proxy returned ${resp.status}`);
    }

    const { challenge, group } = await resp.json();
    _state = parseEspnData(challenge, group);
    return _state;
  }

  function parseEspnData(challenge, group) {
    // ---- Build outcome map from ALL propositions (all 6 rounds) ----
    const allProps = challenge.allPropositions || challenge.propositions || [];
    const outcomeMap = {}; // outcomeId -> team info

    // Also build propositionMap for looking up matchup names and results
    const propositionMap = {}; // propositionId -> proposition

    for (const prop of allProps) {
      propositionMap[prop.id] = prop;
      for (const outcome of (prop.possibleOutcomes || [])) {
        // Extract mappings into a flat object
        const mappings = {};
        for (const m of (outcome.mappings || [])) {
          mappings[m.type] = m.value;
        }
        outcomeMap[outcome.id] = {
          outcomeId: outcome.id,
          name: outcome.name || outcome.abbrev || 'TBD',
          abbrev: outcome.abbrev || outcome.name || '?',
          description: outcome.description || '',
          seed: outcome.regionSeed || (mappings.SEED ? parseInt(mappings.SEED, 10) : '?'),
          regionId: outcome.regionId || 0,
          regionCompetitorId: outcome.regionCompetitorId || '',
          logo: mappings.IMAGE_PRIMARY || '',
        };
      }
    }

    // ---- Build R64 matchups (round 1 propositions, sorted by displayOrder) ----
    const r64Props = allProps
      .filter(p => p.scoringPeriodId === 1)
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

    const r64Matchups = r64Props.map(prop => {
      const outcomes = (prop.possibleOutcomes || [])
        .sort((a, b) => (a.regionSeed ?? 99) - (b.regionSeed ?? 99));
      const teams = outcomes.map(o => outcomeMap[o.id] || { name: '?', abbrev: '?', seed: '?' });
      return {
        propositionId: prop.id,
        name: prop.name || '',
        displayOrder: prop.displayOrder ?? 0,
        status: prop.status,
        teams,
      };
    });

    // ---- Build map of eliminated teams by abbreviation ----
    // Each round uses DIFFERENT outcome IDs for the same team, so we track by
    // team abbreviation instead. Maps abbrev -> the round (0-indexed) where eliminated.
    const eliminatedTeams = new Map(); // team abbrev -> round eliminated (0-indexed)
    for (const prop of allProps) {
      const correct = prop.correctOutcomes || [];
      if (correct.length > 0) {
        const elimRound = (prop.scoringPeriodId || 1) - 1; // convert to 0-indexed
        for (const outcome of (prop.possibleOutcomes || [])) {
          if (!correct.includes(outcome.id)) {
            const abbrev = outcome.abbrev || '';
            // Only record the earliest round of elimination
            if (abbrev && !eliminatedTeams.has(abbrev)) {
              eliminatedTeams.set(abbrev, elimRound);
            }
          }
        }
      }
    }

    // ---- Parse group entries ----
    const groupEntries = group.entries || [];
    const entries = [];

    for (const entry of groupEntries) {
      const entryName = entry.name || 'Unknown';
      const scoreData = entry.score || {};
      const rawPicks = entry.picks || [];

      // Sort picks by round then by some consistent order
      // Each pick has: propositionId, periodReached, outcomesPicked[{outcomeId, result}]
      // We also get the round from the proposition's scoringPeriodId
      const pickStatuses = [];

      // Group picks by round (ESPN round is 1-indexed, we'll convert to 0-indexed)
      const picksByRound = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

      for (const pick of rawPicks) {
        const prop = propositionMap[pick.propositionId];
        const espnRound = prop ? prop.scoringPeriodId : null;

        // If we can't determine round from proposition, infer from periodReached
        // Actually, each pick's propositionId maps to a specific round's proposition
        if (espnRound && picksByRound[espnRound]) {
          picksByRound[espnRound].push(pick);
        }
      }

      // Process picks round by round
      for (let espnRound = 1; espnRound <= 6; espnRound++) {
        const roundPicks = picksByRound[espnRound];
        const roundIndex = espnRound - 1; // Convert to 0-indexed
        const points = CONFIG.POINTS[roundIndex] || 0;

        // Sort by proposition displayOrder
        roundPicks.sort((a, b) => {
          const propA = propositionMap[a.propositionId];
          const propB = propositionMap[b.propositionId];
          return (propA?.displayOrder ?? 0) - (propB?.displayOrder ?? 0);
        });

        for (const pick of roundPicks) {
          const outcomeId = pick.outcomesPicked?.[0]?.outcomeId;
          const result = pick.outcomesPicked?.[0]?.result;
          const team = outcomeMap[outcomeId] || {};

          let status;
          const teamAbbrev = team.abbrev || '';
          const elimRound = eliminatedTeams.get(teamAbbrev);

          if (result === 'CORRECT') {
            status = 'correct';
          } else if (result === 'INCORRECT') {
            // Check if the team was eliminated in a PRIOR round (never made it here)
            // vs lost IN this round's actual game
            if (elimRound !== undefined && elimRound < roundIndex) {
              status = 'eliminated'; // team was knocked out before this round
            } else {
              status = 'incorrect'; // team played in this round and lost
            }
          } else if (elimRound !== undefined && elimRound < roundIndex) {
            // Team was knocked out in an earlier round, game hasn't been scored yet
            const pickProp = propositionMap[pick.propositionId];
            const gameDecided = pickProp?.correctOutcomes?.length > 0;
            status = gameDecided ? 'eliminated' : 'eliminated-pending';
          } else if (elimRound !== undefined && elimRound === roundIndex) {
            // Team lost in this round — but ESPN hasn't marked the pick yet
            status = 'incorrect';
          } else {
            status = 'pending';
          }

          pickStatuses.push({
            outcomeId,
            teamName: team.name || 'TBD',
            teamAbbrev: team.abbrev || '?',
            seed: team.seed ?? '?',
            logo: team.logo || '',
            regionId: team.regionId || 0,
            status,
            round: roundIndex,
            points,
            propositionId: pick.propositionId,
            periodReached: pick.periodReached || 1,
          });
        }
      }

      // Compute record from pick statuses — 1 win or loss per decided game
      let wins = 0, losses = 0;
      for (const ps of pickStatuses) {
        if (ps.status === 'correct') wins++;
        else if (ps.status === 'incorrect' || ps.status === 'eliminated') losses++;
      }

      entries.push({
        name: entryName,
        pickStatuses,
        totalScore: scoreData.overallScore ?? 0,
        correctPicks: wins,
        losses: losses,
        maxPossible: (scoreData.overallScore ?? 0) + (scoreData.possiblePointsRemaining ?? 0),
        percentile: scoreData.percentile || 0,
        rank: scoreData.rank || scoreData.sortRank || 0,
        eliminated: scoreData.eliminated || false,
        scoreByPeriod: scoreData.scoreByPeriod || {},
      });
    }

    // Sort by score descending, then rank
    entries.sort((a, b) => b.totalScore - a.totalScore || a.rank - b.rank);

    return {
      entries,
      r64Matchups,
      outcomeMap,
      eliminatedTeams,
      propositions: allProps,
      propositionMap,
      groupName: group.groupSettings?.name || '',
    };
  }

  /**
   * Fetch today's scoreboard from ESPN (CORS-friendly, no proxy needed).
   */
  async function fetchScoreboard(dateStr) {
    if (!dateStr) {
      const now = new Date();
      dateStr = now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0');
    }
    const url = `${CONFIG.ESPN_SCOREBOARD_URL}?dates=${dateStr}&groups=100&limit=100`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Scoreboard fetch failed: ${resp.status}`);
    return resp.json();
  }

  function getState() { return _state; }

  return {
    loadAllData,
    fetchScoreboard,
    getState,
  };
})();
