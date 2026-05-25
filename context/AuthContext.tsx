// import React, { createContext, useContext, useEffect, useState } from "react";

// import * as WebBrowser from "expo-web-browser";

// import * as Google from "expo-auth-session/providers/google";

// import {
//   createUserWithEmailAndPassword,
//   GoogleAuthProvider,
//   onAuthStateChanged,
//   sendPasswordResetEmail,
//   signInWithCredential,
//   signInWithEmailAndPassword,
//   signOut,
//   User,
// } from "firebase/auth";

// import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

// import { auth, db } from "@/firebase";

// WebBrowser.maybeCompleteAuthSession();

// interface UserData {
//   name: string;

//   email: string;

//   type: string;

//   salary: number | null;

//   salaryDate: number | null;

//   onboarding: boolean;

//   createdAt?: any;
// }

// interface AuthContextType {
//   user: User | null;

//   userData: UserData | null;

//   loading: boolean;

//   login: () => Promise<void>;

//   logout: () => Promise<void>;

//   signup: (email: string, password: string) => Promise<void>;

//   loginWithEmail: (email: string, password: string) => Promise<void>;

//   forgotPassword: (email: string) => Promise<void>;

//   refreshUserData: () => Promise<void>;
// }

// const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// export const AuthProvider = ({ children }: any) => {
//   const [user, setUser] = useState<User | null>(null);

//   const [userData, setUserData] = useState<UserData | null>(null);

//   const [loading, setLoading] = useState(true);

//   const [request, response, promptAsync] = Google.useAuthRequest({
//     clientId:
//       "692538487477-18613hcmqg5cbnmm5sab799qrmher6dd.apps.googleusercontent.com",

//     androidClientId:
//       "692538487477-a6f05panmknp1nfvful6mkfjjl7t24u5.apps.googleusercontent.com",
//   });

//   const fetchUserData = async (uid: string) => {
//     const userRef = doc(db, "users", uid);

//     const snap = await getDoc(userRef);

//     if (snap.exists()) {
//       setUserData(snap.data() as UserData);
//     } else {
//       setUserData(null);
//     }
//   };

//   useEffect(() => {
//     const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
//       setUser(firebaseUser);

//       if (firebaseUser) {
//         await fetchUserData(firebaseUser.uid);
//       } else {
//         setUserData(null);
//       }

//       setLoading(false);
//     });

//     return unsubscribe;
//   }, []);

//   useEffect(() => {
//     const handleGoogleAuth = async () => {
//       if (response?.type !== "success") return;

//       try {
//         const { id_token, access_token } = response.params;

//         const credential = GoogleAuthProvider.credential(
//           id_token,
//           access_token,
//         );

//         const userCredential = await signInWithCredential(auth, credential);

//         const firebaseUser = userCredential.user;

//         const userRef = doc(db, "users", firebaseUser.uid);

//         const userSnap = await getDoc(userRef);

//         if (!userSnap.exists()) {
//           await setDoc(userRef, {
//             name: firebaseUser.displayName || "",

//             email: firebaseUser.email || "",

//             type: "",

//             salary: null,

//             salaryDate: null,

//             onboarding: false,

//             createdAt: serverTimestamp(),
//           });
//         }

//         await fetchUserData(firebaseUser.uid);
//       } catch (error) {
//         console.log("Google Login Error:", error);
//       }
//     };

//     handleGoogleAuth();
//   }, [response]);

//   const login = async () => {
//     await promptAsync();
//   };

//   const logout = async () => {
//     await signOut(auth);
//   };

//   const signup = async (email: string, password: string) => {
//     const userCredential = await createUserWithEmailAndPassword(
//       auth,
//       email,
//       password,
//     );

//     const firebaseUser = userCredential.user;

//     setUser(firebaseUser);

//     const userRef = doc(db, "users", firebaseUser.uid);

//     await setDoc(userRef, {
//       name: "",

