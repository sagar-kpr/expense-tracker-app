import { create } from "zustand";

type OnboardingStore = {
  salary: string;

  salaryDate: string;

  setSalary: (salary: string) => void;

  setSalaryDate: (salaryDate: string) => void;

  reset: () => void;
};

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  salary: "",

  salaryDate: "",

  setSalary: (salary) =>
    set({
      salary,
    }),

  setSalaryDate: (salaryDate) =>
    set({
      salaryDate,
    }),

  reset: () =>
    set({
      salary: "",
      salaryDate: "",
    }),
}));
