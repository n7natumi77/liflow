'use client';
import {getApp,getApps,initializeApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import {initializeFirestore,persistentLocalCache,persistentMultipleTabManager,type Firestore} from 'firebase/firestore';

const firebaseConfig={
 apiKey:'AIzaSyD-rsAZ3ZpebNlpYoNKkpwWB7zbdsG4_Eo',
 authDomain:'test-b1f84.firebaseapp.com',
 projectId:'test-b1f84',
 storageBucket:'test-b1f84.firebasestorage.app',
 messagingSenderId:'900401238823',
 appId:'1:900401238823:web:2241c03056bdc5393d4f02',
 measurementId:'G-9WEX01BX81'
};

export const firebaseApp=getApps().length?getApp():initializeApp(firebaseConfig);
export const firebaseAuth=getAuth(firebaseApp);
const firestoreState=globalThis as typeof globalThis&{__liflowFirestore?:Firestore};
export const firestore=firestoreState.__liflowFirestore||initializeFirestore(firebaseApp,{
 localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()}),
});
firestoreState.__liflowFirestore=firestore;
