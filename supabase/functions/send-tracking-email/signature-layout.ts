/** Find visible ink; transparent and near-white borders must not shrink the signature. */
export function inkBounds(data: ArrayLike<number>, width: number, height: number) {
  let left=width, top=height, right=-1, bottom=-1;
  for(let y=0;y<height;y++) for(let x=0;x<width;x++){
    const i=(y*width+x)*4;
    const darkness=(255-Math.min(data[i],data[i+1],data[i+2]))*data[i+3]/255;
    if(darkness<20) continue;
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  if(right<left||bottom<top) return {x:0,y:0,width,height};
  const pad=3;
  left=Math.max(0,left-pad);top=Math.max(0,top-pad);
  right=Math.min(width-1,right+pad);bottom=Math.min(height-1,bottom+pad);
  return {x:left,y:top,width:right-left+1,height:bottom-top+1};
}

/** Print rendering only: tint the visible ink, retaining coverage and the original stored signature. */
export function blueInk(data: Uint8Array | Uint8ClampedArray) {
  for(let i=0;i<data.length;i+=4){
    const darkness=(255-Math.min(data[i],data[i+1],data[i+2]))/255;
    const coverage=data[i+3]*Math.min(1,darkness/0.88);
    data[i]=31;data[i+1]=78;data[i+2]=163;data[i+3]=Math.round(coverage);
  }
}
export const SIGNATURE_HEIGHT_MM=10;
export const SIGNATURE_GAP_MM=0.8;
