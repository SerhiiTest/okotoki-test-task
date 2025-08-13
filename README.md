# MSDF Text and Graphics Renderer
## Overview
Custom renderer implementing graphics and text rendering from scratch in a single file - no external libraries.
## Features

Animated Graph Shader: Renders graphs from FLOAT texture
Text Rendering: Uses Roboto SemiCondensed ExtraLight with MTSDF atlas (generated via msdf-atlas-gen)
Single-file implementation for simplicity

## Structure
Minimal, straightforward design demonstrating core rendering concepts.
## Potential Improvements

Split code into multiple files for better organization.
Enhance text rendering with effects (outline, shadow, animations).
Simplify OpenGL handling for VAOs, shaders, and program switching.
Enable rendering of multiple different graphs using a single shader by adding an index uniform for y-offset.