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
