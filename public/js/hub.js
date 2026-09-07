(function () {
  'use strict';

  var guestEl = document.getElementById('wb-guest');
  var loggedEl = document.getElementById('wb-logged');
  var listEl = document.getElementById('wb-sites-list');
  var loadingEl = document.getElementById('wb-loading');
  var planEl = document.getElementById('wb-plan-label');
  var websites = [];
  var loggedIn = false;

  var menuToggle = document.getElementById('menuToggle');
  var navLinks = document.getElementById('navLinks');
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', function () {
      navLinks.classList.toggle('open');
    });
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function show(el, vis) { if (el) el.hidden = !vis; }
  function statusLabel(status) {
    if (status === 'published') return 'Pubblicato';
    if (status === 'unpublished') return 'Ritirato';
    return 'Bozza';
  }
  function editorUrl(id) {
    return id ? '/builder/' + encodeURIComponent(id) : '/builder';
  }
  function firstId() {
    return websites[0] && websites[0].id ? websites[0].id : null;
  }

  document.querySelectorAll('[data-wb-action]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      var action = el.getAttribute('data-wb-action');
      if (!loggedIn) {
        e.preventDefault();
        location.href = '/login?redirect=' + encodeURIComponent('/website');
        return;
      }
      if (action === 'create') {
        e.preventDefault();
        createWebsite();
        return;
      }
      var id = firstId();
      if (action === 'sites' || action === 'templates') el.href = '/builder';
      else el.href = editorUrl(id);
    });
  });

  function createWebsite() {
    fetch('/api/website-builder/websites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Il mio sito' })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (resp) {
        if (resp.ok && resp.j.website && resp.j.website.id) {
          location.href = editorUrl(resp.j.website.id);
          return;
        }
        alert((resp.j && resp.j.error) || 'Impossibile creare il sito');
      })
      .catch(function () { alert('Errore di connessione'); });
  }

  function renderSites(entitlements) {
    if (loadingEl) loadingEl.hidden = true;
    if (planEl) {
      planEl.textContent = entitlements && entitlements.commercialName
        ? 'Piano ' + entitlements.commercialName
        : 'Piano standalone BUSINESS';
    }
    if (!listEl) return;
    if (!websites.length) {
      listEl.innerHTML = '<p class="muted">Nessun sito ancora. <button type="button" class="btn btn-primary" id="wb-create-btn">Crea sito</button></p>';
      var btn = document.getElementById('wb-create-btn');
      if (btn) btn.addEventListener('click', createWebsite);
      return;
    }
    listEl.innerHTML = websites.map(function (w) {
      return '<div class="site-row"><strong>' + escapeHtml(w.name) +
        '</strong><span class="muted">' + escapeHtml(statusLabel(w.status)) +
        '</span><a class="btn btn-primary" href="' + editorUrl(w.id) + '">Apri editor</a></div>';
    }).join('');
  }

  fetch('/api/auth/me', { credentials: 'include' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      loggedIn = !!(data && data.user);
      var navLogin = document.getElementById('navLogin');
      if (loggedIn) {
        if (navLogin) { navLogin.href = '/api/auth/logout'; navLogin.textContent = 'Esci'; }
        show(guestEl, false);
        show(loggedEl, true);
        return fetch('/api/website-builder/websites', { credentials: 'include', headers: { Accept: 'application/json' } })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (list) {
            websites = (list && list.websites) || [];
            return fetch('/api/website-builder/entitlements', { credentials: 'include', headers: { Accept: 'application/json' } })
              .then(function (r) { return r.ok ? r.json() : null; });
          })
          .then(renderSites);
      }
      show(guestEl, true);
      show(loggedEl, false);
      return fetch('/api/public-config').then(function (r) { return r.ok ? r.json() : null; }).then(function (cfg) {
        var gsBtn = document.getElementById('wb-gs-btn');
        if (gsBtn && cfg && cfg.gsLoginUrl) {
          gsBtn.hidden = false;
          gsBtn.href = cfg.gsLoginUrl;
        }
      });
    })
    .catch(function () { show(guestEl, true); });
})();
