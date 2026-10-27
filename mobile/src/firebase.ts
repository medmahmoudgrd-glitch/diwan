// One Firebase app for the whole phone app. On iOS/Android the sign-in survives restarts through AsyncStorage;
// the web build (used only for previewing screens) keeps the browser's own persistence.
import { Platform } from 'react-native';
import { initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE } from './config';

export const app = initializeApp(FIREBASE);

// getReactNativePersistence only exists in Firebase's React Native build, which Metro picks on iOS/Android.
const rnPersistence = (FirebaseAuth as unknown as { getReactNativePersistence?: (s: typeof AsyncStorage) => FirebaseAuth.Persistence }).getReactNativePersistence;
export const auth = Platform.OS === 'web' || !rnPersistence
  ? FirebaseAuth.getAuth(app)
  : FirebaseAuth.initializeAuth(app, { persistence: rnPersistence(AsyncStorage) });

// Long polling keeps Firestore working on mobile networks that drop streaming connections.
export const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
