
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  updateProfile,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { AppState, TeamSettings, Player } from '../types';

const firebaseConfig = {
  apiKey: "AIzaSyAB6uZxIc9c_ao9J2gTK6dLxWLmPtp_IOI",
  authDomain: "padel-stats-des.firebaseapp.com",
  projectId: "padel-stats-des",
  storageBucket: "padel-stats-des.firebasestorage.app",
  messagingSenderId: "525423144336",
  appId: "1:525423144336:web:acbca15b8d36928aad5715",
  measurementId: "G-78L3200GZ5"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// --- Auth Services ---

export const registerUser = async (email: string, password: string, name: string, surname: string) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const fullName = `${name} ${surname}`;
  await updateProfile(userCredential.user, { displayName: fullName });
  // Create a user document reference to store teamId later
  await setDoc(doc(db, 'users', userCredential.user.uid), {
    name,
    surname,
    email,
    teamId: null
  });
  return userCredential.user;
};

export const loginUser = async (email: string, password: string) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

export const logoutUser = async () => {
  await firebaseSignOut(auth);
};

// --- Data Services ---

export const createTeam = async (user: User, teamName: string, initialSettings: TeamSettings) => {
  const teamId = user.uid; // Using UID as TeamID ensures 1:1 relationship
  
  const newTeamData: AppState = {
    teamName,
    captainName: user.displayName || 'Capitán',
    players: [],
    matches: [],
    settings: initialSettings
  };

  // Save Team
  await setDoc(doc(db, 'teams', teamId), newTeamData);
  
  // Link User to Team
  await updateDoc(doc(db, 'users', user.uid), { teamId });
  
  return teamId;
};

export const subscribeToTeam = (teamId: string, callback: (data: AppState | null) => void) => {
  return onSnapshot(doc(db, 'teams', teamId), (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as AppState);
    } else {
      callback(null);
    }
  });
};

export const getTeamIdForUser = async (uid: string): Promise<string | null> => {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (userDoc.exists()) {
    return userDoc.data().teamId || null;
  }
  return null;
};

// Generic update function for the team document
export const updateTeamData = async (teamId: string, data: Partial<AppState>) => {
  const teamRef = doc(db, 'teams', teamId);
  await updateDoc(teamRef, data);
};