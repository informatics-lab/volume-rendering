CLOUD = "https://dl.dropboxusercontent.com/u/2665124/volume_rendering_data/";

var renderer, sceneBackFace, sceneRayMarch, scene, camera, clock, backFaceTexture, dataTexture, uniforms, attributes;
var stats;

var video, videoImage, videoImageContext;

var nSteps = 81;
var opacFac = 5.0;
var alphaCorrection = getAlphaCorrection(opacFac, nSteps);
var mipMapTex = false;
var downScaling = 10;
var dirlight;
var play = true;

var fps = 10;
var now;
var then = Date.now();
var interval = 1000/fps;
var delta;

var lightColor = 0xFFFFFF;
var dirLightIntensity = 3;

initVis();
initGUI();
alert("Welcome to our 'Weather Cubed' 3D weather demo\nThis software is at the very earliest\
 stages of development. Here are all the caveats:\n* we only support Chrome\n* it may crash WebGL\
in your browser\n* the data doesn't reflect the real weather\n* and it is very slooooow.\nOn the\
 upside, there are lots of things you can help with if you want to! Just go to www.informaticslab.co.uk\
  to find out more.");
animate();

var g;

function getAlphaCorrection(opacFace, nSteps){
    return opacFac/nSteps;
}


function setDataTexType(mipMapTex){
    if (mipMapTex){
            dataTexture.generateMipmaps = true;
            dataTexture.magFilter = THREE.LinearFilter;
            dataTexture.minFilter = THREE.LinearMipMapLinearFilter;
    }else{
            dataTexture.generateMipmaps = false;
            dataTexture.magFilter = THREE.NearestFilter;
            dataTexture.minFilter = THREE.NearestFilter;
    };
    dataTexture.needsUpdate = true;
}

function initGUI() {
    // dat.gui
    gui = new dat.GUI({
        height : 5 * 32 - 1,
        width : 350
    });


    appearanceParams = {
        "Opacity factor": opacFac,
        "Number of steps": nSteps,
        "Mip Map texture": mipMapTex,
        "Downscaling": downScaling,
    };
           
    apperanceFolder = gui.addFolder("Apperance");
    
    var pOpacFac = apperanceFolder.add(appearanceParams, 'Opacity factor');
    pOpacFac.onFinishChange(function(value){
        opacFac = value;
        uniforms.alphaCorrection.value = getAlphaCorrection(opacFac, nSteps);
    });

    var pnSteps = apperanceFolder.add(appearanceParams, 'Number of steps');
    pnSteps.onChange(function(value){
        nSteps = value;
        uniforms.steps.value = nSteps;
        uniforms.alphaCorrection.value = getAlphaCorrection(opacFac, nSteps);
    });

    var pMipMapTex = apperanceFolder.add(appearanceParams, 'Mip Map texture');
    pMipMapTex.onChange(function(value){
        mipMapTex = value;
        setDataTexType(mipMapTex);
    });

    var pDownScaling = apperanceFolder.add(appearanceParams, 'Downscaling');
    pDownScaling.value = downScaling;

    animationParams = {
        "Pause": function(){play = !play;
                            play ? pPlay.name("Pause") : pPlay.name("Play");}
    }

    animationCtrlFolder = gui.addFolder("Animation");
    pPlay = animationCtrlFolder.add(animationParams, 'Pause');

    gui.closed = true;
    
    // stats
    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '5px';
    stats.domElement.style.margin = '5px';
    document.body.appendChild( stats.domElement );
}

