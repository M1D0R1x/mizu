// Optional world interactions (ring a bell, sit, feed the fish...).
// Components register a point; the InteractionSystem shows a prompt when the
// player is close and facing it, and runs the action on E / click.
export interface Interactable { x: number; y: number; z: number; radius: number; label: string; action: () => void }
export const interactables: Interactable[] = [];
export function addInteractable(i: Interactable) {
  interactables.push(i);
  return () => { const k = interactables.indexOf(i); if (k >= 0) interactables.splice(k, 1); };
}
