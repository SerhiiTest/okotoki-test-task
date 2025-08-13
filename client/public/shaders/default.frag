#version 300 es
precision mediump float;

in vec2 uvCoords;
out vec4 outColor;

void main(){
    outColor = vec4(uvCoords,0,1);
}
