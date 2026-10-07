import { create } from "zustand";

type OnboardingStore = {
  salary: string;

  salaryDate: string;

  showSuccess: boolean;

  setSalary: (salary: string) => void;

  setSalaryDate: (salaryDate: string) => void;

  setShowSuccess: (showSuccess: boolean) => void;

  reset: () => void;
};

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  salary: "",

  salaryDate: "",

  showSuccess: false,

  setSalary: (salary) =>
    set({
      salary,
    }),

  setSalaryDate: (salaryDate) =>
    set({
      salaryDate,
    }),

  setShowSuccess: (showSuccess) =>
    set({
      showSuccess,
    }),

  reset: () =>
    set({
      salary: "",
      salaryDate: "",
      showSuccess: false,
    }),
}));
