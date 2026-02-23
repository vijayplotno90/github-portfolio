
/* Minimal ZIP builder (store method, no compression). Suitable for small demo bundles.
   Produces a valid .zip Blob for an array of {name, data} where data is a string (utf-8).
*/
(function(){
  function u32(n){ return [n & 255, (n>>8)&255, (n>>16)&255, (n>>24)&255]; }
  function u16(n){ return [n & 255, (n>>8)&255]; }

  // CRC32
  const table = (function(){
    const t = new Uint32Array(256);
    for(let i=0;i<256;i++){
      let c=i;
      for(let k=0;k<8;k++){
        c = (c & 1) ? (0xEDB88320 ^ (c>>>1)) : (c>>>1);
      }
      t[i]=c>>>0;
    }
    return t;
  })();

  function crc32(bytes){
    let c=0xFFFFFFFF;
    for(const b of bytes){
      c = table[(c ^ b) & 0xFF] ^ (c>>>8);
    }
    return (c ^ 0xFFFFFFFF)>>>0;
  }

  function utf8(s){ return new TextEncoder().encode(s); }

  function dosTime(date){
    const d = date || new Date();
    const time = ((d.getHours() & 0x1F) << 11) | ((d.getMinutes() & 0x3F) << 5) | ((Math.floor(d.getSeconds()/2)) & 0x1F);
    const dt = (((d.getFullYear()-1980) & 0x7F) << 9) | (((d.getMonth()+1) & 0x0F) << 5) | (d.getDate() & 0x1F);
    return {time, date: dt};
  }

  function concat(chunks){
    const total = chunks.reduce((a,c)=>a+c.length,0);
    const out = new Uint8Array(total);
    let o=0;
    for(const c of chunks){ out.set(c, o); o+=c.length; }
    return out;
  }

  const CTZip = window.CTZip = {
    makeZip(files){
      const now = new Date();
      const entries = [];
      let offset = 0;
      const fileChunks = [];

      for(const f of files){
        const nameBytes = utf8(f.name);
        const dataBytes = utf8(f.data || "");
        const crc = crc32(dataBytes);
        const dt = dosTime(now);

        // Local file header
        const local = new Uint8Array([
          0x50,0x4b,0x03,0x04, // signature
          0x14,0x00,           // version needed
          0x00,0x00,           // flags
          0x00,0x00,           // compression method = store
          ...u16(dt.time),
          ...u16(dt.date),
          ...u32(crc),
          ...u32(dataBytes.length), // compressed size
          ...u32(dataBytes.length), // uncompressed size
          ...u16(nameBytes.length),
          ...u16(0)            // extra len
        ]);

        fileChunks.push(local, nameBytes, dataBytes);

        entries.push({
          nameBytes,
          crc,
          size: dataBytes.length,
          offset,
          dt
        });

        offset += local.length + nameBytes.length + dataBytes.length;
      }

      // Central directory
      const cdChunks = [];
      let cdSize = 0;
      for(const e of entries){
        const cd = new Uint8Array([
          0x50,0x4b,0x01,0x02, // signature
          0x14,0x00,           // version made
          0x14,0x00,           // version needed
          0x00,0x00,           // flags
          0x00,0x00,           // compression store
          ...u16(e.dt.time),
          ...u16(e.dt.date),
          ...u32(e.crc),
          ...u32(e.size),
          ...u32(e.size),
          ...u16(e.nameBytes.length),
          ...u16(0),           // extra
          ...u16(0),           // comment
          ...u16(0),           // disk start
          ...u16(0),           // internal attrs
          ...u32(0),           // external attrs
          ...u32(e.offset)
        ]);
        cdChunks.push(cd, e.nameBytes);
        cdSize += cd.length + e.nameBytes.length;
      }

      const cdOffset = offset;
      const cdData = concat(cdChunks);

      // End of central directory
      const eocd = new Uint8Array([
        0x50,0x4b,0x05,0x06,
        0x00,0x00, // disk
        0x00,0x00, // cd start disk
        ...u16(entries.length),
        ...u16(entries.length),
        ...u32(cdSize),
        ...u32(cdOffset),
        ...u16(0)  // comment len
      ]);

      const all = concat([...fileChunks, cdData, eocd]);
      return new Blob([all], {type:"application/zip"});
    }
  };
})();
