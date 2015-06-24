function demPaletteFn() {
    /*
    Returns a function, which accepts a number and
    returns an object with r,g,b,a properties.
    This is used for the digital elevation model.
    */
    var canvas = document.createElement( 'canvas' );
    canvas.width = 256;
    canvas.height = 1;

    var context = canvas.getContext( '2d' );
    var grad = context.createLinearGradient(0,0,256,0);
    grad.addColorStop(0, "#108010");
    grad.addColorStop(.6, "#606010");
    grad.addColorStop(1, "#906030");

    context.fillStyle = grad;
    context.fillRect(0, 0, 256, 1);

    var palette = [], r, g, b, a;
    var image = context.getImageData( 0, 0, canvas.width, 1 );
    for ( var i = 0; i < image.data.length; i += 4 ) {
        r = image.data[ i ];
        g = image.data[ i + 1 ];
        b = image.data[ i + 2 ];
        a = image.data[ i + 3 ];
        palette.push({r:r,g:g,b:b,a:a});
    }
    var fn = function(v){
        v = ~~v; //removes everything after the decimal point
        if (v < 1) {
            return {r:0,g:0,b:0,a:0};
        }
        else {
            v = (v>255) ? 255 : v;
            return palette[v];
        }
    };
    return fn;
}

function generateTexture(data, dem_width, dem_height ) {
    var palfn = demPaletteFn();
    var canvas = document.createElement( 'canvas' );
    canvas.width = 600;
    canvas.height = 600;

    var context = canvas.getContext( '2d' );
    var image = context.getImageData( 0, 0, canvas.width, canvas.height );

    // N.B. image.data is a Uint8ClampedArray. See http://www.html5rocks.com/en/tutorials/webgl/typed_arrays/
    var x = 0, y = 0, v;
    for ( var i = 0, j = 0, l = image.data.length; i < l; i += 4, j ++ ) {
        x = j % canvas.width;
        y = x == 0 ? y + 1 : y;
        // ~~ faster that .toFixed(0)
        var xi = ~~(dem_width/canvas.width  * x);
        var yi = ~~(dem_height/canvas.height * y);
        v = data[(yi % dem_height )* dem_width + (xi % dem_width)];
        var rgba = palfn( v * 0.5 );
        image.data[i] = rgba.r;
        image.data[i+1] = rgba.g;
        image.data[i+2] = rgba.b;
        image.data[i+3] = rgba.a;
    }
    context.putImageData( image, 0, 0 );
    return canvas;
}

function buildLand( data, width, height ){
    var dem_width = 256;
    var dem_height = 256;
    var distns = 1000.7543398010279;
    var texture = new THREE.Texture( generateTexture(data, dem_width, dem_height) );
    texture.needsUpdate = true;
    var material = new THREE.MeshPhongMaterial({
        map: texture,
        transparent: false,
        specular: 0x444444,
        shininess: 1
    });

    var geometry = new THREE.PlaneGeometry(width, height, dem_width-1, dem_height-1);
    var scale_fac = 1.0 /  (distns * 1000.0);
    for(i = 0; i < data.length; i++){
        var ht = data[i];
        if(ht < 0){ht = 0;}
        geometry.vertices[i].z = (ht * 10.0 * scale_fac) + 5.0;
    }
    geometry.verticesNeedUpdate = true;

    var mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.rotation.x = - Math.PI * 0.5;
    return mesh;
};

function onDemLoad(self, callback, w, h) {
    var data = self.response;
    var demdata = Array.prototype.slice.call(new Int16Array(data));
    var land = buildLand( demdata, w, h );
    callback(land);
}

function getLand(callback, width, height) {
    var req = new XMLHttpRequest();
    req.responseType = "arraybuffer";
    req.onload = function(){
        onDemLoad(this, callback, width, height);
    };
    req.open("get", 'data/dem.bin', true);
    req.send();
}