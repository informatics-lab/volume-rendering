var renderer, sceneFirstPass, sceneSecondPass, camera, uniforms, attributes, clock, firstPassTexture, datatex;
var meshFirstPass;

var alphaCorrection = 0.08; // just a fudge factor
var nSteps = 500;

initVis();
animate();

function initVis() {
    clock = new THREE.Clock();
    
    /*** Camera ***/
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 1000);
    camera.position.set(-1.73, 0.13, 0.9)

    /***************** Data Cloud **********************/
    // load texture
    dataTexture = THREE.ImageUtils.loadTexture('./test_blob_hr.png');

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
                       //transferTex: {type: "t", value: transferTexture },
                         steps : {type: "1f" , value: nSteps}, // so we know how long to make in incriment 
                         alphaCorrection : {type: "1f" , value: alphaCorrection }}
    });
    materialSecondPass.transparent = true;
    
    sceneSecondPass = new THREE.Scene();
    var meshSecondPass = new THREE.Mesh( boxGeometry, materialSecondPass );
    sceneSecondPass.add( meshSecondPass );  

    /*************** Scene etc ************/
    renderer = new THREE.WebGLRenderer( { antialias: true} );
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor( "rgb(135, 206, 250)", 1);

    document.body.appendChild(renderer.domElement);

    //controls = new THREE.FirstPersonControls(camera, 
    // controls.moveSpeed *= 100;

    // trackball controls
    controls = new THREE.TrackballControls(camera, renderer.domElement);
    controls.rotateSpeed = 1.0;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 1.0;
    controls.dynamicDampingFactor = 0.3;
    controls.staticMoving = false;
    controls.noZoom = false;
    controls.noPan = false;
     /*** light ***/
  /*  var directionalLight = new THREE.DirectionalLight(0xffff55, 1);
    directionalLight.position.set(-600, 300, -600);
    scene.add(directionalLight);*/

    var anotherBoxGeometry = new THREE.BoxGeometry(3, 3, 3);
    var anotherMaterial = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe: true } );
    var anotherBoxMesh = new THREE.Mesh( anotherBoxGeometry, anotherMaterial );
    sceneSecondPass.add(anotherBoxMesh);
    anotherBoxMesh.position = new THREE.Vector3( 2., 2., 2.);
}


function animate() {
    requestAnimationFrame(animate);
    update();
    render();
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
