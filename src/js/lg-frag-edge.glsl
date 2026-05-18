#version 300 es
precision highp float;
#define PI (3.14159265359)

in vec2 v_uv;
uniform vec2 u_resolution; uniform float u_dpr;
uniform vec2 u_mouse; uniform vec2 u_mouseSpring;
uniform float u_mergeRate; uniform float u_shapeWidth;
uniform float u_shapeHeight; uniform float u_shapeRadius;
uniform float u_shapeRoundness; uniform vec4 u_tint;
uniform float u_refThickness; uniform float u_refFactor;
uniform float u_refDispersion; uniform float u_refFresnelRange;
uniform float u_refFresnelFactor; uniform float u_refFresnelHardness;
uniform float u_glareRange; uniform float u_glareConvergence;
uniform float u_glareOppositeFactor; uniform float u_glareFactor;
uniform float u_glareHardness; uniform float u_glareAngle;
uniform int u_blurEdge; uniform int u_showShape1; uniform int STEP;
out vec4 fragColor;

float sdCircle(vec2 p, float r) { return length(p) - r; }
float superellipseCornerSDF(vec2 p, float r, float n) { p=abs(p); return pow(pow(p.x,n)+pow(p.y,n),1.0/n)-r; }
float roundedRectSDF(vec2 p, vec2 c, float w, float h, float cr, float n) {
  p-=c; float r=cr*u_dpr; vec2 d=abs(p)-vec2(w*u_dpr,h*u_dpr)*0.5;
  if (d.x>-r && d.y>-r) { vec2 cc=sign(p)*(vec2(w*u_dpr,h*u_dpr)*0.5-vec2(r)); return superellipseCornerSDF(p-cc,r,n); }
  return min(max(d.x,d.y),0.0)+length(max(d,0.0));
}
float smin(float a, float b, float k) { float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h); }
float mainSDF(vec2 p1, vec2 p2, vec2 p) {
  vec2 p1n=p1+p/u_resolution.y, p2n=p2+p/u_resolution.y;
  float d1=u_showShape1==1 ? sdCircle(p1n,100.0*u_dpr/u_resolution.y) : 1.0;
  float d2=roundedRectSDF(p2n,vec2(0),u_shapeWidth/u_resolution.y,u_shapeHeight/u_resolution.y,u_shapeRadius/u_resolution.y,u_shapeRoundness);
  return smin(d1,d2,u_mergeRate);
}
vec2 getNormal(vec2 p1, vec2 p2, vec2 p) {
  vec2 h=vec2(max(abs(dFdx(p.x)),1e-4),max(abs(dFdy(p.y)),1e-4));
  vec2 g=vec2(mainSDF(p1,p2,p+vec2(h.x,0))-mainSDF(p1,p2,p-vec2(h.x,0)),mainSDF(p1,p2,p+vec2(0,h.y))-mainSDF(p1,p2,p-vec2(0,h.y)))/(2.0*h);
  return g*1.414213562*1000.0;
}
float vec2ToAngle(vec2 v) { float a=atan(v.y,v.x); return a<0.0?a+2.0*PI:a; }

// sRGB → LCh for perceptually correct Fresnel/Glare
const vec3 D65=vec3(0.95045592705,1.0,1.08905775076);
const mat3 RGB2XYZ=mat3(0.4124,0.3576,0.1805,0.2126,0.7152,0.0722,0.0193,0.1192,0.9505);
const mat3 XYZ2RGB=mat3(3.2406255,-1.537208,-0.4986286,-0.9689307,1.8757561,0.0415175,0.0557101,-0.2040211,1.0569959);
float uncom(float a){return a>0.04045?pow((a+0.055)/1.055,2.4):a/12.92;}
float com(float a){return a<=0.0031308?12.92*a:1.055*pow(a,0.41666666666)-0.055;}
vec3 srgb2rgb(vec3 s){return vec3(uncom(s.x),uncom(s.y),uncom(s.z));}
vec3 rgb2srgb(vec3 r){return vec3(com(r.x),com(r.y),com(r.z));}
vec3 srgb2xyz(vec3 s){return srgb2rgb(s)*RGB2XYZ;}
vec3 xyz2srgb(vec3 x){return rgb2srgb(x*XYZ2RGB);}
float flab(float x){return x>0.00885645167?pow(x,0.333333333):7.78703703704*x+0.13793103448;}
vec3 xyz2lab(vec3 x){vec3 s=x/D65;return vec3(116.0*flab(s.y)-16.0,500.0*(flab(s.x)-flab(s.y)),200.0*(flab(s.y)-flab(s.z)));}
vec3 srgb2lab(vec3 s){return xyz2lab(srgb2xyz(s));}
vec3 lab2lch(vec3 l){return vec3(l.x,sqrt(dot(l.yz,l.yz)),atan(l.z,l.y)*57.2957795131);}
vec3 srgb2lch(vec3 s){return lab2lch(srgb2lab(s));}
float flabinv(float x){return x>0.206897?x*x*x:0.12841854934*(x-0.137931034);}
vec3 lab2xyz(vec3 l){float w=(l.x+16.0)/116.0;return D65*vec3(flabinv(w+l.y/500.0),flabinv(w),flabinv(w-l.z/200.0));}
vec3 lab2srgb(vec3 l){return xyz2srgb(lab2xyz(l));}
vec3 lch2lab(vec3 c){return vec3(c.x,c.y*cos(c.z*0.01745329251),c.y*sin(c.z*0.01745329251));}
vec3 lch2srgb(vec3 c){return lab2srgb(lch2lab(c));}

