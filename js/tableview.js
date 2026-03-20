/**
 * Table View — round-by-round pick grid showing who picked what.
 * Every cell shows the person's prediction. Only column headers show "TBD"
 * if a matchup hasn't been determined yet.
 */
const TableView = (() => {
  function render(container) {
    const state = Data.getState();
    if (!state || !state.entries.length) {
      container.innerHTML = '<div class="no-games-msg">No bracket data loaded.</div>';
      return;
    }

    const options = buildRoundOptions();

    let html = `
      <div class="table-controls">
        <label for="round-select">Round:</label>
        <select id="round-select">
          ${options.map((o, i) => `<option value="${i}">${o.label}</option>`).join('')}
        </select>
      </div>
      <div class="picks-table-wrap">
        <div id="picks-table-container"></div>
      </div>
    `;

    container.innerHTML = html;

    const select = document.getElementById('round-select');
    select.addEventListener('change', () => renderTable(options[select.value]));
    renderTable(options[0]);
  }

  function buildRoundOptions() {
    return [
      { label: 'Round of 64', round: 0 },
      { label: 'Round of 32', round: 1 },
      { label: 'Sweet 16', round: 2 },
      { label: 'Elite 8', round: 3 },
      { label: 'Final Four', round: 4 },
      { label: 'Championship', round: 5 },
    ];
  }

  function renderTable(option) {
    const state = Data.getState();
    const tableContainer = document.getElementById('picks-table-container');
    const roundIndex = option.round;

    if (roundIndex === 0) {
      renderR64Table(state, tableContainer);
    } else {
      renderRoundTable(state, tableContainer, roundIndex);
    }
  }

  /**
   * Render R64 table — headers from the 32 proposition matchup names.
   */
  function renderR64Table(state, container) {
    const matchups = state.r64Matchups;
    if (!matchups.length) {
      container.innerHTML = '<p class="no-games-msg">No matchups found.</p>';
      return;
    }

    // Column headers = actual matchup names from propositions
    const headers = matchups.map(m => {
      if (m.teams.length === 2) {
        return `(${m.teams[0].seed}) ${m.teams[0].abbrev}<br>vs<br>(${m.teams[1].seed}) ${m.teams[1].abbrev}`;
      }
      return m.name || 'TBD';
    });

    // Proposition IDs for each column
    const propIds = matchups.map(m => m.propositionId);

    let html = '<table class="picks-table"><thead><tr><th>Name</th>';
    headers.forEach(h => {
      html += `<th class="game-header">${h}</th>`;
    });
    html += '</tr></thead><tbody>';

    for (const entry of state.entries) {
      html += `<tr><td><div class="name-cell">${esc(entry.name)}</div></td>`;

      // Index this entry's R64 picks by propositionId
      const pickByProp = {};
      for (const pick of entry.pickStatuses) {
        if (pick.round === 0) {
          pickByProp[pick.propositionId] = pick;
        }
      }

      for (const propId of propIds) {
        const pick = pickByProp[propId];
        if (!pick) {
          html += '<td>—</td>';
          continue;
        }
        html += pickCell(pick);
      }

      html += '</tr>';
    }

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  /**
   * Render later-round table (R32 through Championship).
   * Every cell shows what the person predicted. Column headers show the actual
   * matchup if known, or the game slot otherwise.
   */
  function renderRoundTable(state, container, roundIndex) {
    // Get proposition IDs for this round from the first entry
    const firstEntry = state.entries[0];
    const roundPicks = firstEntry.pickStatuses.filter(p => p.round === roundIndex);

    if (!roundPicks.length) {
      container.innerHTML = '<p class="no-games-msg">No picks for this round.</p>';
      return;
    }

    const propIds = roundPicks.map(p => p.propositionId);

    // Build column headers — use the proposition name if it has real team names,
    // otherwise show "Game N"
    const headers = propIds.map((propId, col) => {
      const prop = state.propositionMap[propId];
      if (prop && prop.name && !prop.name.startsWith('Round ')) {
        // Real matchup name like "TCU @ DUKE"
        return prop.name.replace(' @ ', '<br>vs<br>');
      }
      // Fallback: show "Game N" — the actual matchup may not be set yet
      return `Game ${col + 1}`;
    });

    let html = '<table class="picks-table"><thead><tr><th>Name</th>';
    headers.forEach(h => {
      html += `<th class="game-header">${h}</th>`;
    });
    html += '</tr></thead><tbody>';

    for (const entry of state.entries) {
      html += `<tr><td><div class="name-cell">${esc(entry.name)}</div></td>`;

      const pickByProp = {};
      for (const pick of entry.pickStatuses) {
        if (pick.round === roundIndex) {
          pickByProp[pick.propositionId] = pick;
        }
      }

      for (const propId of propIds) {
        const pick = pickByProp[propId];
        if (!pick) {
          html += '<td>—</td>';
          continue;
        }
        html += pickCell(pick);
      }

      html += '</tr>';
    }

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  /**
   * Render a single pick cell with status coloring.
   */
  function pickCell(pick) {
    const cssClass = `pick-${pick.status}`;
    const display = `(${pick.seed}) ${pick.teamAbbrev}`;
    return `<td class="${cssClass}">${esc(display)}</td>`;
  }

  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { render };
})();
