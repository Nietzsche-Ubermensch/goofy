const fs = require('fs');
const PNG = require('pngjs').PNG;
fs.createReadStream('screenshot.png')
  .pipe(new PNG({ filterType: 4 }))
  .on('parsed', function() {
    let r=0, g=0, b=0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let idx = (this.width * y + x) << 2;
        r += this.data[idx];
        g += this.data[idx+1];
        b += this.data[idx+2];
      }
    }
    let total = this.width * this.height;
    console.log('Avg color:', Math.round(r/total), Math.round(g/total), Math.round(b/total));
  });