void main() {
  vec2 u1x=u_resolution.xy/u_dpr;
  vec2 p1=(vec2(0)-u_resolution.xy*0.5)/u_resolution.y;
  vec2 p2=(vec2(0)-u_mouseSpring)/u_resolution.y;
  float merged=mainSDF(p1,p2,gl_FragCoord.xy);

  vec4 outColor=vec4(0.0);
  vec3 tintRGB=vec3(u_tint.r,u_tint.g,u_tint.b);

  if (STEP<=0) {
    // Debug SDF
    float px=2.0/u_resolution.y;
    vec3 col=merged>0.0?vec3(1.0)*merged:vec3(1.0)*-merged*2.0; col*=3.0;
    col=mix(col,vec3(1.0),1.0-smoothstep(0.5/u1x.y-px,0.5/u1x.y+px,abs(merged)));
    outColor=vec4(col,1.0);
  } else if (merged<0.005) {
    float nm=-merged*u1x.y;
    float xr=1.0-nm/u_refThickness;
    float thetaI=asin(pow(xr,2.0));
    float thetaT=asin(1.0/u_refFactor*sin(thetaI));
    float ef=-tan(thetaT-thetaI);
    if (nm>=u_refThickness) ef=0.0;

    if (ef>0.0) {
      // ── Edge region: refraction dispersion + Fresnel + Glare ──
      vec2 normal=getNormal(p1,p2,gl_FragCoord.xy);
      float edgeAlpha=clamp(ef*u_refDispersion*0.05,0.0,0.7);
      float fade=1.0-nm/u_refThickness;

      // Dispersion: RGB-separated rainbow from normal angle
      float angle=vec2ToAngle(normalize(normal));
      float hR=fract(angle/(2.0*PI)*2.5+0.0);
      float hG=fract(angle/(2.0*PI)*2.5+0.33);
      float hB=fract(angle/(2.0*PI)*2.5+0.66);
      outColor.rgb=vec3(0.5+0.5*sin(hR*2.0*PI),0.5+0.5*sin(hG*2.0*PI),0.5+0.5*sin(hB*2.0*PI));

      // Tint influence
      outColor.rgb=mix(outColor.rgb,tintRGB,u_tint.a*0.6);

      // Fresnel edge glow (LCh luminance boost)
      float ff=clamp(pow(1.0+merged*u1x.y/1500.0*pow(500.0/u_refFresnelRange,2.0)+u_refFresnelHardness,5.0),0.0,1.0);
      float fstrength=ff*u_refFresnelFactor*0.7*length(normal);
      vec3 ftLCH=srgb2lch(mix(vec3(1.0),tintRGB,u_tint.a*0.5));
      ftLCH.x+=20.0*ff*u_refFresnelFactor; ftLCH.x=clamp(ftLCH.x,0.0,100.0);
      outColor.rgb=mix(outColor.rgb,lch2srgb(ftLCH),fstrength);

      // Glare highlight
      float gf=clamp(pow(1.0+merged*u1x.y/1500.0*pow(500.0/u_glareRange,2.0)+u_glareHardness,5.0),0.0,1.0);
      float ga=(vec2ToAngle(normalize(normal))-PI/4.0+u_glareAngle)*2.0;
      int fs=(ga>PI*1.5&&ga<PI*3.5||ga<PI*-0.5)?1:0;
      float gaf=(0.5+sin(ga)*0.5)*(fs==1?1.2*u_glareOppositeFactor:1.2)*u_glareFactor;
      gaf=clamp(pow(gaf,0.1+u_glareConvergence*2.0),0.0,1.0);
      float gstrength=gaf*gf*length(normal);

      vec3 gtLCH=srgb2lch(mix(outColor.rgb,tintRGB,u_tint.a*0.5));
      gtLCH.x+=150.0*gaf*gf; gtLCH.y+=30.0*gaf*gf; gtLCH.x=clamp(gtLCH.x,0.0,120.0);
      outColor.rgb=mix(outColor.rgb,lch2srgb(gtLCH),gstrength);

      outColor.a=edgeAlpha*fade;
    } else {
      // ── Center region: subtle tinted transparency ──
      // backdrop-filter blur of real UI shows through with slight glass tint
      outColor.rgb=tintRGB;
      outColor.a=u_tint.a*0.15; // very subtle tint in center
    }
  }
  // Smooth boundary
  outColor.a*=1.0-smoothstep(-0.001,0.001,merged);
  fragColor=outColor;
}
