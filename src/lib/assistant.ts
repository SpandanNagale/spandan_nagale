// Lets any button on the page open the assistant panel owned by AssistantDock,
// the same panel Cmd/Ctrl-K toggles.
export const OPEN_ASSISTANT_EVENT = 'assistant:open';

export function openAssistant() {
  window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT));
}
