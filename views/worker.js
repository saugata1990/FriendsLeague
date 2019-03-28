self.addEventListener('push', e => {
    const data = e.data.json()
    self.registration.showNotification(data.title, {
        body: 'This is a notification'
    })
})