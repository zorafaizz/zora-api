export class MailUnavailableError extends Error {}
export class DisabledMail {
  async sendCode() {
    throw new MailUnavailableError("Email transport unavailable");
  }
}
// Explicit development/test inspection only. No route, file or console exposes codes.
export class MemoryMail {
  #messages = [];
  constructor({ environment = process.env.NODE_ENV, maxMessages = 100 } = {}) {
    if (environment === "production")
      throw new Error("Memory mail is forbidden in production");
    this.maxMessages = maxMessages;
  }
  async sendCode(message) {
    this.#messages = this.#messages.filter((m) => m.expiresAt > Date.now());
    if (this.#messages.length >= this.maxMessages) this.#messages.shift();
    this.#messages.push({ ...message });
  }
  takeCode(email) {
    const index = this.#messages.findLastIndex((m) => m.to === email);
    if (index < 0) return undefined;
    return this.#messages.splice(index, 1)[0].code;
  }
  clear() {
    this.#messages = [];
  }
}
