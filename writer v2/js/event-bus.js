// event-bus.js - Central event communication system
class EventBus {
    constructor() {
        this.events = {};
    }

    subscribe(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
        
        // Return unsubscribe function
        return () => {
            this.events[event] = this.events[event].filter(
                eventCallback => eventCallback !== callback
            );
        };
    }

    publish(event, data) {
        if (!this.events[event]) {
            return;
        }
        this.events[event].forEach(callback => {
            callback(data);
        });
    }
}

// Create and export a singleton instance
const eventBus = new EventBus();
export default eventBus;
