// import { create } from "zustand";

// import { persist } from "zustand/middleware";

// import AsyncStorage from "@react-native-async-storage/async-storage";

// interface OnboardingState {
//   salary: string;

//   salaryDate: string;

//   onboardingCompleted: boolean;

//   setSalary: (value: string) => void;

//   setSalaryDate: (value: string) => void;

//   completeOnboarding: () => void;
// }

// export const useOnboardingStore = create<OnboardingState>()(
//   persist(
//     (set) => ({
//       salary: "",

//       salaryDate: "",

//       onboardingCompleted: false,

//       setSalary: (value) =>
//         set({
//           salary: value,
//         }),

//       setSalaryDate: (value) =>
//         set({
//           salaryDate: value,
//         }),

//       completeOnboarding: () =>
//         set({
//           onboardingCompleted: true,
//         }),
//     }),
//     {
//       name: "onboarding-storage",

//       storage: {
//         getItem: async (name) => {
//           const value = await AsyncStorage.getItem(name);

//           return value ? JSON.parse(value) : null;
//         },

//         setItem: async (name, value) => {
//           await AsyncStorage.setItem(name, JSON.stringify(value));
//         },

//         removeItem: async (name) => {
//           await AsyncStorage.removeItem(name);
//         },
//       },
//     },
//   ),
// );

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
