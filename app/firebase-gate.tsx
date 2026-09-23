'use client';
import {useEffect,useState} from 'react';
import {createUserWithEmailAndPassword,onAuthStateChanged,signInWithEmailAndPassword,signOut,type User} from 'firebase/auth';
import {firebaseAuth} from './firebase-client';
import Liflow from './liflow';

const authMessage=(code:string)=>code.includes('invalid-credential')?'メールアドレスまたはパスワードが違います。':code.includes('email-already-in-use')?'このメールアドレスは登録済みです。':code.includes('weak-password')?'パスワードは6文字以上にしてください。':code.includes('invalid-email')?'メールアドレスを確認してください。':'認証できませんでした。通信を確認してください。';
export default function FirebaseGate(){
 const [user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false),[mode,setMode]=useState<'login'|'register'>('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>onAuthStateChanged(firebaseAuth,next=>{setUser(next);setReady(true)}),[]);
 const submit=async()=>{setBusy(true);setError('');try{if(mode==='login')await signInWithEmailAndPassword(firebaseAuth,email.trim(),password);else await createUserWithEmailAndPassword(firebaseAuth,email.trim(),password)}catch(e){setError(authMessage((e as {code?:string}).code||''))}finally{setBusy(false)}};
 if(!ready)return <div className="auth-loading">確認しています…</div>;
 if(user)return <Liflow userName={user.email||'あなた'} userId={user.uid} onSignOut={()=>signOut(firebaseAuth)}/>;
 return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><span>L</span><div><b>Liflow</b><small>生活をひとつにつなぐ</small></div></div><h1>{mode==='login'?'ログイン':'アカウントを作る'}</h1><label>メールアドレス<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>パスワード<input type="password" autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void submit()}}/></label>{error&&<p className="auth-error">{error}</p>}<button className="auth-submit" disabled={busy||!email||password.length<6} onClick={submit}>{busy?'確認中…':mode==='login'?'ログイン':'登録する'}</button><button className="auth-switch" onClick={()=>{setMode(mode==='login'?'register':'login');setError('')}}>{mode==='login'?'はじめて使う場合はこちら':'すでにアカウントがある'}</button><p className="auth-note">データは項目ごとに保存され、このアカウントで端末間同期されます。</p></section></main>;
}
