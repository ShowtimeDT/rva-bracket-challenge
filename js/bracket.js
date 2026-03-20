/**
 * Bracket View — full bracket visualization for a single entry.
 *
 * Structure per region (left-to-right for left regions, right-to-left for right):
 *   Column 1: R64 matchups — the actual 16-team field (8 games, 2 teams each)
 *   Column 2: R64 winner picks (who they picked to win each R64 game)
 *   Column 3: R32 picks
 *   Column 4: Sweet 16 picks
 *   Column 5: Elite 8 picks
 * Center: Final Four + Championship
 */
const BracketView = (() => {
  function render(container, entryName) {
    const state = Data.getState();
    if (!state || !state.entries.length) {
      container.innerHTML = '<div class="no-games-msg">No bracket data loaded.</div>';
      return;
    }

    const decodedName = decodeURIComponent(entryName || '');
    let entry = state.entries.find(e => e.name === decodedName);
    if (!entry) entry = state.entries[0];

    let html = `
      <div class="bracket-controls">
        <label for="member-select">Bracket for:</label>
        <select id="member-select">
          ${state.entries.map(e =>
            `<option value="${encodeURIComponent(e.name)}" ${e.name === entry.name ? 'selected' : ''}>${esc(e.name)}</option>`
          ).join('')}
        </select>
        <span style="margin-left:auto; font-size:0.9rem; color:#666;">
          Score: <strong>${entry.totalScore}</strong> | Max: <strong>${entry.maxPossible}</strong> |
          Record: <strong>${entry.correctPicks}-${entry.losses}</strong>
        </span>
      </div>
    `;

    // Group R64 matchups by region
    const r64ByRegion = { 1: [], 2: [], 3: [], 4: [] };
    for (const matchup of state.r64Matchups) {
      const rid = matchup.teams[0]?.regionId;
      if (rid) r64ByRegion[rid].push(matchup);
    }

    // Group entry picks by round (0-indexed) and region
    const picksByRoundRegion = {};
    for (let r = 0; r < 6; r++) picksByRoundRegion[r] = { 1: [], 2: [], 3: [], 4: [] };

    for (const pick of entry.pickStatuses) {
      const region = pick.regionId || 0;
      if (picksByRoundRegion[pick.round] && picksByRoundRegion[pick.round][region]) {
        picksByRoundRegion[pick.round][region].push(pick);
      }
    }

    // Region labels
    const regionLabels = {};
    for (const matchup of state.r64Matchups) {
      const rid = matchup.teams[0]?.regionId;
      if (rid && !regionLabels[rid]) {
        regionLabels[rid] = CONFIG.REGIONS[rid - 1] || `Region ${rid}`;
      }
    }

    html += '<div class="bracket-container">';

    // Left side: regions 1, 2
    html += '<div class="bracket-side">';
    html += renderRegion(regionLabels[1] || 'Region 1', r64ByRegion[1], picksByRoundRegion, 1, false, state);
    html += renderRegion(regionLabels[2] || 'Region 2', r64ByRegion[2], picksByRoundRegion, 2, false, state);
    html += '</div>';

    // Center: Final Four + Championship
    html += '<div class="bracket-center">';
    html += '<div class="final-four-label">Final Four</div>';
    const f4Picks = entry.pickStatuses.filter(p => p.round === 4);
    for (const pick of f4Picks) {
      html += renderPickSlot(pick);
    }
    if (!f4Picks.length) html += renderPickSlot(null);

    html += '<div class="final-four-label" style="margin-top:0.5rem;">Champion</div>';
    const champPicks = entry.pickStatuses.filter(p => p.round === 5);
    for (const pick of champPicks) {
      html += renderPickSlot(pick, true);
    }
    if (!champPicks.length) html += renderPickSlot(null, true);
    html += '</div>';

    // Right side: regions 3, 4
    html += '<div class="bracket-side">';
    html += renderRegion(regionLabels[3] || 'Region 3', r64ByRegion[3], picksByRoundRegion, 3, true, state);
    html += renderRegion(regionLabels[4] || 'Region 4', r64ByRegion[4], picksByRoundRegion, 4, true, state);
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;

    document.getElementById('member-select').addEventListener('change', function () {
      window.location.hash = `#bracket/${this.value}`;
    });
  }

  /**
   * Render a full region: R64 field + R64 picks + R32 picks + S16 picks + E8 pick
   */
  function renderRegion(label, r64Matchups, picksByRoundRegion, regionId, isRight, state) {
    const dirClass = isRight ? 'bracket-region right-region' : 'bracket-region';
    const headAlign = isRight ? 'text-align:right;' : '';

    let html = `<div style="margin-bottom:1rem;">
      <h3 style="font-size:clamp(0.7rem, 1vw, 0.95rem); margin-bottom:0.25rem; color:var(--green-dark); ${headAlign}">${esc(label)}</h3>
      <div class="${dirClass}">`;

    // Column 1: R64 field — 8 matchups, each showing both teams
    html += '<div class="bracket-round">';
    for (const matchup of r64Matchups) {
      html += renderR64Matchup(matchup);
    }
    html += '</div>';

    // Columns 2-5: picks for R64 winners (round 0), R32 (round 1), S16 (round 2), E8 (round 3)
    for (let round = 0; round <= 3; round++) {
      const picks = picksByRoundRegion[round][regionId] || [];
      html += '<div class="bracket-round">';
      if (picks.length) {
        for (const pick of picks) {
          html += renderPickSlot(pick);
        }
      } else {
        html += renderPickSlot(null);
      }
      html += '</div>';
    }

    html += '</div></div>';
    return html;
  }

  /**
   * Render an R64 matchup — shows BOTH teams (the actual field, not a prediction).
   * No color coding — this is just the starting bracket.
   */
  function renderR64Matchup(matchup) {
    let html = '<div class="bracket-game">';
    for (const team of matchup.teams) {
      html += `<div class="bracket-team pick-pending">
        <span class="bracket-seed">${team.seed}</span>
        <span class="bracket-team-name">${esc(team.name)}</span>
      </div>`;
    }
    html += '</div>';
    return html;
  }

  /**
   * Render a single pick slot (one team the person predicted to advance).
   */
  function renderPickSlot(pick, wide) {
    const style = wide ? ' style="min-width:160px;"' : '';
    if (!pick) {
      return `<div class="bracket-game"${style}><div class="bracket-team pick-pending"><span class="bracket-team-name">TBD</span></div></div>`;
    }
    const cssClass = `pick-${pick.status}`;
    return `<div class="bracket-game"${style}>
      <div class="bracket-team ${cssClass}">
        <span class="bracket-seed">${pick.seed}</span>
        <span class="bracket-team-name">${esc(pick.teamName)}</span>
      </div>
    </div>`;
  }

  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { render };
})();
