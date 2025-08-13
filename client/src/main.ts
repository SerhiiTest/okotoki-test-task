// -----------------------------------------------------------------------------------------------------------------------------------------------
const canvas = document.getElementById("canvas");
if(!canvas || !(canvas instanceof HTMLCanvasElement)) throw new Error("Canvas element with id 'canvas' not found or is not a <canvas> element.");
const gl = canvas.getContext("webgl2");
if(gl === null) throw new Error("WebGL2 is not supported or failed to initialize.");

const DISPLAY_GRAPH_POINTS = 100;
// glyph atlas params
var fontAtlas: FontAtlas;
// shafers
var defaultShader: BaseShader & BaseShaderUniforms;
var textShader: TextShader;
var graphShader: GraphShader;
// graph data buffer
const graphDataBuffer = new Float32Array(DISPLAY_GRAPH_POINTS);
graphDataBuffer[graphDataBuffer.length - 1] = 0.35; // starting value
// textures
var graphTexture;
var atlasTexture;
// VAOs
var demo_graphVAO: GraphVAO;
var demo_staticStringVAO: StringVAO;
// dirty flag
var isDirty = true;
// string origin oprion
const enum StringOrigin{LEFT,RIGHT,MIDDLE}

randomValuesGeneratoror();
startRendering(gl,canvas);
// -----------------------------------------------------------------------------------------------------------------------------------------------
// Random graph generation
// -----------------------
function randomValuesGeneratoror() {
    // generate value change
    const newChange = (Math.random()*2-1) * 0.08;
    // update buffer
    for (let i = 0; i < graphDataBuffer.length - 1; i++) {
        graphDataBuffer[i] = graphDataBuffer[i + 1];
    }
    graphDataBuffer[graphDataBuffer.length - 1] = Math.max(Math.min(graphDataBuffer[graphDataBuffer.length - 1]+newChange,1),0);
    // update dirty flag
    isDirty = true;
    // schedule next call (100-300ms)
    const delay = 100 + Math.random() * 200;
    setTimeout(randomValuesGeneratoror, delay);
}
// -----------------------------------------------------------------------------------------------------------------------------------------------
// Render loop
// -----------
async function startRendering(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement){

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    //#region  linking shaders
    defaultShader = linkShaders(gl, await loadFileAsString("./shaders/default.vert"), await loadFileAsString("./shaders/default.frag")) as BaseShader & BaseShaderUniforms;

    defaultShader.canvasSize = gl.getUniformLocation(defaultShader.program, "u_canvasSize");
    defaultShader.position = gl.getUniformLocation(defaultShader.program, "u_position");
    defaultShader.scale = gl.getUniformLocation(defaultShader.program, "u_scale");
    defaultShader.zIndex = gl.getUniformLocation(defaultShader.program, "u_zIndex");
    

    textShader = linkShaders(gl, await loadFileAsString("./shaders/default.vert"), await loadFileAsString("./shaders/text.frag")) as TextShader;

    textShader.canvasSize = gl.getUniformLocation(textShader.program, "u_canvasSize");
    textShader.position = gl.getUniformLocation(textShader.program, "u_position");
    textShader.scale = gl.getUniformLocation(textShader.program, "u_scale");
    textShader.zIndex = gl.getUniformLocation(textShader.program, "u_zIndex");

    textShader.atlas = gl.getUniformLocation(textShader.program, "u_atlas");
    textShader.color = gl.getUniformLocation(textShader.program, "u_color");
    textShader.threshold = gl.getUniformLocation(textShader.program, "u_threshold");
    
    
    graphShader = linkShaders(gl, await loadFileAsString("./shaders/default.vert"), await loadFileAsString("./shaders/graph.frag")) as GraphShader;
    
    graphShader.canvasSize = gl.getUniformLocation(graphShader.program, "u_canvasSize");
    graphShader.position = gl.getUniformLocation(graphShader.program, "u_position");
    graphShader.scale = gl.getUniformLocation(graphShader.program, "u_scale");
    graphShader.zIndex = gl.getUniformLocation(graphShader.program, "u_zIndex");
    
    graphShader.graphData = gl.getUniformLocation(graphShader.program, "u_graphData");
    graphShader.graphPoints = gl.getUniformLocation(graphShader.program, "u_graphPoints");
    graphShader.lineWidth = gl.getUniformLocation(graphShader.program, "u_lineWidth");
    graphShader.bgColor = gl.getUniformLocation(graphShader.program, "u_bgColor");
    graphShader.lineColor = gl.getUniformLocation(graphShader.program, "u_lineColor");
    graphShader.gradientColor = gl.getUniformLocation(graphShader.program, "u_gradientColor");    
    //#endregion


    //#region  loading text atlases
    fontAtlas = await loadFontAtlas("./fonts/atlas.json");
    const atlasImage = await loadTexture("./fonts/atlas.png");

    // Create graph data texture
    gl.activeTexture(gl.TEXTURE0);
    graphTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, graphTexture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.R32F,graphDataBuffer.length,1,0,gl.RED,gl.FLOAT,graphDataBuffer);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Create text atlas texture
    gl.activeTexture(gl.TEXTURE1);
    atlasTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlasImage);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    //#endregion


    //#region  graph vao - vertices (pos + uv)
    const graphPlaneVertexData = new Float32Array(
    [
    -1,-1,     0, -.01,
     1,-1,     1, -.01,
    -1, 1,     0, 1.01,
     1, 1,     1, 1.01,
    ]);
    const graphVAO = gl.createVertexArray();
    gl.bindVertexArray(graphVAO);
    const graphVertexBuffer = createBuffer(gl,gl.ARRAY_BUFFER,graphPlaneVertexData,gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,graphVertexBuffer);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 4*Float32Array.BYTES_PER_ELEMENT, 0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 4*Float32Array.BYTES_PER_ELEMENT, 2*Float32Array.BYTES_PER_ELEMENT);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.bindVertexArray(null);
    demo_graphVAO = {vao: graphVAO, vertexBuffer: graphVertexBuffer}
    //#endregion

    // demo string vao
    demo_staticStringVAO = generateStaticStringVAO(gl,"123.465 abcABC !@#$",StringOrigin.LEFT);

    renderLoop(gl,canvas);
}
function renderLoop(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement){
    //
    const needResize = resizeCanvas(canvas);
    // -------------------------------
    if(!isDirty && !needResize) {
        requestAnimationFrame(()=>renderLoop(gl,canvas));
        return;
    }
    if(isDirty){
        isDirty = false;    
        // update data
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, graphTexture);
        gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,graphDataBuffer.length,1,gl.RED,gl.FLOAT,graphDataBuffer);
    }
    // -------------------------------
    gl.clearColor(1, 1, 1, 1);
    // gl.clearColor(0.08, 0.08, 0.08, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if(needResize) gl.viewport(0,0,canvas.width,canvas.height);

    // -------------------------------
    // Graph rendering
    gl.useProgram(graphShader.program);
    gl.uniform2f(graphShader.canvasSize, canvas.width, canvas.height);
    
    gl.uniform2f(graphShader.position, 500,350);
    gl.uniform2f(graphShader.scale, 500,350);


    gl.uniform1i(graphShader.graphData, 0);
    gl.uniform1f(graphShader.lineWidth,0.002);
    gl.uniform1f(graphShader.graphPoints, graphDataBuffer.length);
    gl.uniform4f(graphShader.bgColor, 1, 1, 1, 1);
    // gl.uniform4f(graphShader.bgColor, 0.153, 0.153, 0.153, 1);
    gl.uniform4f(graphShader.lineColor, 0.18, 0.012, 0.855, 1.0);
    gl.uniform4f(graphShader.gradientColor, 0.18, 0.012, 0.655, 1.0);
    
    gl.bindVertexArray(demo_graphVAO.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // -------------------------------
    gl.useProgram(textShader.program);
    gl.activeTexture(gl.TEXTURE1);
    gl.uniform2f(textShader.canvasSize, canvas.width, canvas.height);
    
    gl.uniform2f(textShader.position, 40,800);
    gl.uniform2f(textShader.scale, 100,100);
    gl.uniform1i(textShader.atlas, 1);
    
    gl.uniform1f(textShader.threshold, 0.45);
    gl.uniform4f(textShader.color, 0,0,0,1);

    gl.bindVertexArray(demo_staticStringVAO.vao);
    gl.drawElements(gl.TRIANGLES,demo_staticStringVAO.glythsCount*6,gl.UNSIGNED_SHORT,0);

    // ------------------------------- 
    requestAnimationFrame(()=>renderLoop(gl,canvas));
}
// -----------------------------------------------------------------------------------------------------------------------------------------------
// Functions 
// ------------------------
//
function linkShaders(gl: WebGL2RenderingContext, vertexShaderCode: string, fragmentShaderCode: string): BaseShader{
    // Helper function to compile shader
    function compileShader(gl: WebGL2RenderingContext, code: string, glEnum: number): WebGLShader{
        let shader = gl.createShader(glEnum);
        if(!shader) throw new Error("Failed to create shader");
        gl.shaderSource(shader, code);
        gl.compileShader(shader);
        if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
            const error = gl.getShaderInfoLog(shader)
            throw new Error("Shader compile error:"+error);
        }
        return shader;
    }
    const vertexShader = compileShader(gl, vertexShaderCode, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fragmentShaderCode, gl.FRAGMENT_SHADER);
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    
    gl.linkProgram(shaderProgram);
    if(!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)){
        const error = gl.getProgramInfoLog(shaderProgram)
        // handle error
        throw new Error("Program link error:"+error);
    }
    return {program:shaderProgram,vertexShader:vertexShader,fragmentShader:fragmentShader};
}
// -----------------------------------------------------------------------------------------------------------------------------------------------
// loading
async function loadFileAsString(filePath: string): Promise<string> {
  const response: Response = await load(filePath);
  return await response.text();
}
async function loadFontAtlas(url: string): Promise<FontAtlas> {
    const response = await load(url);
    const data = await response.json();
    return data as FontAtlas;
} 
async function load(url: string): Promise<Response> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load: ${response.status} ${response.statusText}`);
    }
    return response;
}
async function loadTexture(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      image.src = url;
    });
}
// -----------------------------------------------------------------------------------------------------------------------------------------------
// helpers
function createBuffer(gl: WebGL2RenderingContext,target: GLenum, data: BufferSource, usage: GLenum): WebGLBuffer{
    const buffer = gl.createBuffer();
    gl.bindBuffer(target,buffer);
    gl.bufferData(target,data,usage);
    gl.bindBuffer(target,null);
    return buffer;
}
function resizeCanvas(canvas: HTMLCanvasElement){
    const displayWidth  = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    // Check if the canvas is not the same size.
    const needResize = canvas.width  !== displayWidth ||
                       canvas.height !== displayHeight;

    if (needResize) {
        // Make the canvas the same size
      canvas.width  = displayWidth;
      canvas.height = displayHeight;
    }

    return needResize;
}
function generateStaticStringVAO(gl: WebGL2RenderingContext,text: string, origin: StringOrigin): StringVAO{
    const chars = [...text];
    const stringVertexBuffer: number[] = [];
    const stringUVBuffer: number[] = [];
    const stringIndexBuffer: number[] = [];
    var totalX=0;
    var baseXOffsetCof=1;
    const defaultGlyph = fontAtlas.glyphs.find(g => g.unicode === 37)!;
    if(!defaultGlyph){
        throw new Error("? glyph is missing");
    }
    switch(origin){
        case StringOrigin.LEFT:
            break;
        case StringOrigin.MIDDLE:
            throw new Error("Not implemented")
            // to do calculate fill with/-2 and set to totalX
        case StringOrigin.RIGHT:
            baseXOffsetCof=-1;
        break;
    }
    var glyphsAdded=0;
    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const unicode = char.charCodeAt(0);
        let glyph = fontAtlas.glyphs.find(g => g.unicode === unicode);
        if (!glyph) {
            glyph = defaultGlyph;
        }
        if (!glyph.planeBounds || !glyph.atlasBounds) {
            totalX += glyph.advance;
            continue;
        }
        
        stringIndexBuffer.push(glyphsAdded*4,glyphsAdded*4+1,glyphsAdded*4+2, glyphsAdded*4,glyphsAdded*4+2,glyphsAdded*4+3);
        stringUVBuffer.push(
            glyph.atlasBounds.left,  glyph.atlasBounds.bottom,
            glyph.atlasBounds.right, glyph.atlasBounds.bottom,
            glyph.atlasBounds.right, glyph.atlasBounds.top,
            glyph.atlasBounds.left,  glyph.atlasBounds.top);
        stringVertexBuffer.push(
            totalX + glyph.planeBounds.left, glyph.planeBounds.bottom,
            totalX + glyph.planeBounds.right, glyph.planeBounds.bottom,
            totalX + glyph.planeBounds.right, glyph.planeBounds.top,
            totalX + glyph.planeBounds.left, glyph.planeBounds.top);
        
    console.log(unicode+":"+[glyph.atlasBounds.left,  glyph.atlasBounds.bottom,
            glyph.atlasBounds.right, glyph.atlasBounds.bottom,
            glyph.atlasBounds.right, glyph.atlasBounds.top,
            glyph.atlasBounds.left,  glyph.atlasBounds.top]);
        totalX += glyph.advance*baseXOffsetCof;
        glyphsAdded++;
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    
    const indexBuffer = createBuffer(gl,gl.ELEMENT_ARRAY_BUFFER,new Int16Array(stringIndexBuffer),gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);

    const positionBuffer = createBuffer(gl,gl.ARRAY_BUFFER,new Float32Array(stringVertexBuffer),gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const uvBuffer = createBuffer(gl,gl.ARRAY_BUFFER,new Float32Array(stringUVBuffer),gl.STATIC_DRAW);    
    gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffer);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    return {vao:vao,positionBuffer: positionBuffer, uvBuffer: uvBuffer, indexBuffer: indexBuffer, glythsCount: glyphsAdded};
}
// -----------------------------------------------------------------------------------------------------------------------------------------------
// Interfaces
// ----------
interface FontAtlas {
    atlas: {
        type: string;
        distanceRange: number;
        distanceRangeMiddle: number;
        size: number;
        width: number;
        height: number;
        yOrigin: string;
    };
    metrics: {
        emSize: number;
        lineHeight: number;
        ascender: number;
        descender: number;
        underlineY: number;
        underlineThickness: number;
    };
    glyphs: {
        unicode: number;
        advance: number;
        planeBounds?: {
            left: number;
            bottom: number;
            right: number;
            top: number;
        };
        atlasBounds?: {
            left: number;
            bottom: number;
            right: number;
            top: number;
        };
    }[];
}
//
interface BaseShader{
    vertexShader: WebGLShader;
    fragmentShader: WebGLShader;
    program: WebGLProgram;
}
interface BaseShaderUniforms{
    scale: WebGLUniformLocation | null;
    position: WebGLUniformLocation | null;
    canvasSize: WebGLUniformLocation | null;
    zIndex: WebGLUniformLocation | null;
}
interface GraphShader extends BaseShader, BaseShaderUniforms{
    graphData: WebGLUniformLocation | null;
    graphPoints: WebGLUniformLocation | null;
    lineWidth: WebGLUniformLocation | null;
    bgColor: WebGLUniformLocation | null;
    lineColor: WebGLUniformLocation | null;
    gradientColor: WebGLUniformLocation | null;
}
interface TextShader extends BaseShader, BaseShaderUniforms{
    atlas: WebGLUniformLocation | null;
    color: WebGLUniformLocation | null;
    threshold: WebGLUniformLocation | null;
}
//
interface GraphVAO{
    vao:  WebGLVertexArrayObject;
    vertexBuffer: WebGLBuffer;
}
interface StringVAO{
    vao:  WebGLVertexArrayObject;
    glythsCount: number;
    indexBuffer: WebGLBuffer;
    positionBuffer: WebGLBuffer;
    uvBuffer: WebGLBuffer;
}
// -----------------------------------------------------------------------------------------------------------------------------------------------