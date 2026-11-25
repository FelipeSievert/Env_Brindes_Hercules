/** Find visible ink; transparent and near-white borders must not shrink the signature. */
export function inkBounds(data: ArrayLike<number>, width: number, height: number, pad = 3) {
  let left=width, top=height, right=-1, bottom=-1;
  for(let y=0;y<height;y++) for(let x=0;x<width;x++){
    const i=(y*width+x)*4;
    const darkness=(255-Math.min(data[i],data[i+1],data[i+2]))*data[i+3]/255;
    if(darkness<20) continue;
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  if(right<left||bottom<top) return {x:0,y:0,width,height};
  left=Math.max(0,left-pad);top=Math.max(0,top-pad);
  right=Math.min(width-1,right+pad);bottom=Math.min(height-1,bottom+pad);
  return {x:left,y:top,width:right-left+1,height:bottom-top+1};
}

/** Render in ballpoint blue without changing the stored image or stroke geometry.
 * Modulate only existing ink density; never add marks to the signature.
 */
export function blueInk(data: Uint8Array | Uint8ClampedArray, width = data.length / 4) {
  const original=new Uint8Array(data);
  const height=data.length/4/width;
  const density=(x:number,y:number)=>{
    if(x<0||y<0||x>=width||y>=height)return 0;
    const i=(y*width+x)*4;
    return original[i+3]*Math.min(1,(255-Math.min(original[i],original[i+1],original[i+2]))/224.4);
  };
  for(let i=0;i<data.length;i+=4){
    const darkness=(255-Math.min(data[i],data[i+1],data[i+2]))/255;
    const coverage=data[i+3]*Math.min(1,darkness/0.88);
    const p=i/4, x=p%width, y=Math.floor(p/width);
    // Subtle deterministic blue ink density variation, stable in every rendering.
    const tone=0.5+0.27*Math.sin(x*0.71+y*0.39)+0.23*Math.sin(x*1.57-y*1.21);
    data[i]=Math.round(21+10*tone);
    data[i+1]=Math.round(57+16*tone);
    data[i+2]=Math.round(139+25*tone);
    const edge=Math.min(coverage,density(x-1,y),density(x+1,y),density(x,y-1),density(x,y+1));
    // Attenuate the stroke edges only; retain every visible mark and the core.
    data[i+3]=Math.round((0.62*coverage+0.38*edge)*(0.96+0.04*tone));
  }
}
export const SIGNATURE_HEIGHT_MM=10;
export const SIGNATURE_GAP_MM=0.2;
