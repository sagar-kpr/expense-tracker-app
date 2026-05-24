import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDdFP1deKKY4Qpopkclo9tDfaMIWG0NDBE",
  authDomain: "expense-tracker-15f49.firebaseapp.com",
  projectId: "expense-tracker-15f49",
  storageBucket: "expense-tracker-15f49.firebasestorage.app",
  messagingSenderId: "692538487477",
  appId: "1:692538487477:web:8cf423b5799e1c408c44fc",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);