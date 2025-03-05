// event-bus.js
class EventBus {
    constructor() {
        this._listeners = {};
    }

    /**
     * Register an event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this._listeners[event]) {
            this._listeners[event] = [];
        }
        this._listeners[event].push(callback);
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        const listeners = this._listeners[event] || [];
        listeners.forEach(listener => {
            try {
                listener(data);
            } catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        });
    }

    /**
     * Remove a specific listener or all listeners for an event
     * @param {string} event - Event name
     * @param {Function} [callback] - Optional specific callback to remove
     */
    off(event, callback) {
        if (!callback) {
            // Remove all listeners for this event
            delete this._listeners[event];
            return;
        }

        // Remove specific listener
        if (this._listeners[event]) {
            this._listeners[event] = this._listeners[event].filter(
                listener => listener !== callback
            );
        }
    }
}

export default EventBus;
