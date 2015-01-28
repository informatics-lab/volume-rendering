var renderer, sceneFirstPass, sceneSecondPass, camera, uniforms, attributes, clock, firstPassTexture, datatex;
var meshFirstPass;

var alphaCorrection = 1.0;
var tex

initVis();
animate();

function initVis() {
    clock = new THREE.Clock();
    
    /*** Camera ***/
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.set(0, 0, 0)

    /***************** Data Cloud **********************/
    // load texture
    dataTexture = THREE.ImageUtils.loadTexture('test_data.png');


    /*** first pass ***/
	var materialFirstPass = new THREE.ShaderMaterial( {
        vertexShader: document.getElementById( 'vertexShaderFirstPass' ).textContent,
        fragmentShader: document.getElementById( 'fragmentShaderFirstPass' ).textContent,
        side: THREE.BackSide
    });

    sceneFirstPass = new THREE.Scene();

    var boxGeometry = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    boxGeometry.doubleSided = true;
  
    meshFirstPass = new THREE.Mesh( boxGeometry, materialFirstPass );
    sceneFirstPass.add( meshFirstPass );


    // get the "colour" coords we just made, as a texture
    firstPassTexture = new THREE.WebGLRenderTarget(  window.innerWidth,
                                             window.innerHeight,
                                             { minFilter: THREE.NearestFilter,
                                               magFilter: THREE.NearestFilter,
                                               format: THREE.RGBFormat,
                                               type: THREE.FloatType } );
    
    /*** second pass ***/
    materialSecondPass = new THREE.ShaderMaterial( {
        vertexShader: document.getElementById( 'vertexShaderSecondPass' ).textContent,
        fragmentShader: document.getElementById( 'fragmentShaderSecondPass' ).textContent,
        side: THREE.FrontSide,
        uniforms: { firstPassTexture: { type: "t", value: firstPassTexture },
        dataTexture: { type: "t", value: dataTexture },
        //transferTex: { type: "t", value: transferTexture },
        steps : {type: "1f" , value: 20.0}, // so we know how long to make in incriment 
        alphaCorrection : {type: "1f" , value: alphaCorrection }}
    });

    sceneSecondPass = new THREE.Scene();
    var meshSecondPass = new THREE.Mesh( boxGeometry, materialSecondPass );
    sceneSecondPass.add( meshSecondPass );  

    /*************** Scene etc ************/
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor( "rgb(135, 206, 250)", 1);

    document.body.appendChild(renderer.domElement);

    controls = new THREE.FirstPersonControls(camera, renderer.domElement);
    controls.moveSpeed *= 30;

     /*** light ***/
  /*  var directionalLight = new THREE.DirectionalLight(0xffff55, 1);
    directionalLight.position.set(-600, 300, -600);
    scene.add(directionalLight);*/
}


function animate() {
    requestAnimationFrame(animate);
    update();
    render();
}


function update() {

}


function render() {
    var delta = clock.getDelta();
    controls.update(delta);
    //Render first pass and store the world space coords of the back face fragments into the texture.
    renderer.render( sceneFirstPass, camera);
    //Render the second pass and perform the volume rendering.
    renderer.render( sceneSecondPass, camera );
}
