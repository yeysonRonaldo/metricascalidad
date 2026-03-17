import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA7kM8-CH8KkjWDCi4ShI8Jltc3fVTjdmg",
  authDomain: "metricas-123.firebaseapp.com",
  projectId: "metricas-123",
  storageBucket: "metricas-123.firebasestorage.app",
  messagingSenderId: "900899195040",
  appId: "1:900899195040:web:8303cb1e9eb7f3a57ae1c5"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
