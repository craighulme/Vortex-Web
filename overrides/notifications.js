(function () {
  const notifContainer = document.getElementById('notif-container');
  function removeNotificationElement(el) {
    el.classList.add('notif-out');
    setTimeout(() => el.remove(), 280);
  }
  const activeFriendRequestNotifs = new Map();
  function friendRequest(userId, username) {
    if (activeFriendRequestNotifs.has(userId)) {
      return;
    }
    const notifEl = document.createElement('div');
    notifEl.className = 'notif';
    notifEl.innerHTML = `
    <div class="notif-avatar">${username[0].toUpperCase().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    <div class="notif-body">
    <div class="notif-title">${username.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    <div class="notif-sub">wants to be your friend</div>
    <div class="notif-actions">
    <button class="notif-btn notif-accept">Accept</button>
    <button class="notif-btn notif-decline">Decline</button>
    </div>
    </div>
    `;
    activeFriendRequestNotifs.set(userId, notifEl);
    const acceptBtn = notifEl.querySelector('.notif-accept');
    const declineBtn = notifEl.querySelector('.notif-decline');
    function setPending() {
      acceptBtn.disabled = true;
      declineBtn.disabled = true;
      acceptBtn.textContent = '...';
    }
    acceptBtn.addEventListener('click', async () => {
      setPending();
      const res = await fetch('/api/friends/requests/incoming');
      const list = await res.json().catch(() => []);
      const request = list.find(entry => entry.from_user_id === userId);
      if (request) {
        const acceptRes = await fetch('/api/friends/accept/' + request.id, {
          'method': 'POST'
        });
        if (acceptRes.ok) {
          activeFriendRequestNotifs.delete(userId);
          removeNotificationElement(notifEl);
          friendAccepted(username);
          window._mpSetFriendStatus?.(userId, 'friends');
          return;
        }
      }
      acceptBtn.disabled = false;
      declineBtn.disabled = false;
      acceptBtn.textContent = 'Accept';
    });
    declineBtn.addEventListener('click', async () => {
      declineBtn.disabled = true;
      acceptBtn.disabled = true;
      activeFriendRequestNotifs.delete(userId);
      removeNotificationElement(notifEl);
      const res = await fetch('/api/friends/requests/incoming').catch(() => null);
      if (!res?.['ok']) {
        return;
      }
      const list = await res.json().catch(() => []);
      const request = list.find(entry => entry.from_user_id === userId);
      if (request) {
        fetch('/api/friends/reject/' + request.id, {
          'method': 'POST'
        }).catch(() => {});
      }
    });
    notifContainer.appendChild(notifEl);
  }
  function friendRequestCancelled(userId) {
    const el = activeFriendRequestNotifs.get(userId);
    if (el) {
      activeFriendRequestNotifs.delete(userId);
      removeNotificationElement(el);
    }
  }
  function friendAccepted(username) {
    const notifEl = document.createElement('div');
    notifEl.className = 'notif notif-success';
    notifEl.innerHTML = `
    <div class="notif-avatar notif-avatar-success">✓</div>
    <div class="notif-body">
    <div class="notif-title">You\'re friends!</div>
    <div class="notif-sub">You and ${username.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')} are now friends.</div>
    </div>
    `;
    notifContainer.appendChild(notifEl);
    setTimeout(() => removeNotificationElement(notifEl), 6000);
  }
  function notif(message) {
    const notifEl = document.createElement('div');
    notifEl.className = 'notif notif-success';
    notifEl.innerHTML = `
    <div class="notif-body">
    <div class="notif-title">${message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </div>
    `;
    notifContainer.appendChild(notifEl);
    setTimeout(() => removeNotificationElement(notifEl), 5000);
  }
  window.Notifications = {
    friendRequest,
    friendRequestCancelled,
    friendAccepted,
    followed: plrName => notif(plrName + ' followed you'),
    unfollowed: plrName => notif(plrName + ' unfollowed you')
  };
})();