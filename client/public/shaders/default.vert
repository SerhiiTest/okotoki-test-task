#version 300 es
precision mediump float;

/*
uniform mat3 u_projection;
uniform mat3 u_transform;
/*/
uniform vec2 u_scale;
uniform vec2 u_position;
uniform vec2 u_canvasSize;
uniform float u_zIndex;
//*/

layout(location = 0) in vec2 vertexPos;
layout(location = 1) in vec2 vertexUV;

out vec2 uvCoords;

void main(){
    uvCoords = vertexUV;
    gl_Position = vec4((vertexPos*u_scale + u_position)/u_canvasSize*2.-1.,u_zIndex,1.);
}