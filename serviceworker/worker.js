self.addEventListener('push', e => {
    const data = e.data.json()
    self.registration.showNotification(data.title, {
        body: data.body, 
        vibrate: [100, 50, 100]
    })
})

self.addEventListener('notificationclick', e => {
    const notification = e.notification
    clients.openWindow('https://friends-league.herokuapp.com')
    notification.close()
})


