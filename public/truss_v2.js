function initShader(gl, type, source) {
    let shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        return shader;
    }
    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return 0;
}

function initProgram(gl, vertexShader, fragmentShader) {
    let program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
        return program;
    }
    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return 0;
}
let CreateBuffer = {
    Uint16Array: function (gl, data) {
        let buffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data), gl.STATIC_DRAW);
        return buffer;
    },
    Float32Array: function (gl, data) {
        let buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
        return buffer;
    },
};

function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([0, 0, 255, 255]); // opaque blue
    gl.texImage2D(
        gl.TEXTURE_2D, level, internalFormat, width, height, border, srcFormat, srcType, pixel);
    const image = new Image();
    image.onload = function () {
        //console.log('In Image.onload()');
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image);
        if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
            // Yes, it's a power of 2. Generate mips.
            gl.generateMipmap(gl.TEXTURE_2D);
            console.log('Mipmap Generated');
        } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
    };
    image.src = url;
    return texture;
}

function isPowerOf2(value) {
    //console.log(`In isPowerOf(${value})`);
    return (value & (value - 1)) == 0;
}

function getProjectionMatrix(gl) {
    const fieldOfView = 45 * Math.PI / 180; // in radians
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const zNear = 0.1;
    const zFar = 100.0;
    const projectionMatrix = mat4.create();

    mat4.perspective(
        projectionMatrix,
        fieldOfView,
        aspect,
        zNear,
        zFar
    );
    return projectionMatrix;
}

class Node {
    constructor() {
        this.childList = [];
        this.parent = null;
    }
    addChildNode(node) {
        node.parent = this;
        this.childList.push(node);
    }
}

class RootNode extends Node {
    constructor(canvasData) {
        super();
        this.gl = canvasData.gl;
        this.canvasData = canvasData;
    }
    initScene() {
        let gl = this.gl;
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        const projectionMatrix = getProjectionMatrix(gl);
        gl.useProgram(this.canvasData.program);
        gl.uniformMatrix4fv(this.canvasData.uniformLocations.uProjectionMatrix, false, projectionMatrix);
    }
}

class TranslationNode extends Node {
    constructor(positionArray) {
        super();
        this.matrix = mat4.create();
        mat4.translate(this.matrix, this.matrix, positionArray);
        this.animate = null;
    }
}

class RotateNode extends Node {
    constructor(anglesArray) {
        super();
        this.matrix = mat4.create();
        this.angleX = anglesArray[0];
        this.angleY = anglesArray[1];
        this.angleZ = anglesArray[2];
        mat4.rotate(this.matrix, this.matrix, anglesArray[0], [1, 0, 0]);
        mat4.rotate(this.matrix, this.matrix, anglesArray[1], [0, 1, 0]);
        mat4.rotate(this.matrix, this.matrix, anglesArray[2], [0, 0, 1]);
        this.animate = null;
    }
}

function Drawable(name, buffersMap, canvasData) {
    //Drawable('name', [{type: 'Uint16Array', data: [ 0, 2, 1]}, {...}])
    return {
        name: name,
        buffers: buffersMap,
        parent: null,
        canvasData: canvasData,
        draw: function (prevMatrix) {
            console.log('undefined draw request');
        },
    };
}

function travelNodeTree(node, prevMatrix, timeSeconds) {
    //console.log(`${timeSeconds} seconds`);
    if (!node) {
        return 0;
    }
    if (node.childList.length) {
        let newMatrix = mat4.create();
        for (let child of node.childList) {
            if (child instanceof Node) {
                /* console.log('Node');
                console.log(newMatrix);
                console.log(prevMatrix);
                console.log(child.matrix); */
                if ((child.animate !== null)){
                    child.animate(timeSeconds);
                    //console.log(`${timeSeconds} seconds`);
                }
                mat4.multiply(newMatrix, prevMatrix, child.matrix);
                travelNodeTree(child, newMatrix, timeSeconds);
            } else {
                child.draw(prevMatrix);
                /* console.log('Drawable?');
                console.log(child); */
            }
        }
    }
}

function getProgramInfo(gl, vShaderSrc, fShaderSrc) {
    const vshader = initShader(gl, gl.VERTEX_SHADER, vShaderSrc);
    const fshader = initShader(gl, gl.FRAGMENT_SHADER, fShaderSrc);
    if ((!vshader) && (!fshader)) {
        console.log('Problem with shader');
        return 0;
    }
    const program = initProgram(gl, vshader, fshader);
    if (!program) {
        console.log('Problem with program');
        return 0;
    }
    return {
        program: program,
    };
}

function getUniformLocationsFromArray(gl, program, uNamesArray) {
    let uniformLocations = {};
    if (uNamesArray && uNamesArray.length) {
        for (let uname of uNamesArray) {
            uniformLocations[uname] = gl.getUniformLocation(program, uname);
        }
    } else {
        uniformLocations = null;
    }
    return {
        uniformLocations: uniformLocations,
    };
}

function getAttribLocationsFromArray(gl, program, aNamesArray) {
    let attribLocations = {};
    for (let aname of aNamesArray) {
        attribLocations[aname] = gl.getAttribLocation(program, aname);
    }
    return {
        attribLocations: attribLocations,
    };
}

function getCanvasData(id, vShaderSrc, fShaderSrc, aNamesArray, uNamesArray) {
    let canvasData = getProgramInfo(id, vShaderSrc, fShaderSrc);
    let uLocations = getUniformLocationsFromArray(canvasData.gl, canvasData.program, uNamesArray);
    canvasData = Object.defineProperties(canvasData, Object.getOwnPropertyDescriptors(uLocations));
    let aLocations = getAttribLocationsFromArray(canvasData.gl, canvasData.program, aNamesArray);
    canvasData = Object.defineProperties(canvasData, Object.getOwnPropertyDescriptors(aLocations));
    return canvasData;
}

function renderTree(rootNode, now, then, playPause){
    now *= 0.001;
    const deltaTime = now - then;
    then = now;
    if(playPause){
        rootNode.initScene();
        travelNodeTree(rootNode, mat4.create());
    }
}

function resize(canvas){
    let displayWidth = canvas.clientWidth;
    let displayHeight = canvas.clientHeight;

    if (canvas.width != displayWidth || canvas.height != displayHeight){
        canvas.width = displayWidth;
        canvas.height = displayHeight;
    }
}