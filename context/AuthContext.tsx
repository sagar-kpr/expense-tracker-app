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

import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";

import * as Google from "expo-auth-session/providers/google";

import { auth, db } from "@/firebase";

type UserData = {
  email: string;

  onboarding: boolean;

  type?: string;

  salary?: number | null;

  salaryDate?: number | null;

  name?: string;

  darkMode?: boolean;
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

  useEffect(() => {
    let unsubUser: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(
      auth,

      async (firebaseUser) => {
        try {
          if (firebaseUser) {
            if (unsubUser) {
              unsubUser();
            }

            setUser(firebaseUser);

            unsubUser = onSnapshot(
              doc(db, "users", firebaseUser.uid),

              (snapshot) => {
                if (snapshot.exists()) {
                  setUserData(snapshot.data() as UserData);

                  setLoading(false);
                } else {
                  setUserData(null);

                  setLoading(false);
                }
              },

              (error) => {
                console.log("Snapshot error:", error);

                setUserData(null);

                setLoading(false);
              },
            );
          } else {
            setUser(null);

            setUserData(null);

            setLoading(false);
          }
        } catch (error) {
          console.log("Auth listener error:", error);

          setLoading(false);
        }
      },
    );

    return () => {
      unsubscribe();

      if (unsubUser) {
        unsubUser();
      }
    };
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

            name: result.user.displayName || "",
            darkMode: false,
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
      darkMode: false,
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
