/**
 * App entry point — load data from ESPN, then initialize router.
 */
(async function () {
  const app = document.getElementById('app');

  if (!CONFIG.ESPN_GROUP_ID) {
    app.innerHTML = `
      <div class="no-games-msg">
        <h2>Setup Required</h2>
        <p style="margin-top:1rem;">Set your ESPN Tournament Challenge group ID in <code>js/config.js</code>:</p>
        <pre style="background:#0a0a0f;color:#2EA854;padding:1rem;border-radius:8px;margin-top:1rem;text-align:left;display:inline-block;">ESPN_GROUP_ID: 'your-group-id-here'</pre>
        <p style="margin-top:1rem;font-size:0.9rem;color:#888;">
          Find it in the URL when viewing your group on ESPN:<br>
          fantasy.espn.com/tournament-challenge-bracket/.../group?id=<strong>THIS_NUMBER</strong>
        </p>
      </div>
    `;
    return;
  }

  try {
    app.innerHTML = '<div class="loading">Loading brackets from ESPN…</div>';
    const state = await Data.loadAllData();
    // Show group name in header if available
    if (state.groupName) {
      document.querySelector('header h1').innerHTML = `<img src="images/logo.png" class="header-logo" alt="Logo"> ${escapeHtml(state.groupName)} <img src="images/logo.png" class="header-logo" alt="Logo">`;
    }
    Router.init();

    // Auto-refresh bracket data every 60 seconds to keep scores current
    setInterval(async () => {
      try {
        await Data.loadAllData();
        // Re-render current view
        const hash = window.location.hash || '#leaderboard';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } catch (e) {
        console.warn('Auto-refresh failed:', e.message);
      }
    }, 60000);
  } catch (err) {
    console.error('Failed to load data:', err);
    app.innerHTML = `
      <div class="no-games-msg">
        <h2>Failed to Load Data</h2>
        <p style="margin-top:1rem;">${escapeHtml(err.message)}</p>
        <p style="margin-top:0.5rem;font-size:0.9rem;color:#888;">
          Make sure the Vercel dev server is running (<code>npx vercel dev</code>) for the ESPN proxy to work.
        </p>
        <button onclick="location.reload()" style="margin-top:1rem;padding:0.5rem 1.5rem;border-radius:6px;border:1px solid #444;background:#1c1c22;color:#e8e8ec;cursor:pointer;">
          Retry
        </button>
      </div>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
