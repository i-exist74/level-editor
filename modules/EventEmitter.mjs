export default class EventEmitter {
    #listeners = new Map();

    constructor() {}

    on(event, callback) {
        if (!this.#listeners.has(event)) {
            this.#listeners.set(event, []);
        }
        this.#listeners.get(event).push(callback);
    }

    trigger(event, ...args) {
        if (!this.#listeners.has(event)) return;

        let listeners = this.#listeners.get(event);
        for (let i = 0; i < listeners.length; i++) {
            let listener = listeners[i];
            listener(...args);
        }
    }
}
