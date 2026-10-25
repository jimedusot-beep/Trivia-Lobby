/** One owned wake-up per party. Replacement and cancellation invalidate queued callbacks. */
export class DeadlineScheduler {
  #entries = new Map();
  #closed = false;
  constructor({
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    clock = () => performance.timeOrigin + performance.now(),
  } = {}) {
    Object.assign(this, { setTimer, clearTimer, clock });
  }
  schedule(key, version, deadline, callback) {
    if (this.#closed) return;
    const previous = this.#entries.get(key);
    if (previous?.version === version && previous.deadline === deadline) return;
    this.cancel(key);
    if (deadline === null) return;
    const entry = { version, deadline };
    this.#entries.set(key, entry);
    entry.timer = this.setTimer(
      () => {
        if (this.#entries.get(key) !== entry) return;
        // Delete before invoking: a transition can safely schedule its next phase.
        this.#entries.delete(key);
        callback();
      },
      Math.max(0, Math.ceil(deadline - this.clock())),
    );
  }
  cancel(key) {
    const entry = this.#entries.get(key);
    if (entry) {
      this.#entries.delete(key);
      this.clearTimer(entry.timer);
    }
  }
  close() {
    this.#closed = true;
    for (const key of this.#entries.keys()) this.cancel(key);
  }
  get size() {
    return this.#entries.size;
  }
}
