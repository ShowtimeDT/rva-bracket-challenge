/**
 * Live Scores — shows in-progress games with who picked which team.
 */
const LiveScores = (() => {
  let _refreshTimer = null;

  function render(container) {
    container.innerHTML = `
      <div class="live-header">
        <h2>Live Scores</h2>
        <span class="live-status"><span class="live-pulse"></span>Auto-refreshing every 30s</span>
      </div>
      <div id="live-games-container" class="live-games">
        <div class="loading">Loading scores…</div>
      </div>
    `;

    // Initial load
    refreshScores();

    // Start auto-refresh
    stopRefresh();
    _refreshTimer = setInterval(refreshScores, CONFIG.REFRESH_INTERVAL);
  }

  async function refreshScores() {
    const gamesContainer = document.getElementById('live-games-container');
    if (!gamesContainer) { stopRefresh(); return; }

    try {
      const scoreboard = await Data.fetchScoreboard();
      const events = scoreboard.events || [];

      // Filter to tournament games (group 100 = NCAA tournament)
      const tourneyGames = events.filter(ev => {
        const groups = ev.competitions?.[0]?.groups || [];
        // Accept all games from the scoreboard since we filter by groups=100
        return true;
      });

      if (!tourneyGames.length) {
        gamesContainer.innerHTML = '<div class="no-games-msg">No tournament games scheduled today. Check back on game days!</div>';
        return;
      }

      gamesContainer.innerHTML = tourneyGames.map(ev => renderGameCard(ev)).join('');
    } catch (err) {
      console.error('Failed to fetch scores:', err);
      gamesContainer.innerHTML = `<div class="no-games-msg">Unable to load scores. Will retry automatically.</div>`;
    }
  }

  function renderGameCard(event) {
    const comp = event.competitions?.[0];
    if (!comp) return '';

    const competitors = comp.competitors || [];
    const status = comp.status || {};
    const statusText = status.type?.shortDetail || status.type?.detail || '';
    const isLive = status.type?.state === 'in';
    const isFinal = status.type?.state === 'post';
    const roundName = comp.notes?.[0]?.headline || '';

    // Get team info
    const teams = competitors.map(c => ({
      id: c.id,
      name: c.team?.shortDisplayName || c.team?.displayName || c.team?.name || 'TBD',
      abbrev: c.team?.abbreviation || '',
      seed: c.curatedRank?.current || c.seed || '',
      score: parseInt(c.score, 10) || 0,
      winner: c.winner || false,
      homeAway: c.homeAway,
    }));

    const headerClass = isLive ? 'background: #c62828; color: #fff;' : '';

    let html = `<div class="live-card">
      <div class="live-card-header" style="${headerClass}">
        <span>${roundName}</span>
        <span>${statusText}</span>
      </div>
      <div class="live-matchup">`;

    for (const team of teams) {
      const winClass = team.winner || (teams.length === 2 && team.score > teams.find(t => t !== team).score) ? ' winning' : '';
      html += `
        <div class="live-team-row${winClass}">
          <span>
            ${team.seed ? `<span class="live-seed">${team.seed}</span>` : ''}
            ${escapeHtml(team.name)}
          </span>
          <span class="live-score">${team.score}</span>
        </div>`;
    }

    html += '</div>';

    // Show who picked which team (if bracket data is loaded)
    const state = Data.getState();
    if (state && state.entries.length && teams.length === 2) {
      html += renderPicksForGame(state, teams);
    }

    html += '</div>';
    return html;
  }

  function renderPicksForGame(state, teams) {
    // Match scoreboard teams to bracket picks by abbreviation or name
    const teamAbbrevs = teams.map(t => (t.abbrev || '').toUpperCase());
    const teamNames = teams.map(t => (t.name || '').toUpperCase());

    const pickedTeam0 = [];
    const pickedTeam1 = [];

    for (const entry of state.entries) {
      const picks = entry.pickStatuses || [];
      let pickedT0 = false, pickedT1 = false;

      for (const pick of picks) {
        if (pick.status !== 'pending' && pick.status !== 'correct') continue;
        const pa = (pick.teamAbbrev || '').toUpperCase();
        const pn = (pick.teamName || '').toUpperCase();
        if (pa === teamAbbrevs[0] || pn === teamNames[0]) pickedT0 = true;
        if (pa === teamAbbrevs[1] || pn === teamNames[1]) pickedT1 = true;
      }

      if (pickedT0) pickedTeam0.push(entry.name);
      if (pickedT1) pickedTeam1.push(entry.name);
    }

    if (!pickedTeam0.length && !pickedTeam1.length) return '';

    let html = '<div class="live-picks-section"><h4>Family Picks</h4>';

    if (pickedTeam0.length) {
      html += `<div class="live-pick-group">
        <strong>${escapeHtml(teams[0].abbrev || teams[0].name)}:</strong>
        ${pickedTeam0.map(n => `<span class="pick-pending">${escapeHtml(n)}</span>`).join('')}
      </div>`;
    }
    if (pickedTeam1.length) {
      html += `<div class="live-pick-group">
        <strong>${escapeHtml(teams[1].abbrev || teams[1].name)}:</strong>
        ${pickedTeam1.map(n => `<span class="pick-pending">${escapeHtml(n)}</span>`).join('')}
      </div>`;
    }

    html += '</div>';
    return html;
  }

  function stopRefresh() {
    if (_refreshTimer) {
      clearInterval(_refreshTimer);
      _refreshTimer = null;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { render, stopRefresh };
})();
