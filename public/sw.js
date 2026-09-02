/**
 * Cavero 서비스 워커 — 브라우저 푸시 수신 전용.
 * 앱이 닫혀 있어도 마감 알림을 띄우고, 클릭하면 해당 화면으로 이동한다.
 */
self.addEventListener("push", (event) => {
  let payload = { title: "Cavero", body: "새 알림이 있습니다.", url: "/" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: payload.tag || "cavero",
      data: { url: payload.url || "/" },
      renotify: false,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // 이미 열린 탭이 있으면 그 탭을 쓴다
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

// 구독이 만료돼 브라우저가 새로 발급하면 서버에 다시 등록한다
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription ? event.oldSubscription.options : undefined)
      .then((sub) =>
        fetch("/api/push/resubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(sub),
        }),
      )
      .catch(() => {}),
  );
});
