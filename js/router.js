/**
 * Hash-based router for single-page navigation.
 */
const Router = (() => {
  function init() {
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  }

  function handleRoute() {
    const hash = window.location.hash || '#leaderboard';
    const app = document.getElementById('app');

    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === hash.split('/')[0]);
    });

    // Stop live score refresh when navigating away
    LiveScores.stopRefresh();

    if (hash === '#leaderboard') {
      Leaderboard.render(app);
    } else if (hash === '#table') {
      TableView.render(app);
    } else if (hash.startsWith('#bracket/') || hash === '#bracket') {
      const name = hash.replace('#bracket/', '').replace('#bracket', '');
      BracketView.render(app, name);
    } else if (hash === '#live') {
      LiveScores.render(app);
    } else {
      Leaderboard.render(app);
    }
  }

  return { init };
})();
