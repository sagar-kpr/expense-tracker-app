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

  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (userData) {
      setDark(userData.darkMode || false);
    }
  }, [userData]);

  const theme = dark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider
      value={{
        dark,

        setDark,

        theme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