//       email: firebaseUser.email,

//       type: "",

//       salary: null,

//       salaryDate: null,

//       onboarding: false,

//       createdAt: serverTimestamp(),
//     });

//     const snap = await getDoc(userRef);

//     if (snap.exists()) {
//       setUserData(snap.data() as UserData);
//     }
//   };

//   const loginWithEmail = async (email: string, password: string) => {
//     await signInWithEmailAndPassword(auth, email, password);
//   };

//   const forgotPassword = async (email: string) => {
//     await sendPasswordResetEmail(auth, email);
//   };

//   const refreshUserData = async () => {
//     if (!user) return;

//     await fetchUserData(user.uid);
//   };

//   return (
//     <AuthContext.Provider
//       value={{
//         user,
//         userData,
//         loading,
//         login,
//         logout,
//         signup,
//         loginWithEmail,
//         forgotPassword,
//         refreshUserData,
//       }}
//     >
//       {children}
//     </AuthContext.Provider>
//   );
// };

// export const useAuth = () => useContext(AuthContext);

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";

import { doc, getDoc, setDoc } from "firebase/firestore";

import * as Google from "expo-auth-session/providers/google";

import { auth, db } from "@/firebase";

type UserData = {
  email: string;

  onboarding: boolean;

  type?: string;

  salary?: number | null;

  salaryDate?: number | null;

  name?: string;
};

type AuthContextType = {
  user: User | null;

  userData: UserData | null;

  loading: boolean;

  login: () => Promise<void>;

  signup: (email: string, password: string) => Promise<void>;

  loginWithEmail: (email: string, password: string) => Promise<void>;

  forgotPassword: (email: string) => Promise<void>;

  logout: () => Promise<void>;

  refreshUserData: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  const [userData, setUserData] = useState<UserData | null>(null);

  const [loading, setLoading] = useState(true);

  const [, response, promptAsync] = Google.useAuthRequest({
    androidClientId: "YOUR_ANDROID_CLIENT_ID",

    iosClientId: "YOUR_IOS_CLIENT_ID",

    webClientId: "YOUR_WEB_CLIENT_ID",
  });

  const fetchUserData = async (uid: string) => {
    const docRef = doc(db, "users", uid);

    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      setUserData(null);

      return null;
    }

    const data = snap.data() as UserData;

    setUserData(data);

    return data;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,

      async (firebaseUser) => {
        try {
          if (firebaseUser) {
            setUser(firebaseUser);

            await fetchUserData(firebaseUser.uid);
          } else {
            setUser(null);

            setUserData(null);
          }
        } finally {
          // IMPORTANT
          setLoading(false);
        }
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const signIn = async () => {
      if (response?.type === "success") {
        const { id_token } = response.params;

        const credential = GoogleAuthProvider.credential(id_token);

        const result = await signInWithCredential(auth, credential);

        const docRef = doc(db, "users", result.user.uid);

        const snap = await getDoc(docRef);

        if (!snap.exists()) {
          const newUserData: UserData = {
            email: result.user.email ?? "",

            onboarding: false,

            type: "",

            salary: null,

            salaryDate: null,

            name: "",
          };

          await setDoc(docRef, newUserData);

          setUserData(newUserData);
        } else {
          setUserData(snap.data() as UserData);
        }
      }
    };

    signIn();
  }, [response]);

  const signup = async (email: string, password: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);

    const newUserData: UserData = {
      email,

      onboarding: false,

      type: "",

      salary: null,

      salaryDate: null,

      name: "",
    };

    setUser(result.user);

    await setDoc(doc(db, "users", result.user.uid), newUserData);

    setUserData(newUserData);
  };

  const loginWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const forgotPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const refreshUserData = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setUserData(null);

      return;
    }

    await fetchUserData(currentUser.uid);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        loading,

        login: promptAsync as any,

        signup,

        loginWithEmail,

        forgotPassword,

        logout,

        refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};
