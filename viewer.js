var renderer, sceneFirstPass, sceneSecondPass, camera, uniforms, attributes, clock, firstPassTexture, datatex;
var meshFirstPass;

var alphaCorrection = 4.5 ; // just a fudge factor
var nSteps = 512;

var fps = 15;
var now;
var then = Date.now();
var interval = 1000/fps;
var delta;

initVis();
animate();

function initVis() {
    clock = new THREE.Clock();
    
    /*** Camera ***/
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 1000);
    camera.position.set(-1.73, 0.13, 0.9);

    /***************** Data Cloud **********************/
    // load texture
    var file = './test_blob_32_32_48_144_144.png';
    var dataTexture = THREE.ImageUtils.loadTexture(file);

    var dims = getDimensions(file);

    var boxGeometry = new THREE.BoxGeometry(1.0, 1.0, 1.0); // the block to render inside
    boxGeometry.doubleSided = true;

    /*** first pass ***/
	var materialFirstPass = new THREE.ShaderMaterial( {
        vertexShader: document.getElementById( 'vertexShaderFirstPass' ).textContent,
        fragmentShader: document.getElementById( 'fragmentShaderFirstPass' ).textContent,
        side: THREE.BackSide
    });

    meshFirstPass = new THREE.Mesh( boxGeometry, materialFirstPass );
    
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
    materialSecondPass = new THREE.ShaderMaterial( {
        vertexShader: document.getElementById( 'vertexShaderSecondPass' ).textContent,
        fragmentShader: document.getElementById( 'fragmentShaderSecondPass' ).textContent,
        side: THREE.FrontSide,
        uniforms: { firstPassTexture: { type: "t", value: firstPassTexture },
                         dataTexture: { type: "t", value: dataTexture },
                         steps : {type: "1f" , value: nSteps}, // so we know how long to make in incriment 
                         alphaCorrection : {type: "1f" , value: alphaCorrection },
                         dataShape: {type: "v3", value: dims.datashape},
                         textureShape: {type: "v2", value: dims.textureshape}
                     }
    });
    materialSecondPass.transparent = true;
    
    sceneSecondPass = new THREE.Scene();
    var meshSecondPass = new THREE.Mesh( boxGeometry, materialSecondPass );
    sceneSecondPass.add( meshSecondPass );  

    /*************** Scene etc ************/
    renderer = new THREE.WebGLRenderer( { antialias: true} );
    renderer.setSize(window.innerWidth, window.innerHeight); // reducing these values effectively reduced resolution
    renderer.setClearColor( "rgb(135, 206, 250)", 1);

    document.body.appendChild(renderer.domElement);

    // trackball controls
    controls = new THREE.TrackballControls(camera, renderer.domElement);
    controls.rotateSpeed = 1.0;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 1.0;
    controls.dynamicDampingFactor = 0.3;
    controls.staticMoving = false;
    controls.noZoom = false;
    controls.noPan = false;        

    var anotherBoxGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    var anotherMaterial = new THREE.MeshLambertMaterial( { color: 0xff0000, wireframe: false } );
    var anotherBoxMesh = new THREE.Mesh( anotherBoxGeometry, anotherMaterial );
    anotherBoxMesh.position.set(.2, .2, .2);
    sceneSecondPass.add(anotherBoxMesh);
}

/**
/ Parse dimension values from a formatted filename
/ @param {string} filename - format "*_x_y_z_u_v.png"
/       where (x,y,z) is datashape and (u,v) is textureshape
/ @returns {Number[]}
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

    now = Date.now();
    delta = now - then;
     
    if (delta > interval) {
        // update time stuffs
        then = now - (delta % interval);
         
        update();
        render();
    }
}


function update() {

}


function render() {
    controls.update();
    //Render first pass and store the world space coords of the back face fragments into the texture.
    renderer.render( sceneFirstPass, camera, firstPassTexture, true);
    //Render the second pass and perform the volume rendering.
    renderer.render( sceneSecondPass, camera );
}
