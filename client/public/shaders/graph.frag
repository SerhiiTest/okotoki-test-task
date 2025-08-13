#version 300 es
// precision highp float;
precision mediump float;

uniform vec2 u_scale;

uniform sampler2D u_graphData;
uniform float u_graphPoints;
uniform float u_lineWidth;
uniform vec4 u_bgColor;
uniform vec4 u_lineColor;
uniform vec4 u_gradientColor;

in vec2 uvCoords;
out vec4 outColor;


float random(vec2 st) {
    return fract(sin(dot(st.xy ,vec2(12.9898,78.233))) * 43758.5453123);
}
vec4 dither(vec4 color, vec2 fragCoord) {
    float noise = random(fragCoord)/255.;
    return vec4(color.xyz + noise,color.w);
}

void main(){
    // scale wit hrespect to Y
    float w = u_scale.x/u_scale.y;
    vec2 pixelPos = vec2(uvCoords.x*w,uvCoords.y);
    float segmentWidth = w/(u_graphPoints-1.);

    float middlePointIndex = round(pixelPos.x/segmentWidth);
    float leftPointIdex = max(middlePointIndex-1.,0.);
    float rightPointIndex = min(middlePointIndex+1.,u_graphPoints-1.);

    // nearest 3 points
    float leftPointHeight = texelFetch(u_graphData,ivec2(leftPointIdex,0.),0).x;
    float middlePointHeight = texelFetch(u_graphData,ivec2(middlePointIndex,0.),0).x;
    float rightPointHeight = texelFetch(u_graphData,ivec2(rightPointIndex,0.),0).x;

    // to split below/above  
    float closestLeftPointIndex = floor(pixelPos.x/segmentWidth);
    float closestSegmentSwitch = float(closestLeftPointIndex==middlePointIndex);
    float x_fromLeftPoint = pixelPos.x - segmentWidth*closestLeftPointIndex;
    float closestLeftHeight = mix(leftPointHeight,middlePointHeight,closestSegmentSwitch);
    float closestRightHeight = mix(middlePointHeight,rightPointHeight,closestSegmentSwitch);
    float graphHeight = mix(closestLeftHeight, closestRightHeight, x_fromLeftPoint/segmentWidth);

    // vectors for 2 nearest segments
    vec2 ab = vec2(segmentWidth,middlePointHeight-leftPointHeight);
    vec2 ap = vec2(  pixelPos.x-segmentWidth*leftPointIdex, pixelPos.y - leftPointHeight);
    vec2 bc = vec2(segmentWidth,rightPointHeight-middlePointHeight);
    vec2 bp = vec2(pixelPos.x - segmentWidth*middlePointIndex,pixelPos.y-middlePointHeight);
    
    // distance from segment ab
    float h = clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0);
    float dist_ab =  length(ap - ab * h);
    // distance from segment bc 
    h = clamp(dot(bp, bc) / dot(bc, bc), 0.0, 1.0);
    float dist_bc =  length(bp - bc * h);

    // choosing minimal distance
    float min_dist = mix(min(dist_ab,dist_bc),dist_bc,float(leftPointIdex == middlePointIndex)); 
    // alpha based on distance from line
    float alpha = 1. - smoothstep(u_lineWidth - 0.001, u_lineWidth + 0.001,min_dist);
    // coloring
    vec4 gradientTop = mix(u_bgColor,u_gradientColor,.7);
    vec4 gradientBottom = mix(u_bgColor,u_gradientColor,.1);
    outColor = mix(mix(u_bgColor,dither(mix(gradientBottom,gradientTop,pixelPos.y),pixelPos+rightPointHeight),float(pixelPos.y<graphHeight)),u_lineColor,alpha);
}