function initVis() {
    clock = new THREE.Clock();
    
    /*** Camera ***/
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 1000);
    camera.rotation.order = "YXZ";
    camera.position.set(2.0, 1.0, 2.0);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    /*** lights ***/
    dirLight = new THREE.DirectionalLight(lightColor, dirLightIntensity);
    dirLight.position.set(0.0, 20.0, 0.0);
    ambLight = new THREE.AmbientLight(lightColor);

    var boxGeometry = new THREE.BoxGeometry(1.0, 1.0, 1.0); // the block to render inside
    boxGeometry.doubleSided = true;

    /* video texture */
    file = CLOUD+"cloud_frac2_623_812_70_4096_4096.ogv";
    dims = getDimensions(file);

    video = document.createElement( 'video' );
    video.loop = true;
    video.id = 'video';
    video.type = ' video/ogg; codecs="theora, vorbis" ';
    video.src = file;
    video.crossOrigin = "Anonymous";
    video.load(); // must call after setting/changing source
    video.play();
    
    videoImage = document.createElement( 'canvas' );
    videoImage.width = dims.textureshape.x;
    videoImage.height = dims.textureshape.y;

    videoImageContext = videoImage.getContext( '2d' );
    // background color if no video present
    videoImageContext.fillStyle = '#000000';
    videoImageContext.fillRect( 0, 0, videoImage.width, videoImage.height );

    dataTexture = new THREE.Texture( videoImage );
    setDataTexType(mipMapTex); // set mip mapping on or off

    /*** first pass ***/
	var materialbackFace = new THREE.ShaderMaterial( {
        vertexShader: document.getElementById( 'vertexShaderBackFace' ).textContent,
        fragmentShader: document.getElementById( 'fragmentShaderBackFace' ).textContent,
        side: THREE.BackSide
    });

    var meshBackFace = new THREE.Mesh( boxGeometry, materialbackFace );
    
    sceneBackFace = new THREE.Scene();
    sceneBackFace.add( meshBackFace );
    
    // get the "colour" coords we just made, as a texture
    backFaceTexture = new THREE.WebGLRenderTarget(  window.innerWidth/downScaling,
                                                     window.innerHeight/downScaling,
                                             { minFilter: THREE.NearestFilter,
                                               magFilter: THREE.NearestFilter,
                                               format: THREE.RGBFormat,
                                               type: THREE.FloatType } );
    backFaceTexture.wrapS = backFaceTexture.wrapT = THREE.ClampToEdgeWrapping;    
    
    /*** second pass ***/
    uniforms = { backFaceTexture: { type: "t", value: backFaceTexture },
                         dataTexture: { type: "t", value: dataTexture },
                         lightPosition: { type: "v3", value: dirLight.position},
                         lightColor: { type: "v3", value: {x: dirLight.color.r, y:dirLight.color.g, z:dirLight.color.b}},
                         lightIntensity: {type: "1f", value: dirLight.intensity},
                         steps : {type: "1f" , value: nSteps}, // so we know how long to make in incriment 
                         alphaCorrection : {type: "1f" , value: alphaCorrection },
                         dataShape: {type: "v3", value: dims.datashape},
                         textureShape: {type: "v2", value: dims.textureshape}
                     };

    materialRayMarch = new THREE.ShaderMaterial( {
        vertexShader: document.getElementById( 'vertexShaderRayMarch' ).textContent,
        fragmentShader: document.getElementById( 'fragmentShaderRayMarch' ).textContent,
        side: THREE.FrontSide,
        uniforms: uniforms
    });
    // materialRayMarch.transparent = true;
    
    sceneRayMarch = new THREE.Scene();
    var meshRayMarch = new THREE.Mesh( boxGeometry, materialRayMarch );
    sceneRayMarch.add( meshRayMarch );

    rayMarchTexture = new THREE.WebGLRenderTarget(  window.innerWidth/downScaling,
                                                     window.innerHeight/downScaling,
                                             { minFilter: THREE.LinearFilter,
                                               magFilter: THREE.LinearFilter,
                                               format: THREE.RGBAFormat,
                                               type: THREE.FloatType } );
    rayMarchTexture.wrapS = rayMarchTexture.wrapT = THREE.ClampToEdgeWrapping;

    /*************** Resample ray marching ****/
    var uniforms2 = {rayMarchTexture: {type: "t", value: rayMarchTexture}};
    materialResampledRayMarch = new THREE.ShaderMaterial( {
        vertexShader: document.getElementById( 'vertexShaderResampleRayMarch' ).textContent,
        fragmentShader: document.getElementById( 'fragmentShaderResampleRayMarch' ).textContent,
        side: THREE.FrontSide,
        uniforms: uniforms2
    });
    materialResampledRayMarch.transparent = true;
    var meshResampledRayMarch = new THREE.Mesh( boxGeometry, materialResampledRayMarch );

    scene = new THREE.Scene();
    scene.add(meshResampledRayMarch)


    /*************** Add map **************/
    THREE.ImageUtils.crossOrigin = "";
    var mapImage = THREE.ImageUtils.loadTexture(CLOUD+"uk.jpg");
    var mapMaterial = new THREE.MeshLambertMaterial({ map : mapImage });
    var mapPlane = new THREE.Mesh(new THREE.PlaneBufferGeometry(1, 1), mapMaterial);
    mapPlane.rotation.x = -Math.PI / 2;
    mapPlane.position.y = -0.5;

    scene.add(mapPlane);

    /*************** add aquarium outline **/
    var boxOutlineMesh = new THREE.Mesh( boxGeometry );
    var boxOutLine = new THREE.BoxHelper( boxOutlineMesh );
    boxOutLine.material.color.set( "#000033" );
    scene.add( boxOutLine );

    /*************** Scene etc ************/
    renderer = new THREE.WebGLRenderer( { antialias: true} );
    renderer.setSize(window.innerWidth, window.innerHeight); // reducing these values effectively reduced resolution
    renderer.setClearColor( "rgb(135, 206, 250)", 1);

    renderer.domElement.style.cssText = "width: 100%;, height: 100%";

    document.body.appendChild(renderer.domElement);

    // add light
    scene.add(dirLight);
    scene.add(ambLight); // currently doesn't do anything as it isn't passed to the shader.

    // trackball controls
    controls = new THREE.FirstPersonControls(camera, renderer.domElement);
    controls.moveSpeed *= 0.0001;
    controls.rotateSpeed *= 1.0;
}

