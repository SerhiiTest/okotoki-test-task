#version 300 es
precision mediump float;

uniform sampler2D u_atlas;
uniform float u_threshold;
uniform vec4 u_color;

in vec2 uvCoords;
out vec4 outColor;

float median(float v0, float v1, float v2) {
  return max(min(v0, v1), min(max(v0, v1), v2));
}

void main(){
  vec3 msdf = texture(u_atlas, vec2(uvCoords.x/256., 1.-uvCoords.y/256.)).rgb;
  float sd = median(msdf.r, msdf.g, msdf.b);

  float dist = sd - u_threshold;

  float w = fwidth(sd);
  float alpha = smoothstep(-w, w, dist);

  outColor = vec4(u_color.rgb, u_color.a * alpha);
}