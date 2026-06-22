import { bindContentEvents } from "./events.js";
import { bindRuntimeMessages } from "./messages.js";

export function initContentApp() {
  bindContentEvents();
  bindRuntimeMessages();
}
