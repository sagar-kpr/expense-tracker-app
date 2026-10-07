import { create } from "zustand";

type AmountVisibilityStore = {
  hidden: boolean;
  reset: () => void;
  toggle: () => void;
};

export const useAmountVisibilityStore = create<AmountVisibilityStore>((set) => ({
  hidden: true,
  reset: () =>
    set({
      hidden: true,
    }),
  toggle: () =>
    set((state) => ({
      hidden: !state.hidden,
    })),
}));
