import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url))),npm=process.platform==='win32'?'npm.cmd':'npm',env={...process.env,LIFLOW_LOCAL:'1'};
const run=(command,args)=>{
  const needsWindowsShell=process.platform==='win32'&&/\.cmd$/i.test(command);
  const result=spawnSync(command,args,{cwd:root,env,stdio:'inherit',shell:needsWindowsShell});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
};
if(Number(process.versions.node.split('.')[0])<22){console.error('LiflowにはNode.js 22以上が必要です。');process.exit(1)}
const portInUse=await new Promise(resolve=>{const socket=net.createConnection({host:'127.0.0.1',port:8787});socket.setTimeout(800);socket.once('connect',()=>{socket.destroy();resolve(true)});socket.once('timeout',()=>{socket.destroy();resolve(false)});socket.once('error',()=>resolve(false))});
if(portInUse){console.error('\nすでにLiflowが起動しています。前の黒い画面でCtrl+Cを押して終了してから、もう一度起動してください。\n');process.exit(2)}
if(!existsSync(path.join(root,'node_modules'))){
  console.log('\n[1/3] 必要なファイルをインストールしています。初回は数分かかります…\n');
  run(npm,['ci']);
}else{
  console.log('\n[1/3] 必要なファイルは準備済みです。');
}
if(!existsSync(path.join(root,'dist','server','wrangler.json'))){
  console.log('\n[2/3] Liflowを組み立てています…\n');
  run(npm,['run','build']);
}else{
  console.log('\n[2/3] Liflowは組み立て済みです。');
}
console.log('\n[3/3] Firebase同期を使うローカルサーバーを起動します…\n');
console.log('準備ができました。Liflowを起動します: http://127.0.0.1:8787\n終了するときは Ctrl+C を押してください。\n');
run(npm,['run','start','--','--port','8787']);
