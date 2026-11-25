// Only called for a verified, authorized private audio message.
const MAX=5*1024*1024;
export async function transcribirAudio(mediaId,token,groq,phoneId){
 if(!/^[0-9]{5,30}$/.test(mediaId||''))throw Error('media_id');
 const headers={authorization:'Bearer '+token};
 const meta=await fetch('https://graph.facebook.com/v27.0/'+mediaId+'?phone_number_id='+phoneId,{headers,redirect:'error',signal:AbortSignal.timeout(5000)});
 if(!meta.ok)throw Error('media_meta');
 const m=await meta.json();
 const mime=String(m.mime_type||'').split(';')[0].toLowerCase();
 const ext={'audio/ogg':'ogg','audio/mpeg':'mp3','audio/mp4':'m4a','audio/wav':'wav','audio/webm':'webm'}[mime];
 if(!ext||!Number.isFinite(Number(m.file_size))||Number(m.file_size)<=0||Number(m.file_size)>MAX)throw Error('media_format_size');
 const u=new URL(m.url);
 if(u.protocol!=='https:'||u.hostname!=='lookaside.fbsbx.com'||u.username||u.password||u.port)throw Error('media_host');
 const audio=await fetch(u,{headers,redirect:'error',signal:AbortSignal.timeout(8000)});
 if(!audio.ok||!audio.body)throw Error('media_download');
 const reader=audio.body.getReader();const chunks=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX){await reader.cancel();throw Error('media_size');}chunks.push(value);}
 if(size===0)throw Error('media_empty');
 const form=new FormData();
 form.append('file',new Blob(chunks,{type:mime}),'nota.'+ext);
 form.append('model','whisper-large-v3-turbo');form.append('language','es');form.append('temperature','0');form.append('response_format','json');
 const response=await fetch('https://api.groq.com/openai/v1/audio/transcriptions',{method:'POST',headers:{authorization:'Bearer '+groq},body:form,redirect:'error',signal:AbortSignal.timeout(18000)});
 if(!response.ok){console.warn('LASO_AUDIO provider_status '+response.status);throw Error('transcription');}
 const result=await response.json();const text=typeof result.text==='string'?result.text.trim():'';
 if(!text)throw Error('empty_transcript');
 return text.slice(0,1800);
}