/**
/ Parse dimension values from a formatted filename
/ @param {string} filename - format "*_x_y_z_u_v.png"
/       where (x,y,z) is datashape and (u,v) is textureshape
/ @returns {Object}
/   - {THREE.Vector3} datashape
/   - {THREE.Vector2} textureshape
**/
function getDimensions(filename) {
    var sections = filename.split(".");
    var name = sections[sections.length - 2];
    var parts = name.split("_").filter( // might be a problem on old browsers
        function(el) { return el !== ''; }
    );
    var numbers = parts.map(
        function(el) { return Number(el); }
    ).filter(
        function(el) { return !isNaN(el); }
    );
    var result = {datashape:null, textureshape:null};
    if (numbers.length >= 5) {
        result.datashape = new THREE.Vector3(numbers[0], numbers[1], numbers[2]);
        result.textureshape = new THREE.Vector2(numbers[3], numbers[4]);
    }
    return result;
}

function animate() {
    requestAnimationFrame(animate);
    // console.log(camera.getWorldRotation());

    stats.begin();
    now = Date.now();
    delta = now - then;
    controls.update(delta);
    if (delta > interval) {
        // update time stuffs
        then = now - (delta % interval);
         
        update();
        render();
    }

    stats.end();
}

function update() {
    if (play){
        video.play();
    }else{
        video.pause();
    }
    // controls.update();
}


function render() {
    //Render first pass and store the world space coords of the back face fragments into the texture.
    renderer.render( sceneBackFace, camera, backFaceTexture, true);

    if ( video.readyState === video.HAVE_ENOUGH_DATA ) 
    {
        videoImageContext.drawImage( video, 0, 0 );
        if ( dataTexture ) 
            dataTexture.needsUpdate = true;
    }
    //Render the second pass and perform the volume rendering.
    renderer.render( sceneRayMarch, camera, rayMarchTexture, true );
    renderer.render( scene, camera );
}


var debugaxis = function(axisLength){
    //Shorten the vertex function
    function v(x,y,z){ 
            return new THREE.Vector3(x,y,z); 
    }
    
    //Create axis (point1, point2, colour)
    function createAxis(p1, p2, color){
            var line, lineGeometry = new THREE.Geometry(),
            lineMat = new THREE.LineBasicMaterial({color: color, lineWidth: 1});
            lineGeometry.vertices.push(p1, p2);
            line = new THREE.Line(lineGeometry, lineMat);
            scene.add(line);
    }
    
    createAxis(v(-axisLength, 0, 0), v(axisLength, 0, 0), 0xFF0000);
    createAxis(v(0, -axisLength, 0), v(0, axisLength, 0), 0x00FF00);
    createAxis(v(0, 0, -axisLength), v(0, 0, axisLength), 0x0000FF);
};
