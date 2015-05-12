var renderer, sceneFirstPass, scene, camera, clock, firstPassTexture, dataTexture, uniforms, attributes;
var stats;

var video, videoImage, videoImageContext;

var nSteps = 81;
var opacFac = 4.0;
var alphaCorrection = opacFac/nSteps;
var mipMapTex = true;
var downScaling = 7;
var light;
var play = true;

var fps = 10;
var now;
var then = Date.now();
var interval = 1000/fps;
var delta;

initVis();
initGUI();
animate();

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
        uniforms.alphaCorrection.value = opacFac/nSteps;
    });

    var pnSteps = apperanceFolder.add(appearanceParams, 'Number of steps');
    pnSteps.onChange(function(value){
        nSteps = value;
        uniforms.steps.value = nSteps;
        uniforms.alphaCorrection.value = opacFac/nSteps;
    });

    var pMipMapTex = apperanceFolder.add(appearanceParams, 'Mip Map texture');
    pMipMapTex.onChange(function(value){
        mipMapTex = value;
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
    });

    var pDownScaling = apperanceFolder.add(appearanceParams, 'Downscaling');
    pDownScaling.onChange(function(value){
        downScaling = value;
        renderer.setSize(window.innerWidth/downScaling, window.innerHeight/downScaling);
        renderer.domElement.style.cssText = "width: 100%;, height: 100%";
    });

    animationParams = {
        "Pause": function(){play = !play;
                            play ? pPlay.name("Pause") : pPlay.name("Play");}
    }

    animationCtrlFolder = gui.addFolder("Animation");
    pPlay = animationCtrlFolder.add(animationParams, 'Pause');
    
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
    camera.position.set(-1.0, -3.0, 1.5);

    /*** light ***/
    light = new THREE.PointLight(0xFFFFFF);
    light.position.set(0., 0., 20.);
    light.intensity = 3;

    var boxGeometry = new THREE.BoxGeometry(1.0, 1.0, 1.0); // the block to render inside
    boxGeometry.doubleSided = true;

    /* video texture */
    file = "./cloud_frac_623_812_70_4096_4096.ogv";
    dims = getDimensions(file);

    video = document.createElement( 'video' );
    video.id = 'video';
    video.type = ' video/ogg; codecs="theora, vorbis" ';
    video.src = file;
    video.loop = true;
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
    if (mipMapTex){
        dataTexture.generateMipmaps = true;
        dataTexture.magFilter = THREE.LinearFilter;
        dataTexture.minFilter = THREE.LinearMipMapLinearFilter;
    }else{
        dataTexture.generateMipmaps = false;
        dataTexture.magFilter = THREE.LinearFilter;
        dataTexture.minFilter = THREE.LinearFilter;
    };

    /*** first pass ***/
	var materialFirstPass = new THREE.ShaderMaterial( {
        vertexShader: document.getElementById( 'vertexShaderFirstPass' ).textContent,
        fragmentShader: document.getElementById( 'fragmentShaderFirstPass' ).textContent,
        side: THREE.BackSide
    });

    var meshFirstPass = new THREE.Mesh( boxGeometry, materialFirstPass );
    
    sceneFirstPass = new THREE.Scene();
    sceneFirstPass.add( meshFirstPass );

    
    // get the "colour" coords we just made, as a texture
    firstPassTexture = new THREE.WebGLRenderTarget(  window.innerWidth,
                                                     window.innerHeight,
                                             { minFilter: THREE.NearestFilter,
                                               magFilter: THREE.NearestFilter,
                                               format: THREE.RGBFormat,
                                               type: THREE.FloatType } );

    firstPassTexture.wrapS = firstPassTexture.wrapT = THREE.ClampToEdgeWrapping;    
    
    /*** second pass ***/
    uniforms = { firstPassTexture: { type: "t", value: firstPassTexture },
                         dataTexture: { type: "t", value: dataTexture },
                         lightPosition: { type: "v3", value: light.position},
                         lightColor: { type: "v3", value: {x: light.color.r, y:light.color.g, z:light.color.b}},
                         lightIntensity: {type: "1f", value: light.intensity},
                         steps : {type: "1f" , value: nSteps}, // so we know how long to make in incriment 
                         alphaCorrection : {type: "1f" , value: alphaCorrection },
                         dataShape: {type: "v3", value: dims.datashape},
                         textureShape: {type: "v2", value: dims.textureshape}
                     };

    materialSecondPass = new THREE.ShaderMaterial( {
        vertexShader: document.getElementById( 'vertexShaderSecondPass' ).textContent,
        fragmentShader: document.getElementById( 'fragmentShaderSecondPass' ).textContent,
        side: THREE.FrontSide,
        uniforms: uniforms
    });
    materialSecondPass.transparent = true;
    
    scene = new THREE.Scene();
    var meshSecondPass = new THREE.Mesh( boxGeometry, materialSecondPass );
    scene.add( meshSecondPass );  

    /*************** Add map **************/
    var mapImage = THREE.ImageUtils.loadTexture("./res/uk.jpg");
    var mapMaterial = new THREE.MeshLambertMaterial({ map : mapImage });
    var mapPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mapMaterial);
    mapPlane.doubleSided = true;
    mapPlane.position.z = -0.5;
    // plane.rotation.z = 2;  // Not sure what this number represents.
    scene.add(mapPlane);

    /*************** Scene etc ************/
    renderer = new THREE.WebGLRenderer( { antialias: true} );
    renderer.setSize(window.innerWidth/downScaling, window.innerHeight/downScaling); // reducing these values effectively reduced resolution
    renderer.setClearColor( "rgb(135, 206, 250)", 1);

    renderer.domElement.style.cssText = "width: 100%;, height: 100%";

    document.body.appendChild(renderer.domElement);

    // add light
    scene.add(light);

    // trackball controls
    controls = new THREE.TrackballControls(camera, renderer.domElement);
    controls.rotateSpeed = 1.0;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 1.0;
    controls.dynamicDampingFactor = 0.3;
    controls.staticMoving = false;
    controls.noZoom = false;
    controls.noPan = false;  
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

    stats.begin();
    now = Date.now();
    delta = now - then;
     
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
    controls.update();
}


function render() {
    //Render first pass and store the world space coords of the back face fragments into the texture.
    renderer.render( sceneFirstPass, camera, firstPassTexture, true);

    if ( video.readyState === video.HAVE_ENOUGH_DATA ) 
    {
        videoImageContext.drawImage( video, 0, 0 );
        if ( dataTexture ) 
            dataTexture.needsUpdate = true;
    }
    //Render the second pass and perform the volume rendering.
    renderer.render( scene, camera );
}
