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

import * as Google from "expo-auth-session/providers/google";

import { auth } from "@/firebase";
import {
  ensureLocalProfile,
  ensureRemoteAccountRecord,
  saveProfile,
  subscribeLocalProfile,
  type UserProfile,
} from "@/repositories/profileRepository";
import { useAmountVisibilityStore } from "@/store/useAmountVisibilityStore";

type AuthContextType = {
  user: User | null;
  userData: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const createProfile = (email: string, name = ""): UserProfile => ({
  email,
  onboarding: false,
  type: "",
  salary: null,
  salaryDate: null,
  name,
  businessName: "",
  darkMode: false,
  syncMode: "local_only",
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const resetAmountVisibility = useAmountVisibilityStore((state) => state.reset);

  const [, response, promptAsync] = Google.useAuthRequest({
    androidClientId: "YOUR_ANDROID_CLIENT_ID",
    iosClientId: "YOUR_IOS_CLIENT_ID",
    webClientId: "YOUR_WEB_CLIENT_ID",
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          resetAmountVisibility();
          setUser(null);
          setUserData(null);
          setLoading(false);
          return;
        }

        let localProfile = await ensureLocalProfile({
          userId: firebaseUser.uid,
          email: firebaseUser.email ?? "",
          name: firebaseUser.displayName ?? "",
        });

        await ensureRemoteAccountRecord(firebaseUser.uid, {
          email: firebaseUser.email ?? "",
          displayName: firebaseUser.displayName ?? "",
          syncMode: localProfile.syncMode ?? "local_only",
        }, localProfile);

        setUser(firebaseUser);
        setUserData(localProfile);

        setLoading(false);
      } catch (error) {
        console.log("Auth listener error:", error);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [resetAmountVisibility]);

  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    const subscription = subscribeLocalProfile(
      user.uid,
      (profile) => {
        setUserData(profile);
      },
      (error) => {
        console.log("Profile listener error:", error);
      },
    );

    return () => {
      subscription.remove?.();
    };
  }, [user?.uid]);

  useEffect(() => {
    const signIn = async () => {
      if (response?.type !== "success") {
        return;
      }

      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      const result = await signInWithCredential(auth, credential);
      let profile = await ensureLocalProfile({
        userId: result.user.uid,
        email: result.user.email ?? "",
        name: result.user.displayName ?? "",
      });

      await ensureRemoteAccountRecord(result.user.uid, {
        email: result.user.email ?? "",
        displayName: result.user.displayName ?? "",
        syncMode: profile.syncMode ?? "local_only",
      }, profile);

      setUser(result.user);
      setUserData(profile);

    };

    signIn().catch((error) => console.log("Google sign-in error:", error));
  }, [response]);

  const signup = async (email: string, password: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const profile = createProfile(email, "");

    await saveProfile(result.user.uid, profile);
    setUser(result.user);
    setUserData(profile);
  };

  const loginWithEmail = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    let profile = await ensureLocalProfile({
      userId: result.user.uid,
      email: result.user.email ?? email,
      name: result.user.displayName ?? "",
    });

    await ensureRemoteAccountRecord(result.user.uid, {
      email: result.user.email ?? email,
      displayName: result.user.displayName ?? "",
      syncMode: profile.syncMode ?? "local_only",
    }, profile);

    setUser(result.user);
    setUserData(profile);
  };

  const forgotPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await signOut(auth);
    resetAmountVisibility();
    setUser(null);
    setUserData(null);
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
