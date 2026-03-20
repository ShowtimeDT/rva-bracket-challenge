/**
 * Leaderboard view — standings table with scores and clickable names.
 */
const Leaderboard = (() => {
  function render(container) {
    const state = Data.getState();
    if (!state || !state.entries.length) {
      container.innerHTML = '<div class="no-games-msg">No bracket data loaded.</div>';
      return;
    }

    const badgeClasses = ['rank-badge--gold', 'rank-badge--silver', 'rank-badge--bronze'];

    let html = `
      <div class="leaderboard-card">
        <div class="leaderboard-card-header">
          <h2>Tournament Leaderboard</h2>
          <p>Top Picks (Updated Live)</p>
        </div>
        <table class="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Entry</th>
              <th>Score</th>
              <th>Max Possible</th>
              <th>Record</th>
            </tr>
          </thead>
          <tbody>
    `;

    state.entries.forEach((entry, i) => {
      const rank = i + 1;
      const rankClass = rank <= 3 ? ` class="rank-${rank}"` : '';
      const badge = rank <= 3 ? `<span class="rank-badge ${badgeClasses[i]}">${rank}</span>` : '';
      const nameEncoded = encodeURIComponent(entry.name);

      html += `
        <tr${rankClass}>
          <td>${badge}${rank}</td>
          <td><a href="#bracket/${nameEncoded}" class="name-link">${escapeHtml(entry.name)}</a></td>
          <td class="col-score">${entry.totalScore}</td>
          <td>${entry.maxPossible}</td>
          <td class="col-record">${entry.correctPicks}-${entry.losses}</td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';

    const now = new Date();
    const timeStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      + ', ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    html += `<div class="last-updated">Last Updated: ${timeStr}</div>`;

    container.innerHTML = html;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { render };
})();
