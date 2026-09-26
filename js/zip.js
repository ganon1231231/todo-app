(() => {
  // Minimal ZIP writer/reader for Dr.Coach! backups. Uses STORE (no compression),
  // avoiding third-party runtime dependencies and keeping import/export fully offline.
  const te = new TextEncoder();
  const td = new TextDecoder();
  const crcTable = (()=>{
    const t=new Uint32Array(256);
    for(let n=0;n<256;n++){
      let c=n;
      for(let k=0;k<8;k++) c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);
      t[n]=c>>>0;
    }
    return t;
  })();
  function crc32(bytes){
    let c=0xffffffff;
    for(let i=0;i<bytes.length;i++) c=crcTable[(c^bytes[i])&0xff]^(c>>>8);
    return (c^0xffffffff)>>>0;
  }
  function u16(n){return [n&255,(n>>>8)&255]}
  function u32(n){return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]}
  function concat(parts){
    let len=0;parts.forEach(p=>len+=p.length);const out=new Uint8Array(len);let o=0;parts.forEach(p=>{out.set(p,o);o+=p.length});return out;
  }
  async function toBytes(data){
    if(typeof data==='string') return te.encode(data);
    if(data instanceof Uint8Array) return data;
    if(data instanceof ArrayBuffer) return new Uint8Array(data);
    if(data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
    return te.encode(String(data));
  }
  function dosDateTime(date=new Date()){
    const year=Math.max(1980,date.getFullYear());
    const dosTime=(date.getHours()<<11)|(date.getMinutes()<<5)|(date.getSeconds()>>1);
    const dosDate=((year-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate();
    return {dosTime,dosDate};
  }
  async function createZip(entries){
    const locals=[],centrals=[];let offset=0;
    for(const entry of entries){
      const name=te.encode(entry.name);const bytes=await toBytes(entry.data);const crc=crc32(bytes);const {dosTime,dosDate}=dosDateTime(entry.date||new Date());
      const local=concat([new Uint8Array([0x50,0x4b,0x03,0x04]),new Uint8Array(u16(20)),new Uint8Array(u16(0x0800)),new Uint8Array(u16(0)),new Uint8Array(u16(dosTime)),new Uint8Array(u16(dosDate)),new Uint8Array(u32(crc)),new Uint8Array(u32(bytes.length)),new Uint8Array(u32(bytes.length)),new Uint8Array(u16(name.length)),new Uint8Array(u16(0)),name,bytes]);
      locals.push(local);
      const central=concat([new Uint8Array([0x50,0x4b,0x01,0x02]),new Uint8Array(u16(20)),new Uint8Array(u16(20)),new Uint8Array(u16(0x0800)),new Uint8Array(u16(0)),new Uint8Array(u16(dosTime)),new Uint8Array(u16(dosDate)),new Uint8Array(u32(crc)),new Uint8Array(u32(bytes.length)),new Uint8Array(u32(bytes.length)),new Uint8Array(u16(name.length)),new Uint8Array(u16(0)),new Uint8Array(u16(0)),new Uint8Array(u16(0)),new Uint8Array(u16(0)),new Uint8Array(u32(0)),new Uint8Array(u32(offset)),name]);
      centrals.push(central);offset+=local.length;
    }
    const centralBytes=concat(centrals);const localBytes=concat(locals);
    const end=concat([new Uint8Array([0x50,0x4b,0x05,0x06]),new Uint8Array(u16(0)),new Uint8Array(u16(0)),new Uint8Array(u16(entries.length)),new Uint8Array(u16(entries.length)),new Uint8Array(u32(centralBytes.length)),new Uint8Array(u32(localBytes.length)),new Uint8Array(u16(0))]);
    return new Blob([localBytes,centralBytes,end],{type:'application/zip'});
  }
  function readU16(v,o){return v[o]|(v[o+1]<<8)}
  function readU32(v,o){return (v[o]|(v[o+1]<<8)|(v[o+2]<<16)|(v[o+3]<<24))>>>0}
  async function readZip(file){
    const v=new Uint8Array(await file.arrayBuffer());
    let eocd=-1;for(let i=v.length-22;i>=Math.max(0,v.length-65557);i--){if(readU32(v,i)===0x06054b50){eocd=i;break}}
    if(eocd<0) throw new Error('ZIP inválido: no se encontró directorio central.');
    const count=readU16(v,eocd+10);const cdOffset=readU32(v,eocd+16);let p=cdOffset;const out={};
    for(let i=0;i<count;i++){
      if(readU32(v,p)!==0x02014b50) throw new Error('ZIP inválido: entrada central corrupta.');
      const method=readU16(v,p+10);if(method!==0) throw new Error('Este importador solo admite backups ZIP creados por Dr.Coach! o una versión compatible anterior.');
      const compSize=readU32(v,p+20);const nameLen=readU16(v,p+28);const extraLen=readU16(v,p+30);const commentLen=readU16(v,p+32);const localOffset=readU32(v,p+42);const name=td.decode(v.slice(p+46,p+46+nameLen));
      if(readU32(v,localOffset)!==0x04034b50) throw new Error('ZIP inválido: entrada local corrupta.');
      const lNameLen=readU16(v,localOffset+26),lExtraLen=readU16(v,localOffset+28);const dataStart=localOffset+30+lNameLen+lExtraLen;const data=v.slice(dataStart,dataStart+compSize);
      out[name]=data;p+=46+nameLen+extraLen+commentLen;
    }
    return out;
  }
  const api={createZip,readZip,decodeText:(bytes)=>td.decode(bytes)};
  window.DrCoachZip=api;
  window.MediospiraZip=api; // legacy alias
})();
