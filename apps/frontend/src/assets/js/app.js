// Render central
window.appRender = async function () {
  const app = $("#app");
  if (!app) return;

  // Decide view
  if (!state.currentUser) {
    app.innerHTML = views.login.render();
    lucide.createIcons();
    views.login.bind();
    return;
  }

  app.innerHTML = await views.dashboard.render();
  lucide.createIcons();
  views.dashboard.bind();
};

// Boot
(function init() {
  session.load();
  window.appRender();
})();

