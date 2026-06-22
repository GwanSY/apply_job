import { createPanelState } from "./state.js";
import { createPanelController } from "./controller.js";
import { bindPanelEvents } from "./events.js";

export async function initPanelApp() {
  const state = createPanelState();
  const controller = createPanelController(state);
  bindPanelEvents(state, controller);
  await controller.bootstrap();
}
