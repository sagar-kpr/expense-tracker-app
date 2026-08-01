// import { createContext, useContext, useState } from "react";

// import { darkTheme, lightTheme } from "@/theme";

// const ThemeContext = createContext<any>(null);

// export const ThemeProvider = ({ children }: any) => {
//   const [dark, setDark] = useState(false);

//   const theme = dark ? darkTheme : lightTheme;

//   return (
//     <ThemeContext.Provider
//       value={{
//         dark,

//         setDark,

//         theme,
//       }}
//     >
//       {children}
//     </ThemeContext.Provider>
//   );
// };

// export const useTheme = () => useContext(ThemeContext);

import { createContext, useContext, useEffect, useState } from "react";

import { darkTheme, lightTheme } from "@/theme";

import { useAuth } from "@/context/AuthContext";

const ThemeContext = createContext<any>(null);

export const ThemeProvider = ({ children }: any) => {
  const { userData } = useAuth();

  const [darkOverride, setDarkOverride] = useState<boolean | null>(null);

  useEffect(() => {
    setDarkOverride(null);
  }, [userData?.email]);

  const dark = darkOverride ?? Boolean(userData?.darkMode);

  const theme = dark ? darkTheme : lightTheme;

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const colorScheme = dark ? "dark" : "only light";
    const themedElements = [
      document.documentElement,
      document.body,
      document.getElementById("root"),
    ];

    themedElements.forEach((element) => {
      element?.style.setProperty("color-scheme", colorScheme, "important");
      element?.style.setProperty(
        "background-color",
        theme.background,
        "important",
      );
    });

    document
      .querySelector('meta[name="color-scheme"]')
      ?.setAttribute("content", colorScheme);
  }, [dark, theme.background]);

  return (
    <ThemeContext.Provider
      value={{
        dark,

        setDark: setDarkOverride,

        theme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
