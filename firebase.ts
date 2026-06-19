import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { getApp, getApps, initializeApp } from "firebase/app";

import * as FirebaseAuth from "firebase/auth";

import {
  Auth,
  browserLocalPersistence,
  getAuth,
  initializeAuth,
  Persistence,
} from "firebase/auth";

import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDdFP1deKKY4Qpopkclo9tDfaMIWG0NDBE",

  authDomain: "expense-tracker-15f49.firebaseapp.com",

  projectId: "expense-tracker-15f49",

  storageBucket: "expense-tracker-15f49.firebasestorage.app",

  messagingSenderId: "692538487477",

  appId: "1:692538487477:web:8cf423b5799e1c408c44fc",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let authInstance: Auth;

const { getReactNativePersistence } = FirebaseAuth as typeof FirebaseAuth & {
  getReactNativePersistence: (
    storage: typeof AsyncStorage,
  ) => Persistence;
};

try {
  authInstance = initializeAuth(app, {
    persistence:
      Platform.OS === "web"
        ? browserLocalPersistence
        : getReactNativePersistence(AsyncStorage),
  });
} catch {
  authInstance = getAuth(app);
}

export const auth = authInstance;

export const db = getFirestore(app);
