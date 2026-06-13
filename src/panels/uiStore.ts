/**
 * uiStore.ts — transient HUD *presentation* state (NOT the data store).
 *
 * This store holds ephemeral UI state for the HUD shell: which Data Deck tab is
 * active, which team is focused in the Context Rail, whether a Theater overlay is
 * open, and whether the Ticker Dock sheet is expanded. The data store
 * (src/data/store.ts) is FROZEN — this is a separate, presentation-only store.
 *
 * The contract below is FROZEN: the panels agent builds against these exact
 * names/types. Do not rename or change signatures.
 */
import { create } from 'zustand';

export type DeckTab = 'groups' | 'bracket' | 'odds';
export type TheaterView = 'bracket' | 'groups' | 'odds' | null;

interface HudState {
  tab: DeckTab;            setTab: (t: DeckTab) => void;
  focusTeamId: string | null; setFocusTeam: (id: string | null) => void;
  theater: TheaterView;    setTheater: (v: TheaterView) => void;
  dockOpen: boolean;       setDockOpen: (b: boolean) => void;
}

export const useHud = create<HudState>()((set) => ({
  tab: 'groups',
  setTab: (tab) => set({ tab }),
  focusTeamId: null,
  setFocusTeam: (focusTeamId) => set({ focusTeamId }),
  theater: null,
  setTheater: (theater) => set({ theater }),
  dockOpen: false,
  setDockOpen: (dockOpen) => set({ dockOpen }),
}));
