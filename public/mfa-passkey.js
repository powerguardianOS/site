// PASSKEYS-1: the passkey button on the server-rendered two-step page (/login/mfa). Loaded with script-src 'self'.
// verify: #mfa-passkey → POST ?passkey=options → navigator.credentials.get → POST ?passkey=verify → next page.
// setup:  #mfa-passkey-setup → ?passkey=register-options → navigator.credentials.create → ?passkey=register → the
//         recovery codes (shown once, built with textContent) → Continue.
(function () {
  'use strict';
  var box = document.getElementById('pk-box');
  if (!box) return;
  var supported = typeof window.PublicKeyCredential === 'function' && navigator.credentials && navigator.credentials.get;
  if (!supported) { var u = document.getElementById('pk-unsupported'); if (u) u.hidden = false; return; }
  box.hidden = false;
  var or = document.getElementById('pk-or'); if (or) or.hidden = false;
  var errEl = document.getElementById('pk-error');
  var mode = box.getAttribute('data-pk');

  function unb64u(s) {
    var t = s.replace(/-/g, '+').replace(/_/g, '/'); t += '===='.slice(0, (4 - (t.length % 4)) % 4);
    var bin = atob(t), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  function b64u(buf) {
    if (!buf) return null;
    var u = new Uint8Array(buf), s = '';
    for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function list(a) { return (a || []).map(function (c) { return { type: 'public-key', id: unb64u(c.id) }; }); }
  function device() {
    var ua = navigator.userAgent;
    var d = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
    var b = /Edg\//.test(ua) ? 'Edge' : /Firefox\/|FxiOS/.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
    return d && b ? d + ' · ' + b : d || b || 'This device';
  }
  function say(msg) { errEl.textContent = msg; errEl.hidden = !msg; }
  function post(action, body) {
    return fetch('/login/mfa?passkey=' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}), credentials: 'same-origin' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { d.status = r.status; return d; }); });
  }
  function failed(d) {
    if (d.next) { location.assign(d.next); return; }
    if (d.error === 'exists') say('This passkey is already on your account.');
    else say('That passkey did not work.' + (d.left ? ' ' + d.left + (d.left === 1 ? ' try' : ' tries') + ' left.' : ' Try again.'));
  }
  function showCodes(codes, next) {
    var main = document.querySelector('main');
    var h1 = main.querySelector('h1');
    while (h1.nextSibling) main.removeChild(h1.nextSibling);
    h1.textContent = 'Save your recovery codes';
    var p = document.createElement('p');
    p.textContent = 'Your passkey is added and two-step sign-in is on. If you lose your passkey, each of these codes lets you sign in once. Keep them somewhere safe, like a password manager. They are shown only now.';
    main.appendChild(p);
    var card = document.createElement('div'); card.className = 'card';
    var ol = document.createElement('ol'); ol.id = 'mfa-codes';
    ol.setAttribute('style', 'margin:0;padding-left:28px;font-family:ui-monospace,Menlo,monospace;font-size:16px;line-height:1.9;color:#fafafa;-webkit-user-select:all;user-select:all');
    codes.forEach(function (c) { var li = document.createElement('li'); li.textContent = c; ol.appendChild(li); });
    card.appendChild(ol); main.appendChild(card);
    var c2 = document.createElement('div'); c2.className = 'card';
    var a = document.createElement('a'); a.className = 'btn'; a.id = 'mfa-continue'; a.href = next; a.textContent = 'I saved my recovery codes';
    c2.appendChild(a); main.appendChild(c2);
  }

  var busy = false;
  function run(btn) {
    if (busy) return; busy = true; say(''); btn.disabled = true;
    var label = btn.textContent; btn.textContent = 'Waiting for your passkey…';
    var done = function () { busy = false; btn.disabled = false; btn.textContent = label; };
    if (mode === 'verify') {
      post('options').then(function (o) {
        if (!o.ok) { failed(o); return done(); }
        var pk = o.publicKey; pk.challenge = unb64u(pk.challenge); pk.allowCredentials = list(pk.allowCredentials);
        return navigator.credentials.get({ publicKey: pk }).then(function (c) {
          var r = c.response;
          return post('verify', { credential: { id: c.id, rawId: b64u(c.rawId), type: c.type, response: {
            clientDataJSON: b64u(r.clientDataJSON), authenticatorData: b64u(r.authenticatorData), signature: b64u(r.signature), userHandle: b64u(r.userHandle) } } });
        }).then(function (d) { if (d.ok && d.next) location.assign(d.next); else { failed(d); done(); } });
      }).catch(function (e) { if (!e || e.name !== 'NotAllowedError') say('That passkey did not work. Try again.'); done(); });
    } else {
      post('register-options').then(function (o) {
        if (!o.ok) { failed(o); return done(); }
        var pk = o.publicKey; pk.challenge = unb64u(pk.challenge); pk.user.id = unb64u(pk.user.id); pk.excludeCredentials = list(pk.excludeCredentials);
        return navigator.credentials.create({ publicKey: pk }).then(function (c) {
          var r = c.response;
          return post('register', { device: device(), credential: { id: c.id, rawId: b64u(c.rawId), type: c.type, response: {
            clientDataJSON: b64u(r.clientDataJSON), attestationObject: b64u(r.attestationObject) } } });
        }).then(function (d) {
          if (d.ok && d.next) { if (d.recovery_codes && d.recovery_codes.length) showCodes(d.recovery_codes, d.next); else location.assign(d.next); }
          else { failed(d); done(); }
        });
      }).catch(function (e) { if (!e || e.name !== 'NotAllowedError') say('The passkey could not be added. Try again, or use an authenticator app below.'); done(); });
    }
  }
  var btn = document.getElementById(mode === 'verify' ? 'mfa-passkey' : 'mfa-passkey-setup');
  if (btn) btn.addEventListener('click', function () { run(btn); });
})();
